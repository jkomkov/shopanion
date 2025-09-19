import os
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

import httpx
from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.staticfiles import StaticFiles
from PIL import Image
from google import genai
from google.genai import types as genai_types
import redis
from bs4 import BeautifulSoup


# --------- Config ---------

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
ASSET_ROOT = Path(os.environ.get("ASSET_ROOT", "data"))
TRYON_DIR = ASSET_ROOT / "tryon"
ASPECT_DEFAULT = "9:16"
DEMO_MODE = os.environ.get("DEMO_MODE", "0").lower() in {"1", "true", "yes", "on"}

GOOGLE_API_KEY = (
    os.environ.get("GOOGLE_API_KEY")
    or os.environ.get("GOOGLE_GENAI_API_KEY")
    or os.environ.get("GEMINI_API_KEY")
    or os.environ.get("GENAI_API_KEY")
    or os.environ.get("API_KEY")
)
GENAI_MODEL = os.environ.get("GENAI_MODEL", "gemini-2.5-flash-image-preview")

ALLOWED_ORIGINS = os.environ.get("CORS_ALLOW_ORIGINS", "*").split(",")


# --------- FastAPI App ---------

app = FastAPI(title="MCP-A VTON Try-On", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directories exist and mount /static to ASSET_ROOT
TRYON_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(ASSET_ROOT)), name="static")


# --------- Utilities ---------

def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


def _build_prompt() -> str:
    return (
        "You are a virtual try-on assistant. Using the first image as the person "
        "(preserve identity, pose, lighting, and background) and the second image as the garment, "
        "compose a realistic, high-quality image of the person wearing the garment. "
        "Respect garment texture, color, and prints; adapt folds and fit naturally. "
        "Avoid altering the person's face, hair, or background beyond what is necessary for realism. "
        "Return only the final composed image."
    )


def _guess_ext_from_mime(mime: str) -> str:
    mime = (mime or "").lower()
    if mime in ("image/jpg", "image/jpeg"):
        return ".jpg"
    if mime == "image/webp":
        return ".webp"
    if mime == "image/bmp":
        return ".bmp"
    return ".png"


async def _fetch_bytes(url: str) -> tuple[bytes, Optional[str]]:
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        mime = resp.headers.get("Content-Type")
        return resp.content, mime


async def _parse_product_page_for_image(url: str) -> Optional[str]:
    if BeautifulSoup is None:
        return None
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            html = r.text
        soup = BeautifulSoup(html, "lxml")
        # Try standard OG tags first
        og = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
        if og and og.get("content"):
            return og.get("content")
        # Fallback to largest image in the page
        best = None
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if not src:
                continue
            best = src
        return best
    except Exception:
        return None


def _extract_attrs_from_text(text: str) -> Dict[str, Any]:
    text_l = text.lower()
    attrs: Dict[str, Any] = {}
    # Naive color extraction
    colors = [
        "black",
        "white",
        "red",
        "blue",
        "green",
        "yellow",
        "brown",
        "gray",
        "grey",
        "beige",
        "tan",
        "pink",
        "orange",
        "purple",
        "navy",
        "maroon",
        "olive",
    ]
    for c in colors:
        if re.search(rf"\b{re.escape(c)}\b", text_l):
            attrs["color"] = c
            break

    # Naive type extraction
    types = [
        "hoodie",
        "sweater",
        "t-shirt",
        "shirt",
        "jacket",
        "coat",
        "blouse",
        "top",
    ]
    for t in types:
        if t in text_l:
            attrs["type"] = t
            break

    # Brand-like token
    m = re.search(r"brand[:\s]+([A-Za-z0-9'&-]{2,})", text, re.IGNORECASE)
    if m:
        attrs["brand"] = m.group(1)

    return attrs


_MEM_STORE: dict[str, Any] = {}


class MemoryRedis:
    def __init__(self):
        self.store: dict[str, Any] = _MEM_STORE

    # String ops
    def get(self, key: str):
        return self.store.get(key)

    def set(self, key: str, value: Any):
        self.store[key] = value
        return True

    def setex(self, key: str, ttl_seconds: int, value: Any):
        # TTL ignored in demo; store immediately
        self.store[key] = value
        return True

    # List ops
    def lpush(self, key: str, value: Any):
        lst = self.store.setdefault(key, [])
        if not isinstance(lst, list):
            lst = []
        lst.insert(0, value)
        self.store[key] = lst
        return len(lst)

    def ltrim(self, key: str, start: int, end: int):
        lst = self.store.get(key, [])
        if isinstance(lst, list):
            self.store[key] = lst[start : end + 1]
        return True

    def lrange(self, key: str, start: int, end: int):
        lst = self.store.get(key, [])
        if not isinstance(lst, list):
            return []
        if end == -1:
            end = len(lst) - 1
        return lst[start : end + 1]


