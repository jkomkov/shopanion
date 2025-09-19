# Agent Implementation Guide

**Technical implementation details for the Virtual Try-On + Video Generation Platform**

## 🤖 Agent Ownership & Responsibilities

### Codex Agent - MCP-A (VTON Try-On Service)
- **Location**: `mcp_vton/` directory
- **Tech Stack**: Python FastAPI + Redis + LlamaIndex
- **Integration**: Existing `vton/vton_gemini.py` code
- **Endpoints**: `/try_on`, `/remember_interaction`, `/recommend`
- **Responsibilities**:
  - Virtual try-on image generation
  - Redis caching layer for performance
  - LlamaIndex pipeline for style recommendations
  - Product attribute normalization

### Augment Code Agent - MCP-B (MiniMax Video Service)
- **Location**: `mcp_video/` directory
- **Tech Stack**: Python FastAPI + MiniMax API
- **Endpoints**: `/animate`, `/storyboard`, `/compose`
- **Responsibilities**:
  - Video generation from try-on images
  - Action-based animation (turn, wave, walk)
  - 9:16 vertical format optimization
  - Multi-segment video composition

### Chrome Extension Developer
- **Location**: `extension/` directory
- **Tech Stack**: Chrome MV3, Content Scripts, Background Service
- **Responsibilities**:
  - Product page detection and UI injection
  - Service orchestration (MCP-A → MCP-B flow)
  - User profile and settings management
  - Download/share functionality

## 📋 API Contracts

### MCP-A (Try-On Service) - Port 8001

#### POST `/try_on`
```json
{
  "user_id": "string",
  "selfie_url": "string",
  "product_image_url": "string",
  "product_url": "string (optional)",
  "options": "object (optional)"
}
```
**Response:**
```json
{
  "image_url": "string",
  "attrs": {"color": "black", "type": "hoodie"},
  "latency_ms": 950,
  "cache_hit": true
}
```

#### POST `/remember_interaction`
```json
{
  "user_id": "string",
  "product_attrs": "object",
  "verdict": "like | dislike"
}
```

#### GET `/recommend?user_id=string&hint=string`
**Response:**
```json
{
  "items": [
    {
      "title": "string",
      "image_url": "string",
      "product_url": "string",
      "attrs": "object"
    }
  ],
  "latency_ms": 450
}
```

### MCP-B (Video Service) - Port 8002

#### POST `/animate`
```json
{
  "user_id": "string",
  "image_url": "string",
  "action": "turn | wave | walk",
  "duration_s": 4,
  "aspect": "9:16"
}
```
**Response:**
```json
{
  "video_url": "string",
  "captions": ["Turn to show fit"],
  "latency_ms": 2100
}
```

#### POST `/storyboard`
```json
{
  "image_url": "string",
  "product_attrs": "object"
}
```
**Response:**
```json
{
  "beats": ["turn", "wave", "close_up"],
  "copy": "Showcase the perfect fit with these dynamic movements"
}
```

#### POST `/compose`
```json
{
  "user_id": "string",
  "image_url": "string",
  "actions": ["turn", "wave"],
  "aspect": "9:16"
}
```

## 🗄️ Data Architecture

### Redis Keys Structure
```
sess:<uid>          # Current product context
hist:<uid>          # Last 20 try-ons (most-recent first)
last_image:<uid>    # Latest try-on image URL
tryon:<uid>:<hash>  # Cached composite image metadata
```

### LlamaIndex Documents
- **Content**: Product attributes for tried/liked items
- **Query Pattern**: "similar to my liked black hoodies" → return candidates
- **Indexing**: Color, category, brand, style attributes

## 🏗️ Implementation Architecture

### Service Communication Flow
```
Chrome Extension
    ↓ (product context + selfie)
MCP-A Try-On Service
    ↓ (try-on image + metadata)
MCP-B Video Service
    ↓ (animated video)
Chrome Extension (display/download)
```

### Caching Strategy
- **L1**: Redis for session data and recent try-ons
- **L2**: File system cache for generated images
- **L3**: CDN for static assets and popular combinations
- **Cache Keys**: `(user_id, product_url_hash)` for deterministic lookup

