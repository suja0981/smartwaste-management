from datetime import datetime, timezone


def determine_bin_status(fill_level_percent: int) -> str:
    """
    Determine bin status based on fill level percentage.

    Returns:
        Status string: 'full', 'warning', or 'ok'
    """
    if fill_level_percent >= 90:
        return "full"
    elif fill_level_percent >= 80:
        return "warning"
    else:
        return "ok"


def get_current_timestamp() -> datetime:
    """
    Get current UTC timestamp.
    Uses datetime.now(timezone.utc) — datetime.utcnow() is deprecated in Python 3.12+.

    Returns:
        Current datetime in UTC (timezone-aware)
    """
    return datetime.now(timezone.utc)


def format_timestamp_response(timestamp: datetime) -> str:
    """
    Format timestamp for API responses.

    Args:
        timestamp: DateTime object (naive or aware)

    Returns:
        ISO formatted timestamp string with 'Z' suffix
    """
    # Strip tzinfo for consistent output regardless of input type
    if timestamp.tzinfo is not None:
        timestamp = timestamp.replace(tzinfo=None)
    return timestamp.isoformat() + "Z"