def _redis_client():
    if REDIS_URL.startswith("memory://"):
        return MemoryRedis()
    return redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _genai_client():
    if not GOOGLE_API_KEY:
        raise RuntimeError("Missing GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY in environment")
    return genai.Client(api_key=GOOGLE_API_KEY)


def _save_image_bytes(data: bytes, mime: Optional[str]) -> str:
    ext = _guess_ext_from_mime(mime or "image/png")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = f"tryon_{ts}"
    out_path = TRYON_DIR / f"{base}{ext}"
    TRYON_DIR.mkdir(parents=True, exist_ok=True)
    # Best-effort via PIL to normalize; if PIL missing or fails, raw write
    try:
        if Image is not None:
            from io import BytesIO

            im = Image.open(BytesIO(data))
            im.save(out_path)
        else:
            raise RuntimeError("PIL unavailable")
    except Exception:
        with open(out_path, "wb") as f:
            f.write(data)
    return str(out_path.relative_to(ASSET_ROOT))  # e.g., 'tryon/tryon_20240101_120000.png'


def _static_url_for(request: Request, rel_path: str) -> str:
    return str(request.url_for("static", path=rel_path))


# --------- Schemas ---------


class TryOnRequest(BaseModel):
    user_id: str
    selfie_url: str
    product_image_url: Optional[str] = None
    product_url: Optional[str] = None
    options: Optional[Dict[str, Any]] = None


class TryOnResponse(BaseModel):
    image_url: str
    attrs: Dict[str, Any] = Field(default_factory=dict)
    latency_ms: int
    cache_hit: bool = False


class RememberRequest(BaseModel):
    user_id: str
    product_attrs: Dict[str, Any]
    verdict: str  # "like" | "dislike"


class RememberResponse(BaseModel):
    ok: bool = True


class RecommendResponse(BaseModel):
    items: List[Dict[str, Any]]
    latency_ms: int


# --------- Routes ---------


@app.get("/")
async def root() -> Dict[str, Any]:
    return {"ok": True, "service": "vton-mcp", "version": "0.1.0"}


@app.post("/try_on", response_model=TryOnResponse)
async def try_on(request: Request, payload: TryOnRequest = Body(...)):
    import time

    t0 = time.time()
    r = _redis_client()

    # Determine cache key based on user and product
    prod_key_src = payload.product_url or payload.product_image_url or "unknown"
    prod_hash = _sha1(prod_key_src)
    cache_key = f"tryon:{payload.user_id}:{prod_hash}"

    cached = r.get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            image_url = _static_url_for(request, data["rel_path"]) if "rel_path" in data else data.get("image_url")
            latency_ms = int((time.time() - t0) * 1000)
            return TryOnResponse(
                image_url=image_url,
                attrs=data.get("attrs", {}),
                latency_ms=latency_ms,
                cache_hit=True,
            )
        except Exception:
            pass  # ignore and recompute

    # Resolve product image URL
    product_img_url = payload.product_image_url
    if not product_img_url and payload.product_url:
        product_img_url = await _parse_product_page_for_image(payload.product_url)
    if not product_img_url:
        raise HTTPException(status_code=400, detail="Missing product_image_url or resolvable product_url")

    # Download images
    selfie_bytes, selfie_mime = await _fetch_bytes(payload.selfie_url)
    garment_bytes, garment_mime = await _fetch_bytes(product_img_url)

    # Call Google GenAI (Gemini) for image composition
    saved_rel: Optional[str] = None
    attrs: Dict[str, Any] = {}
    # Attributes heuristic from URL text
    text_hint = (payload.product_url or payload.product_image_url or "")
    attrs.update(_extract_attrs_from_text(text_hint))

    # If demo mode or no API key, do a simple local composite
    if DEMO_MODE or not GOOGLE_API_KEY:
        try:
            from io import BytesIO

            base_im = Image.open(BytesIO(selfie_bytes)).convert("RGBA")
            gar_im = Image.open(BytesIO(garment_bytes)).convert("RGBA")
            # Resize garment to ~35% width of selfie
            gw = int(base_im.width * 0.35)
            gh = int(gar_im.height * (gw / gar_im.width))
            gar_im = gar_im.resize((gw, gh))
            # Paste bottom-right with slight padding
            padding = int(min(base_im.width, base_im.height) * 0.02)
            x = max(padding, base_im.width - gw - padding)
            y = max(padding, base_im.height - gh - padding)
            composite = base_im.copy()
            composite.alpha_composite(gar_im, (x, y))
            buf = BytesIO()
            composite.convert("RGB").save(buf, format="PNG")
            saved_rel = _save_image_bytes(buf.getvalue(), "image/png")
        except Exception:
            # Fallback: just save the selfie
            saved_rel = _save_image_bytes(selfie_bytes, selfie_mime or "image/jpeg")
    else:
        client = _genai_client()

        person_part = genai_types.Part.from_bytes(data=selfie_bytes, mime_type=selfie_mime or "image/jpeg")
        garment_part = genai_types.Part.from_bytes(data=garment_bytes, mime_type=garment_mime or "image/jpeg")
        prompt = _build_prompt()

        try:
            resp = client.models.generate_content(
                model=GENAI_MODEL,
                contents=[person_part, garment_part, prompt],
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"GenAI error: {e}")

        parts = []
        try:
            parts = resp.candidates[0].content.parts if resp.candidates and resp.candidates[0].content else []
        except Exception:
            parts = []
        if not parts:
            raise HTTPException(status_code=502, detail="No content returned from GenAI")

        for part in parts:
            txt = getattr(part, "text", None)
            if txt:
                continue
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                saved_rel = _save_image_bytes(inline.data, getattr(inline, "mime_type", None))
                break

        if not saved_rel:
            raise HTTPException(status_code=502, detail="GenAI returned no image parts")

    image_url = _static_url_for(request, saved_rel)

    # Cache record
    record = {"rel_path": saved_rel, "attrs": attrs, "ts": datetime.utcnow().isoformat()}
    r.setex(cache_key, 60 * 60 * 24, json.dumps(record))  # 24h TTL

    # History + last image
    r.lpush(f"hist:{payload.user_id}", json.dumps({
        "product": prod_key_src,
        "image_rel": saved_rel,
        "attrs": attrs,
        "ts": record["ts"],
    }))
    r.ltrim(f"hist:{payload.user_id}", 0, 19)
    r.set(f"last_image:{payload.user_id}", image_url)
    r.set(f"sess:{payload.user_id}", json.dumps({"product": prod_key_src}))

    latency_ms = int((time.time() - t0) * 1000)
    return TryOnResponse(image_url=image_url, attrs=attrs, latency_ms=latency_ms, cache_hit=False)


