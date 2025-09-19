#!/usr/bin/env python3
import os
import sys
import re
import argparse
import mimetypes
from io import BytesIO
from datetime import datetime

try:
    from PIL import Image
except Exception as e:
    print("Pillow (PIL) is required. Install with: pip install pillow", file=sys.stderr)
    raise


def _load_dotenv_if_present(dotenv_path: str = ".env") -> None:
    """Lightweight .env loader supporting `export KEY=VAL` and quotes.

    Avoids requiring python-dotenv; only sets variables not already in os.environ.
    """
    if not os.path.exists(dotenv_path):
        return
    key_val_re = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$")
    key_val_colon_re = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)\s*$")
    try:
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                m = key_val_re.match(line) or key_val_colon_re.match(line)
                if not m:
                    continue
                key, val = m.group(1), m.group(2)
                # Remove inline comments for unquoted values
                if val and not (val.startswith("\"") or val.startswith("'")):
                    hash_pos = val.find(" #")
                    if hash_pos != -1:
                        val = val[:hash_pos]
                val = val.strip()
                # Strip surrounding quotes if present
                if (val.startswith("\"") and val.endswith("\"")) or (
                    val.startswith("'") and val.endswith("'")
                ):
                    val = val[1:-1]
                if key and key not in os.environ:
                    os.environ[key] = val
    except Exception:
        # Non-fatal; continue if parsing fails.
        pass


def _guess_mime(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    # Fallbacks for common image types
    if not mime:
        ext = os.path.splitext(path)[1].lower()
        if ext in [".png"]:
            return "image/png"
        if ext in [".jpg", ".jpeg"]:
            return "image/jpeg"
        if ext in [".webp"]:
            return "image/webp"
        if ext in [".bmp"]:
            return "image/bmp"
    return mime or "application/octet-stream"


def _ext_for_mime(mime: str) -> str:
    if mime == "image/png":
        return ".png"
    if mime in ("image/jpg", "image/jpeg"):
        return ".jpg"
    if mime == "image/webp":
        return ".webp"
    if mime == "image/bmp":
        return ".bmp"
    return ".bin"


def build_prompt() -> str:
    return (
        "You are a virtual try-on assistant. Using the first image as the person "
        "(preserve identity, pose, lighting, and background) and the second image as the garment, "
        "compose a realistic, high-quality image of the person wearing the garment. "
        "Respect garment texture, color, and prints; adapt folds and fit naturally. "
        "Avoid altering the person's face, hair, or background beyond what is necessary for realism. "
        "Return only the final composed image."
    )


def main():
    _load_dotenv_if_present()

    parser = argparse.ArgumentParser(description="Virtual try-on with Gemini (google-genai)")
    parser.add_argument("--person", default="taylor.png", help="Path to person image (default: taylor.png)")
    parser.add_argument("--garment", default="cloth.webp", help="Path to garment image (default: cloth.webp)")
    parser.add_argument("--model", default="gemini-2.5-flash-image-preview", help="Model name")
    parser.add_argument("--prompt", default=None, help="Optional custom prompt")
    parser.add_argument("--out", default=None, help="Output base filename (without extension)")
    args = parser.parse_args()

    api_key = (
        os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GOOGLE_GENAI_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GENAI_API_KEY")
        or os.environ.get("API_KEY")
    )
    if not api_key:
        print("Missing GOOGLE_API_KEY in environment. Ensure .env is set or export it.", file=sys.stderr)
        sys.exit(1)

    try:
        from google import genai
        from google.genai import types
    except Exception:
        print(
            "google-genai is required. Install with: pip install google-genai",
            file=sys.stderr,
        )
        raise

    if not os.path.exists(args.person):
        print(f"Person image not found: {args.person}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(args.garment):
        print(f"Garment image not found: {args.garment}", file=sys.stderr)
        sys.exit(1)

    with open(args.person, "rb") as f:
        person_bytes = f.read()
    with open(args.garment, "rb") as f:
        garment_bytes = f.read()

    person_mime = _guess_mime(args.person)
    garment_mime = _guess_mime(args.garment)

    # Build contents: person image, garment image, then prompt.
    prompt = args.prompt or build_prompt()

    person_part = types.Part.from_bytes(data=person_bytes, mime_type=person_mime)
    garment_part = types.Part.from_bytes(data=garment_bytes, mime_type=garment_mime)

    client = genai.Client(api_key=api_key)

    print(f"Calling model: {args.model} ...", file=sys.stderr)
    response = client.models.generate_content(
        model=args.model,
        contents=[person_part, garment_part, prompt],
    )

    # Prepare output base
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = args.out or f"vton_result_{ts}"

    # Collect and save any images; also print any text parts for transparency.
    saved = 0
    if not response.candidates:
        print("No candidates returned.", file=sys.stderr)
        sys.exit(2)

    parts = response.candidates[0].content.parts if response.candidates[0].content else []
    if not parts:
        print("No content parts in response.", file=sys.stderr)
        sys.exit(2)

    for i, part in enumerate(parts, start=1):
        # Textual guidance or commentary (rare for this model, but handle it)
        if getattr(part, "text", None):
            print(part.text)
            continue

        inline = getattr(part, "inline_data", None)
        if inline and getattr(inline, "data", None):
            mime = getattr(inline, "mime_type", None) or "image/png"
            ext = _ext_for_mime(mime)
            data = inline.data
            try:
                img = Image.open(BytesIO(data))
                out_path = f"{base}{ext}" if saved == 0 else f"{base}_{i}{ext}"
                img.save(out_path)
                print(f"Saved: {out_path}")
                saved += 1
            except Exception:
                # If PIL fails, dump raw bytes
                out_path = f"{base}_{i}.bin"
                with open(out_path, "wb") as f:
                    f.write(data)
                print(f"Saved raw bytes: {out_path}")

    if saved == 0:
        print("No images were returned by the model.", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
