"""
Logging configuration for MCP Video Service
"""

import logging
import sys
from datetime import datetime
from typing import Dict, Any
import json
try:
    from .config import settings
except ImportError:
    from config import settings

class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        if hasattr(record, 'latency_ms'):
            log_entry['latency_ms'] = record.latency_ms
        if hasattr(record, 'action'):
            log_entry['action'] = record.action
        if hasattr(record, 'cache_hit'):
            log_entry['cache_hit'] = record.cache_hit
            
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
            
        return json.dumps(log_entry)

def setup_logging():
    """Setup logging configuration"""
    
    # Create logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, settings.log_level.upper()))
    
    # Remove existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, settings.log_level.upper()))
    
    # Use JSON formatter for structured logging
    formatter = JSONFormatter()
    console_handler.setFormatter(formatter)
    
    # Add handler to logger
    logger.addHandler(console_handler)
    
    return logger

def log_request(logger: logging.Logger, user_id: str, action: str, **kwargs):
    """Log request with structured data"""
    extra = {
        'user_id': user_id,
        'action': action,
        **kwargs
    }
    logger.info(f"Request started: {action}", extra=extra)

def log_response(logger: logging.Logger, user_id: str, action: str, latency_ms: int, **kwargs):
    """Log response with structured data"""
    extra = {
        'user_id': user_id,
        'action': action,
        'latency_ms': latency_ms,
        **kwargs
    }
    logger.info(f"Request completed: {action}", extra=extra)

def log_error(logger: logging.Logger, error: Exception, user_id: str = None, action: str = None, **kwargs):
    """Log error with structured data"""
    extra = {
        'error_type': type(error).__name__,
        'error_message': str(error),
        **kwargs
    }
    
    if user_id:
        extra['user_id'] = user_id
    if action:
        extra['action'] = action
        
    logger.error(f"Error occurred: {str(error)}", extra=extra, exc_info=True)

# Telemetry data collection
class TelemetryCollector:
    """Collect telemetry data for monitoring and analytics"""
    
    def __init__(self):
        self.metrics = {}
        
    def record_request(self, user_id: str, action: str, latency_ms: int, cache_hit: bool = False):
        """Record request metrics"""
        key = f"{action}_requests"
        if key not in self.metrics:
            self.metrics[key] = []
            
        self.metrics[key].append({
            "user_id": user_id,
            "action": action,
            "latency_ms": latency_ms,
            "cache_hit": cache_hit,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep only last 1000 entries per action
        if len(self.metrics[key]) > 1000:
            self.metrics[key] = self.metrics[key][-1000:]
    
    def record_error(self, user_id: str, action: str, error_type: str, error_message: str):
        """Record error metrics"""
        key = f"{action}_errors"
        if key not in self.metrics:
            self.metrics[key] = []
            
        self.metrics[key].append({
            "user_id": user_id,
            "action": action,
            "error_type": error_type,
            "error_message": error_message,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep only last 500 errors per action
        if len(self.metrics[key]) > 500:
            self.metrics[key] = self.metrics[key][-500:]
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get metrics summary"""
        summary = {}
        
        for key, values in self.metrics.items():
            if "_requests" in key:
                action = key.replace("_requests", "")
                total_requests = len(values)
                cache_hits = sum(1 for v in values if v.get("cache_hit", False))
                avg_latency = sum(v["latency_ms"] for v in values) / total_requests if total_requests > 0 else 0
                
                summary[action] = {
                    "total_requests": total_requests,
                    "cache_hit_rate": cache_hits / total_requests if total_requests > 0 else 0,
                    "avg_latency_ms": round(avg_latency, 2)
                }
                
            elif "_errors" in key:
                action = key.replace("_errors", "")
                if action not in summary:
                    summary[action] = {}
                summary[action]["total_errors"] = len(values)
                
        return summary

# Global telemetry collector
telemetry = TelemetryCollector()
