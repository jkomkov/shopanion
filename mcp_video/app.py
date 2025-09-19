"""
MCP-B: MiniMax Video Service
Purpose: Animate try-on images into short vertical clips using MiniMax API
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
import logging
import time
import os
from datetime import datetime
from contextlib import asynccontextmanager

try:
    # Try relative imports first (when run as module)
    from .minimax_client import MiniMaxClient
    from .redis_client import redis_client
    from .config import settings
    from .logging_config import setup_logging, log_request, log_response, log_error, telemetry
    from .exceptions import (
        MCPVideoException,
        MiniMaxAPIException,
        VideoGenerationException,
        get_http_status_for_error
    )
except ImportError:
    # Fall back to absolute imports (when run directly)
    from minimax_client import MiniMaxClient
    from redis_client import redis_client
    from config import settings
    from logging_config import setup_logging, log_request, log_response, log_error, telemetry
    from exceptions import (
        MCPVideoException,
        MiniMaxAPIException,
        VideoGenerationException,
        get_http_status_for_error
    )

# Setup logging
logger = setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting MCP Video Service...")
    try:
        await redis_client.connect()
        logger.info("Connected to Redis")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")

    yield

    # Shutdown
    logger.info("Shutting down MCP Video Service...")
    await redis_client.disconnect()

app = FastAPI(
    title="MCP Video Service",
    description="MiniMax Video Generation Service for Virtual Try-On",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handling middleware
@app.exception_handler(MCPVideoException)
async def mcp_video_exception_handler(request, exc: MCPVideoException):
    """Handle custom MCP Video exceptions"""
    log_error(logger, exc, action="exception_handler")
    telemetry.record_error(
        user_id="unknown",
        action="exception",
        error_type=exc.error_code,
        error_message=exc.message
    )

    return HTTPException(
        status_code=get_http_status_for_error(exc),
        detail={
            "error": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """Handle general exceptions"""
    log_error(logger, exc, action="general_exception")
    telemetry.record_error(
        user_id="unknown",
        action="exception",
        error_type=type(exc).__name__,
        error_message=str(exc)
    )

    return HTTPException(
        status_code=500,
        detail={
            "error": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred"
        }
    )

# Request/Response Models
class AnimateRequest(BaseModel):
    user_id: str
    image_url: str
    action: Literal["turn", "wave", "walk"] = "turn"
    duration_s: int = Field(default=4, ge=3, le=6)
    aspect: str = Field(default="9:16")

class AnimateResponse(BaseModel):
    video_url: str
    captions: List[str]
    latency_ms: int

class StoryboardRequest(BaseModel):
    image_url: str
    product_attrs: dict

class StoryboardResponse(BaseModel):
    beats: List[str]
    copy: str

class ComposeRequest(BaseModel):
    user_id: str
    image_url: str
    actions: List[Literal["turn", "wave", "walk"]]
    aspect: str = Field(default="9:16")

class ComposeResponse(BaseModel):
    video_url: str
    captions: List[str]
    latency_ms: int

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    redis_status = "connected"
    try:
        await redis_client.redis.ping() if redis_client.redis else None
    except:
        redis_status = "disconnected"

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "redis": redis_status,
        "version": "1.0.0"
    }

# User history endpoints
@app.get("/history/{user_id}")
async def get_user_history(user_id: str, limit: int = 10):
    """Get user's video generation history"""
    try:
        history = await redis_client.get_user_history(user_id, limit)
        return {"history": history, "count": len(history)}
    except Exception as e:
        logger.error(f"Failed to get user history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user history")

@app.get("/last-video/{user_id}")
async def get_last_video(user_id: str):
    """Get user's last generated video"""
    try:
        video_url = await redis_client.get_last_video(user_id)
        if video_url:
            return {"video_url": video_url}
        else:
            raise HTTPException(status_code=404, detail="No video found for user")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get last video: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get last video")

@app.get("/metrics")
async def get_metrics():
    """Get service metrics and telemetry data"""
    try:
        metrics = telemetry.get_metrics_summary()
        return {
            "metrics": metrics,
            "timestamp": datetime.utcnow().isoformat(),
            "service": "mcp-video"
        }
    except Exception as e:
        logger.error(f"Failed to get metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get metrics")

