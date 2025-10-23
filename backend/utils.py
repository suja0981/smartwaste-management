from datetime import datetime

def determine_bin_status(fill_level_percent: int) -> str:
    """
    Determine bin status based on fill level percentage.
    
    Args:
        fill_level_percent: Current fill level as percentage (0-100)
        
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
    
    Returns:
        Current datetime in UTC
    """
    return datetime.utcnow()

def format_timestamp_response(timestamp: datetime) -> str:
    """
    Format timestamp for API responses.
    
    Args:
        timestamp: DateTime object
        
    Returns:
        ISO formatted timestamp string with 'Z' suffix
    """
    return timestamp.isoformat() + "Z"