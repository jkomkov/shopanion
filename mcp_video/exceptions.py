"""
Custom exceptions for MCP Video Service
"""

from typing import Optional, Dict, Any

class MCPVideoException(Exception):
    """Base exception for MCP Video Service"""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        self.message = message
        self.error_code = error_code or "UNKNOWN_ERROR"
        self.details = details or {}
        super().__init__(self.message)

class MiniMaxAPIException(MCPVideoException):
    """Exception for MiniMax API errors"""
    
    def __init__(self, message: str, status_code: int = None, response_data: Dict[str, Any] = None):
        self.status_code = status_code
        self.response_data = response_data or {}
        super().__init__(
            message=message,
            error_code="MINIMAX_API_ERROR",
            details={
                "status_code": status_code,
                "response_data": response_data
            }
        )

class VideoGenerationException(MCPVideoException):
    """Exception for video generation errors"""
    
    def __init__(self, message: str, action: str = None, duration: int = None):
        super().__init__(
            message=message,
            error_code="VIDEO_GENERATION_ERROR",
            details={
                "action": action,
                "duration": duration
            }
        )

class CacheException(MCPVideoException):
    """Exception for cache-related errors"""
    
    def __init__(self, message: str, operation: str = None):
        super().__init__(
            message=message,
            error_code="CACHE_ERROR",
            details={"operation": operation}
        )

class ValidationException(MCPVideoException):
    """Exception for input validation errors"""
    
    def __init__(self, message: str, field: str = None, value: Any = None):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            details={
                "field": field,
                "value": str(value) if value is not None else None
            }
        )

class RateLimitException(MCPVideoException):
    """Exception for rate limiting errors"""
    
    def __init__(self, message: str, user_id: str = None, limit: int = None):
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            details={
                "user_id": user_id,
                "limit": limit
            }
        )

class StorageException(MCPVideoException):
    """Exception for storage-related errors"""
    
    def __init__(self, message: str, operation: str = None, file_path: str = None):
        super().__init__(
            message=message,
            error_code="STORAGE_ERROR",
            details={
                "operation": operation,
                "file_path": file_path
            }
        )

# Error code mappings for HTTP status codes
ERROR_CODE_TO_HTTP_STATUS = {
    "UNKNOWN_ERROR": 500,
    "MINIMAX_API_ERROR": 502,
    "VIDEO_GENERATION_ERROR": 500,
    "CACHE_ERROR": 500,
    "VALIDATION_ERROR": 400,
    "RATE_LIMIT_EXCEEDED": 429,
    "STORAGE_ERROR": 500
}

def get_http_status_for_error(error: MCPVideoException) -> int:
    """Get appropriate HTTP status code for error"""
    return ERROR_CODE_TO_HTTP_STATUS.get(error.error_code, 500)