# Core endpoints as specified in README
@app.post("/animate", response_model=AnimateResponse)
async def animate_image(request: AnimateRequest):
    """
    Animate a try-on image into a short vertical clip

    Args:
        request: Animation request with image URL, action, duration, and aspect ratio

    Returns:
        AnimateResponse with video URL, captions, and latency
    """
    start_time = time.time()

    try:
        log_request(logger, request.user_id, "animate",
                   action=request.action, duration=request.duration_s)

        # Check cache first
        cached_result = await redis_client.get_cached_video(
            request.user_id,
            request.image_url,
            request.action,
            request.duration_s
        )

        if cached_result:
            latency_ms = int((time.time() - start_time) * 1000)
            cached_result["latency_ms"] = latency_ms
            cached_result["cache_hit"] = True

            log_response(logger, request.user_id, "animate", latency_ms,
                        cache_hit=True, action=request.action)
            telemetry.record_request(request.user_id, "animate", latency_ms, cache_hit=True)

            return AnimateResponse(**cached_result)

        # Generate new video using MiniMax
        async with MiniMaxClient() as minimax:
            result = await minimax.generate_video(
                image_url=request.image_url,
                action=request.action,
                duration=request.duration_s,
                aspect_ratio=request.aspect
            )

            video_url = result.get("video_url", result.get("url", ""))
            captions = [f"{request.action.capitalize()} to show fit"]

            if not video_url:
                raise Exception("No video URL returned from MiniMax")

            # Cache the result
            cache_data = {
                "video_url": video_url,
                "captions": captions,
                "cache_hit": False
            }

            await redis_client.cache_video(
                request.user_id,
                request.image_url,
                request.action,
                request.duration_s,
                cache_data
            )

            # Add to user history
            history_data = {
                "video_url": video_url,
                "action": request.action,
                "duration": request.duration_s,
                "timestamp": datetime.utcnow().isoformat(),
                "image_url": request.image_url
            }
            await redis_client.add_to_user_history(request.user_id, history_data)

            # Store as last video
            await redis_client.store_last_video(request.user_id, video_url)

            latency_ms = int((time.time() - start_time) * 1000)

            log_response(logger, request.user_id, "animate", latency_ms,
                        cache_hit=False, action=request.action)
            telemetry.record_request(request.user_id, "animate", latency_ms, cache_hit=False)

            return AnimateResponse(
                video_url=video_url,
                captions=captions,
                latency_ms=latency_ms
            )

    except Exception as e:
        log_error(logger, e, request.user_id, "animate")
        telemetry.record_error(request.user_id, "animate", type(e).__name__, str(e))

        if isinstance(e, MCPVideoException):
            raise
        else:
            raise VideoGenerationException(f"Animation failed: {str(e)}",
                                         action=request.action,
                                         duration=request.duration_s)

@app.post("/storyboard", response_model=StoryboardResponse)
async def create_storyboard(request: StoryboardRequest):
    """
    Create a storyboard for video animation based on product attributes

    Args:
        request: Storyboard request with image URL and product attributes

    Returns:
        StoryboardResponse with beats and copy
    """
    try:
        logger.info(f"Creating storyboard for image: {request.image_url}")

        # Use MiniMax client to create intelligent storyboard
        async with MiniMaxClient() as minimax:
            result = await minimax.create_storyboard(
                image_url=request.image_url,
                product_attrs=request.product_attrs
            )

            return StoryboardResponse(
                beats=result["beats"],
                copy=result["copy"]
            )

    except Exception as e:
        logger.error(f"Storyboard creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Storyboard creation failed: {str(e)}")

@app.post("/compose", response_model=ComposeResponse)
async def compose_video(request: ComposeRequest):
    """
    Compose a video with multiple actions

    Args:
        request: Compose request with image URL and list of actions

    Returns:
        ComposeResponse with video URL, captions, and latency
    """
    start_time = time.time()

    try:
        logger.info(f"Composing video for user {request.user_id}, actions: {request.actions}")

        # Use MiniMax client to compose multi-action video
        async with MiniMaxClient() as minimax:
            result = await minimax.compose_multi_action_video(
                image_url=request.image_url,
                actions=request.actions,
                aspect_ratio=request.aspect
            )

            video_url = result.get("video_url", result.get("url", ""))
            captions = [f"{action.capitalize()}" for action in request.actions]

            if not video_url:
                raise Exception("No video URL returned from MiniMax")

            # Add to user history
            history_data = {
                "video_url": video_url,
                "actions": request.actions,
                "timestamp": datetime.utcnow().isoformat(),
                "image_url": request.image_url,
                "type": "composed"
            }
            await redis_client.add_to_user_history(request.user_id, history_data)

            # Store as last video
            await redis_client.store_last_video(request.user_id, video_url)

            latency_ms = int((time.time() - start_time) * 1000)

            logger.info(f"Video composition completed in {latency_ms}ms")

            return ComposeResponse(
                video_url=video_url,
                captions=captions,
                latency_ms=latency_ms
            )

    except Exception as e:
        logger.error(f"Video composition failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Video composition failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