### Error Handling & Fallbacks
- **Product Detection**: OG tags → Claude normalization → manual fallback
- **Try-On Generation**: Cached samples for demo/failure cases
- **Video Generation**: Pre-rendered clips for latency issues
- **Recommendations**: Popular items when no user history

## 🚀 Development Environment

### Prerequisites
```bash
# System requirements
Python 3.10+
Redis server
Node.js (for extension development)

# API Keys needed
GEMINI_API_KEY          # For try-on generation
MINIMAX_API_KEY         # For video generation
ANTHROPIC_API_KEY       # Optional, for attribute parsing
```

### Environment Variables
```bash
REDIS_URL=redis://localhost:6379/0
ASSET_ROOT=./data
GEMINI_API_KEY=your_key_here
MINIMAX_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

### Local Development Setup
```bash
# Install UV package manager
brew install uv

# Start Redis
redis-server

# MCP-A Service (Terminal 1)
cd mcp_vton/
uv pip install -r requirements.txt
uv run --env-file .env uvicorn app:app --reload --port 8001

# MCP-B Service (Terminal 2)
cd mcp_video/
uvicorn app:app --reload --port 8002

# Chrome Extension (Terminal 3)
cd extension/
# Load unpacked extension in Chrome Developer Mode
```

## 📊 Performance Targets

### Latency Goals
- **Try-On Generation**: <2s (cached), <5s (fresh)
- **Video Generation**: <10s for 4-6s clips
- **Recommendations**: <500ms
- **Product Detection**: <100ms

### Caching Efficiency
- **Cache Hit Rate**: >80% for popular products
- **Memory Usage**: <100MB Redis per 1000 users
- **Storage**: <50MB per user for history

### Scaling Thresholds
- **Concurrent Users**: 1000+ per service instance
- **Daily Try-Ons**: 100K+ with horizontal scaling
- **Video Generation**: 10K+ daily with queue management

## 🔧 Build Order & Milestones

### Phase 1: Core Try-On (Day 1)
- [ ] MCP-A FastAPI skeleton with health check
- [ ] Redis connection and basic caching
- [ ] `/try_on` endpoint with Gemini integration
- [ ] Chrome extension product detection
- [ ] Basic UI injection and API calls

### Phase 2: Video Generation (Day 2)
- [ ] MCP-B FastAPI skeleton
- [ ] MiniMax API integration
- [ ] `/animate` endpoint with "turn" action
- [ ] Extension video preview and download
- [ ] Error handling and fallbacks

### Phase 3: Memory & Recommendations (Day 3)
- [ ] LlamaIndex setup and document indexing
- [ ] `/remember_interaction` and `/recommend` endpoints
- [ ] User preference tracking in extension
- [ ] Recommendation UI and flow

### Phase 4: Polish & Demo (Day 4)
- [ ] Performance optimization and caching
- [ ] Demo data and fallback assets
- [ ] Comprehensive error handling
- [ ] Demo script and presentation materials

## 🛡️ Security & Privacy

### Data Handling
- **Minimal Storage**: Only URLs and derived attributes
- **User Privacy**: Opaque user_id handles, no PII
- **TTL Policies**: Configurable data expiration
- **Rate Limiting**: Per-user and per-IP protection

### API Security
- **Authentication**: API key validation
- **Input Validation**: Strict schema enforcement
- **CORS**: Proper cross-origin configuration
- **Logging**: Security events and anomaly detection

## 📈 Monitoring & Telemetry

### Key Metrics
- **Request Latency**: P50, P95, P99 by endpoint
- **Cache Performance**: Hit rates, eviction patterns
- **Error Rates**: By service and error type
- **User Engagement**: Try-ons per session, video completion rates

### Logging Strategy
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "service": "mcp-a",
  "endpoint": "/try_on",
  "user_id_hash": "abc123",
  "latency_ms": 1250,
  "cache_hit": true,
  "error_code": null
}
```

## 🚀 Deployment & Operations

### Container Strategy
```dockerfile
# Each service gets its own container
FROM python:3.10-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0"]
```

### Infrastructure Requirements
- **Compute**: 2 CPU, 4GB RAM per service instance
- **Storage**: Redis cluster, S3 for assets
- **Network**: Load balancer with health checks
- **Monitoring**: Prometheus + Grafana stack

---

*This guide provides the technical foundation for building a production-ready virtual try-on platform with distributed MCP services.*
