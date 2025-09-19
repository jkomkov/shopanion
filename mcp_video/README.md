# MCP Video Service

MCP-B: MiniMax Video Generation Service for Virtual Try-On

## Overview

The MCP Video Service is a FastAPI-based microservice that animates try-on images into short vertical video clips using the MiniMax API. It's designed to work as part of a larger virtual try-on system, taking composited try-on images and creating engaging video content for social media sharing.

## Features

- **Video Animation**: Convert static try-on images into dynamic video clips
- **Multiple Actions**: Support for "turn", "wave", and "walk" animations
- **Smart Caching**: Redis-based caching to improve performance and reduce API costs
- **Storyboard Generation**: Intelligent storyboard creation based on product attributes
- **Multi-Action Composition**: Combine multiple actions into a single video
- **User History**: Track and retrieve user's video generation history
- **Comprehensive Logging**: Structured JSON logging with telemetry
- **Error Handling**: Robust error handling with custom exceptions

## API Endpoints

### Core Endpoints

#### POST `/animate`
Animate a try-on image into a short vertical clip.

**Request Body:**
```json
{
  "user_id": "demo_user",
  "image_url": "https://example.com/tryon.jpg",
  "action": "turn",
  "duration_s": 4,
  "aspect": "9:16"
}
```

**Response:**
```json
{
  "video_url": "https://example.com/video.mp4",
  "captions": ["Turn to show fit"],
  "latency_ms": 2100
}
```

#### POST `/storyboard`
Create a storyboard for video animation based on product attributes.

**Request Body:**
```json
{
  "image_url": "https://example.com/tryon.jpg",
  "product_attrs": {
    "type": "hoodie",
    "color": "black",
    "style": "casual"
  }
}
```

**Response:**
```json
{
  "beats": ["turn", "wave", "close_up"],
  "copy": "Show off your new look with style!"
}
```

#### POST `/compose`
Compose a video with multiple actions.

**Request Body:**
```json
{
  "user_id": "demo_user",
  "image_url": "https://example.com/tryon.jpg",
  "actions": ["turn", "wave"],
  "aspect": "9:16"
}
```

### Utility Endpoints

- `GET /health` - Health check with Redis status
- `GET /history/{user_id}` - Get user's video generation history
- `GET /last-video/{user_id}` - Get user's last generated video
- `GET /metrics` - Service metrics and telemetry data

## Configuration

The service uses environment variables for configuration:

### Required
- `MINIMAX_API_KEY` - MiniMax API key for video generation

### Optional
- `MINIMAX_BASE_URL` - MiniMax API base URL (default: https://api.minimax.chat/v1)
- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379/0)
- `BASE_ASSET_URL` - Base URL for serving assets (default: http://localhost:8002/assets)
- `LOG_LEVEL` - Logging level (default: INFO)
- `ANTHROPIC_API_KEY` - Optional Anthropic API key for enhanced features

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
export MINIMAX_API_KEY="your_minimax_api_key"
export REDIS_URL="redis://localhost:6379/0"
```

3. Start Redis (if running locally):
```bash
redis-server
```

4. Run the service:
```bash
uvicorn app:app --host 0.0.0.0 --port 8002 --reload
```

## Docker Support

Build and run with Docker:

```bash
docker build -t mcp-video .
docker run -p 8002:8002 -e MINIMAX_API_KEY=your_key mcp-video
```

## Architecture

### Components

- **FastAPI App** (`app.py`) - Main application with API endpoints
- **MiniMax Client** (`minimax_client.py`) - Integration with MiniMax video generation API
- **Redis Client** (`redis_client.py`) - Caching and session management
- **Configuration** (`config.py`) - Environment-based configuration management
- **Logging** (`logging_config.py`) - Structured logging and telemetry
- **Exceptions** (`exceptions.py`) - Custom exception classes

### Data Flow

1. Client sends animation request
2. Service checks Redis cache for existing video
3. If cache miss, calls MiniMax API for video generation
4. Polls MiniMax for completion (async video generation)
5. Caches result in Redis and adds to user history
6. Returns video URL and metadata

### Caching Strategy

- **Video Cache**: Cache generated videos by `(user_id, image_url, action, duration)` hash
- **User Sessions**: Store current user context and preferences
- **History**: Maintain last 20 video generations per user
- **TTL**: Configurable cache expiration (default: 1 hour for videos)

## Error Handling

The service includes comprehensive error handling:

- **Custom Exceptions**: Specific exception types for different error scenarios
- **HTTP Status Mapping**: Appropriate HTTP status codes for different errors
- **Structured Logging**: All errors logged with context and stack traces
- **Telemetry**: Error metrics collected for monitoring

## Monitoring

### Metrics Available

- Request counts by action type
- Average latency by endpoint
- Cache hit rates
- Error counts and types
- User activity patterns

### Health Checks

The `/health` endpoint provides:
- Service status
- Redis connectivity
- Version information
- Timestamp

## Development

### Running Tests

```bash
pytest tests/
```

### Code Style

```bash
black mcp_video/
flake8 mcp_video/
```

### Environment Setup

Create a `.env` file:
```
MINIMAX_API_KEY=your_minimax_api_key
REDIS_URL=redis://localhost:6379/0
LOG_LEVEL=DEBUG
```

## Integration

This service is designed to work with:

- **MCP-A (VTON Service)**: Receives try-on images from the virtual try-on service
- **Chrome Extension**: Provides video generation capabilities to browser extension
- **Redis**: Shared caching and session management
- **MiniMax API**: Video generation backend

## Limitations

- Video generation is limited to 3-6 seconds duration
- Supports only vertical (9:16) aspect ratio by default
- Requires stable internet connection for MiniMax API calls
- Cache storage depends on Redis availability

## Support

For issues and questions:
1. Check the logs for detailed error information
2. Verify MiniMax API key and Redis connectivity
3. Review the `/metrics` endpoint for service health
4. Check Redis cache status via `/health` endpoint
