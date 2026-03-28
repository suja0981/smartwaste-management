"""
routers/websocket_router.py  —  Phase 3: Real-time bin updates via WebSocket.

How it works:
  1. Dashboard client connects to  ws://host/ws?token=<jwt>
  2. Server validates the JWT; rejects unauthenticated connections.
  3. When a bin's telemetry is ingested (POST /telemetry/), the telemetry
     router calls  manager.broadcast_bin_update(...)  which pushes the
     updated state to ALL connected dashboard clients instantly.
  4. The global `manager` instance is imported by telemetry_update.py so
     both modules share the same in-process connection list.

Message format sent to clients:
  {
    "event": "bin_update",
    "bin_id": "bin01",
    "fill_level_percent": 87,
    "status": "warning",
    "battery_percent": 72,
    "temperature_c": 28.5,
    "humidity_percent": 60,
    "timestamp": "2026-03-28T10:00:00Z"
  }

  {
    "event": "bin_alert",
    "bin_id": "bin01",
    "level": "warning" | "critical",
    "message": "Bin bin01 is 87% full",
    "timestamp": "..."
  }
"""

import asyncio
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import get_settings
from database import SessionLocal, UserDB

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


# ─── Connection Manager ───────────────────────────────────────────────────────

class ConnectionManager:
    """
    Manages all active WebSocket connections.

    Thread/async safety:
      FastAPI runs each WebSocket in the same event loop, so the list
      operations are safe without locks.  For multi-process deployments
      (e.g. Gunicorn with multiple workers) you'd replace this with
      Redis Pub/Sub — left as a future improvement comment.
    """

    def __init__(self):
        # Keyed by websocket object; value is the connected user email
        self._connections: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, user_email: str) -> None:
        await websocket.accept()
        self._connections[websocket] = user_email
        logger.info(f"[WS] {user_email} connected — {len(self._connections)} clients online")

    def disconnect(self, websocket: WebSocket) -> None:
        email = self._connections.pop(websocket, "unknown")
        logger.info(f"[WS] {email} disconnected — {len(self._connections)} clients online")

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    async def broadcast(self, message: dict) -> None:
        """Send a JSON message to every connected client; drop dead connections."""
        dead: List[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_bin_update(
        self,
        bin_id: str,
        fill_level_percent: int,
        status: str,
        battery_percent: Optional[int],
        temperature_c: Optional[float],
        humidity_percent: Optional[int],
        timestamp: str,
    ) -> None:
        """Convenience wrapper called by the telemetry router."""
        await self.broadcast({
            "event": "bin_update",
            "bin_id": bin_id,
            "fill_level_percent": fill_level_percent,
            "status": status,
            "battery_percent": battery_percent,
            "temperature_c": temperature_c,
            "humidity_percent": humidity_percent,
            "timestamp": timestamp,
        })

        # Emit a separate alert event if fill crosses a threshold
        if fill_level_percent >= 90:
            await self.broadcast({
                "event": "bin_alert",
                "bin_id": bin_id,
                "level": "critical",
                "message": f"Bin {bin_id} is critically full ({fill_level_percent}%)",
                "timestamp": timestamp,
            })
        elif fill_level_percent >= 80:
            await self.broadcast({
                "event": "bin_alert",
                "bin_id": bin_id,
                "level": "warning",
                "message": f"Bin {bin_id} is {fill_level_percent}% full — collection recommended",
                "timestamp": timestamp,
            })


# ── Singleton shared across this process ──────────────────────────────────────
manager = ConnectionManager()


# ─── Auth helper ─────────────────────────────────────────────────────────────

def _verify_token_from_query(token: Optional[str]) -> Optional[str]:
    """
    Validates a JWT passed as ?token=... query param.
    Returns the user email on success, None on failure.
    WebSocket upgrade happens before HTTP headers are easy to read, so
    passing the JWT as a query param is the standard pattern.
    """
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if not email:
            return None
        # Only access tokens are valid
        if payload.get("type", "access") != "access":
            return None
        return email
    except JWTError:
        return None


# ─── WebSocket endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    """
    WebSocket endpoint for real-time dashboard updates.

    Connect with:
      ws://localhost:8000/ws?token=<access_jwt>

    The client should handle reconnection with exponential back-off.
    """
    email = _verify_token_from_query(token)

    if not email:
        # Must close BEFORE accepting to reject at the upgrade level
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Verify user still exists in DB
    db: Session = SessionLocal()
    try:
        user = db.query(UserDB).filter(UserDB.email == email, UserDB.is_active == True).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    finally:
        db.close()

    await manager.connect(websocket, email)

    # Send current connection count as a welcome message
    try:
        await websocket.send_json({
            "event": "connected",
            "message": f"Connected to Smart Waste real-time feed",
            "active_connections": manager.connection_count,
        })

        # Keep connection alive; client will disconnect when done
        while True:
            # Wait for a ping from the client (or disconnect)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"[WS] Unexpected error for {email}: {e}")
        manager.disconnect(websocket)


@router.get("/ws/stats")
def websocket_stats():
    """Quick health check — how many clients are currently connected."""
    return {"active_connections": manager.connection_count}