@app.post("/remember_interaction", response_model=RememberResponse)
async def remember_interaction(payload: RememberRequest = Body(...)):
    r = _redis_client()
    key = f"prefs:{payload.user_id}:{payload.verdict}"
    try:
        r.lpush(key, json.dumps(payload.product_attrs))
        r.ltrim(key, 0, 99)
        return RememberResponse(ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/recommend", response_model=RecommendResponse)
async def recommend(user_id: str, hint: Optional[str] = None):
    import time

    t0 = time.time()
    r = _redis_client()
    items: List[Dict[str, Any]] = []

    # Simple heuristic: use last liked item attrs if any; else last hist entries
    try:
        liked = r.lrange(f"prefs:{user_id}:like", 0, 10)
        target_color = None
        target_type = None
        for row in liked:
            try:
                attrs = json.loads(row)
            except Exception:
                continue
            if not target_color and isinstance(attrs, dict) and attrs.get("color"):
                target_color = attrs.get("color")
            if not target_type and isinstance(attrs, dict) and attrs.get("type"):
                target_type = attrs.get("type")
            if target_color and target_type:
                break

        # Build simple recs from history (pretend inventory)
        hist = r.lrange(f"hist:{user_id}", 0, 20)
        for row in hist:
            try:
                entry = json.loads(row)
            except Exception:
                continue
            attrs = entry.get("attrs", {})
            score = 0
            if target_color and attrs.get("color") == target_color:
                score += 1
            if target_type and attrs.get("type") == target_type:
                score += 1
            # Always include a couple
            items.append({
                "title": f"Similar {attrs.get('color', '')} {attrs.get('type', 'top')}".strip(),
                "image_url": r.get(f"last_image:{user_id}") or "",
                "product_url": entry.get("product"),
                "attrs": attrs,
                "score": score,
            })
        # Dedup by product_url
        seen = set()
        uniq: List[Dict[str, Any]] = []
        for it in sorted(items, key=lambda x: x.get("score", 0), reverse=True):
            key = it.get("product_url")
            if key in seen:
                continue
            seen.add(key)
            uniq.append(it)
            if len(uniq) >= 2:
                break
        items = uniq
    except Exception:
        items = []

    latency_ms = int((time.time() - t0) * 1000)
    return RecommendResponse(items=items, latency_ms=latency_ms)
