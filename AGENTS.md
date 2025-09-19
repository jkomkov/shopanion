# Agent Implementation Guide

**Technical specifications for the Virtual Try-On + Video Generation platform.**

---

## 🤖 Agent Responsibilities

| Agent Role | Owner | Directory | Tech Stack | Key Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **MCP-A (Try-On)** | Codex Agent | `mcp_vton/` | FastAPI, Redis, LlamaIndex | Image generation, caching, recommendations |
| **MCP-B (Video)** | Augment Code | `mcp_video/` | FastAPI, MiniMax API | Video animation, storyboarding, composition |
| **Extension** | Chrome Dev | `extension/` | Chrome MV3, JS | UI injection, service orchestration, user profile |

---

## 🔌 API Contracts

### MCP-A (Try-On Service) - Port `8001`

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/try_on` | `POST` | Generates a virtual try-on image from a person and a garment. |
| `/remember_interaction` | `POST` | Stores a user's preference (`like`/`dislike`) for an item. |
| `/recommend` | `GET` | Recommends similar items based on user history. |

<details>
<summary>View MCP-A Payloads</summary>

**`/try_on` Request**
```json
{
  "user_id": "string",
  "selfie_url": "string",
  "product_image_url": "string",
  "product_url": "string (optional)"
}
```
**`/try_on` Response**
```json
{
  "image_url": "string",
  "attrs": {"color": "black", "type": "hoodie"},
  "latency_ms": 950,
  "cache_hit": true
}
```

**`/remember_interaction` Request**
```json
{
  "user_id": "string",
  "product_attrs": "object",
  "verdict": "like | dislike"
}
```

**`/recommend` Response**
```json
{
  "items": [{"title": "...", "image_url": "...", "product_url": "...", "attrs": "{...}"}],
  "latency_ms": 450
}
```
</details>

### MCP-B (Video Service) - Port `8002`

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/animate` | `POST` | Creates a single-action video from a try-on image. |
| `/storyboard`| `POST` | Suggests a sequence of actions for a given product. |
| `/compose` | `POST` | Composes a multi-action video from a try-on image. |

<details>
<summary>View MCP-B Payloads</summary>

**`/animate` Request**
```json
{
  "user_id": "string",
  "image_url": "string",
  "action": "turn | wave | walk",
  "duration_s": 4,
  "aspect": "9:16"
}
```
**`/animate` Response**
```json
{
  "video_url": "string",
  "captions": ["Turn to show fit"],
  "latency_ms": 2100
}
```
**`/storyboard` Request**
```json
{
  "image_url": "string",
  "product_attrs": "object"
}
```
**`/storyboard` Response**
```json
{
  "beats": ["turn", "wave", "close_up"],
  "copy": "Showcase the perfect fit..."
}
```
**`/compose` Request**
```json
{
  "user_id": "string",
  "image_url": "string",
  "actions": ["turn", "wave"],
  "aspect": "9:16"
}
```
</details>

---

## 🏗️ System Architecture

### Service Communication Flow
```
Chrome Extension
    │
    ├─> (product context, selfie) ──> MCP-A (Try-On)
    │                                    │
    └<─ (try-on image) ──────────────<───┘
    │
    ├─> (try-on image) ────────────> MCP-B (Video)
    │                                    │
    └<─ (animated video) ───────────<───┘
```

### Data & Caching
- **Redis (L1 Cache)**: `sess:<uid>`, `hist:<uid>`, `last_image:<uid>`, `tryon:<uid>:<hash>` for session data and history.
- **LlamaIndex (Memory)**: Indexes product attributes (`color`, `category`, `style`) from liked items for semantic recommendation queries.
- **File System (L2 Cache)**: Caches generated images and videos to reduce redundant AI calls.

---

## 🚀 Development & Deployment

### Local Setup
1.  **Prerequisites**: `Python 3.10+`, `Redis`, `Node.js`.
2.  **Environment**: Create a `.env` file with `GEMINI_API_KEY` and `MINIMAX_API_KEY`.
3.  **Install Dependencies**: `brew install uv` then `uv pip install -r requirements.txt` in each service directory.
4.  **Run Services**:
    ```bash
    # Terminal 1: Start Redis
    redis-server

    # Terminal 2: Start MCP-A (Try-On)
    cd mcp_vton/ && uv run --env-file .env uvicorn app:app --reload --port 8001

    # Terminal 3: Start MCP-B (Video)
    cd mcp_video/ && uvicorn app:app --reload --port 8002

    # Terminal 4: Load Chrome Extension from /extension
    ```

### Dockerization
Each service includes a `Dockerfile` for containerized deployment.
```dockerfile
FROM python:3.10-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0"]
```

---

## 📊 Performance & Security

### Performance Targets
- **Try-On Latency**: `<2s` (cached), `<5s` (fresh)
- **Video Latency**: `<10s` for a 4-6s clip
- **Cache Hit Rate**: `>80%` for popular items

### Security
- **Data Handling**: No PII is stored; only opaque `user_id` handles and URLs.
- **API Security**: API key validation, strict input validation (Pydantic), and rate limiting.
- **Privacy**: Configurable TTL policies for all stored data.

---

## 🔧 Build Plan

### Phase 1: Core Try-On
- [ ] MCP-A: FastAPI skeleton, Redis connection, `/try_on` endpoint.
- [ ] Extension: Product detection and basic UI injection.

### Phase 2: Video Generation
- [ ] MCP-B: FastAPI skeleton, MiniMax integration, `/animate` endpoint.
- [ ] Extension: Video preview and download functionality.

### Phase 3: Memory & Recommendations
- [ ] MCP-A: LlamaIndex setup, `/remember_interaction` and `/recommend` endpoints.
- [ ] Extension: User preference tracking and recommendation UI.

### Phase 4: Polish & Demo
- [ ] All: Performance tuning, caching optimization, and comprehensive error handling.
