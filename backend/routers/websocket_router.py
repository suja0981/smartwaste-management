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
import json
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
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
        """
        Send a JSON message to every connected client; drop dead connections.
        
        FIXED: Race condition handling — safely removes dead connections even if
        they were removed concurrently by a disconnect() call from another task.
        """
        dead: List[WebSocket] = []
        # Create snapshot of connections at broadcast time
        for ws in list(self._connections):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.debug(f"[WS] Send failed, marking connection as dead: {e}")
                dead.append(ws)
        
        # Safely remove dead connections — ignore if already removed
        for ws in dead:
            if ws in self._connections:
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

def _verify_ws_token(token: str) -> Optional[str]:
    """Validate a WebSocket JWT; return the user email on success, None on failure."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if not email:
            return None
        if payload.get("type", "access") != "access":
            return None
        return email
    except JWTError:
        return None


# ─── WebSocket endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time dashboard updates.

    Security: the JWT is NEVER sent as a URL query parameter — URLs are
    logged in plaintext by every proxy and access log.  Instead the client
    sends the token as the first message after the connection is accepted:
      1. Connect to ws://host/ws  (no query params)
      2. Send: {"type": "auth", "token": "<access_jwt>"}
      3. Receive {"event": "connected", ...} on success, or
               {"event": "auth_error", "reason": "..."} then connection closes.

    The client should handle reconnection with exponential back-off.
    """
    # Accept the upgrade first so we can exchange messages for authentication.
    await websocket.accept()

    # Wait up to 10 s for the auth message to prevent dangling connections.
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        msg = json.loads(raw)
        if msg.get("type") != "auth":
            raise ValueError("First message must have type='auth'")
        token = msg.get("token", "")
    except (asyncio.TimeoutError, ValueError, json.JSONDecodeError):
        await websocket.send_json({"event": "auth_error", "reason": "Authentication required"})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    email = _verify_ws_token(token)
    if not email:
        await websocket.send_json({"event": "auth_error", "reason": "Invalid or expired token"})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Verify user still exists and is active in DB.
    db: Session = SessionLocal()
    try:
        user = db.query(UserDB).filter(UserDB.email == email, UserDB.is_active == True).first()
        if not user:
            await websocket.send_json({"event": "auth_error", "reason": "User not found or disabled"})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    finally:
        db.close()

    await manager.connect(websocket, email)

    try:
        await websocket.send_json({
            "event": "connected",
            "message": "Connected to Smart Waste real-time feed",
            "active_connections": manager.connection_count,
        })

        while True:
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