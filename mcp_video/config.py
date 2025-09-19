"""
Configuration management for MCP Video Service
"""

import os
from pathlib import Path
from typing import Optional
from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    minimax_api_key: str = Field(..., env="MINIMAX_API_KEY")
    minimax_base_url: str = Field(
        default="https://api.minimax.chat/v1", 
        env="MINIMAX_BASE_URL"
    )
    
    # Redis Configuration
    redis_url: str = Field(
        default="redis://localhost:6379/0", 
        env="REDIS_URL"
    )
    
    # Storage Configuration
    base_asset_url: str = Field(
        default="http://localhost:8002/assets", 
        env="BASE_ASSET_URL"
    )
    
    # Video Generation Settings
    default_duration: int = Field(default=4, ge=3, le=6)
    default_aspect_ratio: str = Field(default="9:16")
    max_video_size_mb: int = Field(default=50)
    
    # Cache Settings
    video_cache_ttl: int = Field(default=3600)  # 1 hour
    
    # Rate Limiting
    rate_limit_per_user: int = Field(default=10)  # requests per minute
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    
    # Optional Services
    anthropic_api_key: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    
    class Config:
        # Look for .env file in the parent directory (root of project)
        env_file = Path(__file__).parent.parent / ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()
