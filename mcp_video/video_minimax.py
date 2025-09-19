#!/usr/bin/env python3
"""
Quick video generation test script.

Takes a VTON result image and sends it to the MiniMax video service
to generate a slow, clear movement video.

Defaults:
  image: ./vton_result_swift_banana.png
  action: turn (slow rotation to show the outfit clearly)
  duration: 5 seconds
  output: ./data/videos/

Usage:
  python generate_video.py
  python generate_video.py --image ./vton_result_swift_banana.png --action turn --duration 5
  python generate_video.py --action wave --duration 4
"""

import argparse
import asyncio
import json
import time
from pathlib import Path
from datetime import datetime
import httpx
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MCP Video service configuration
VIDEO_SERVICE_URL = "http://localhost:8002"

async def upload_image_to_temp_url(image_path: Path) -> str:
    """
    For demo purposes, we'll use a placeholder URL.
    In a real implementation, you'd upload to a cloud storage service.
    """
    # For now, return a placeholder URL
    # In production, you'd upload to S3, Cloudinary, etc.
    return f"https://placeholder.com/images/{image_path.name}"

async def generate_video(image_path: Path, action: str = "turn", duration: int = 5, user_id: str = "demo_user"):
    """Generate video using MiniMax service"""
    
    print(f"🎬 Generating video from {image_path}")
    print(f"   Action: {action}")
    print(f"   Duration: {duration}s")
    print(f"   User ID: {user_id}")
    print()
    
    # Check if image exists
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")
    
    # For demo, we'll use the local file path as URL
    # In production, you'd upload to cloud storage first
    image_url = f"file://{image_path.absolute()}"
    
    # Prepare request payload
    payload = {
        "user_id": user_id,
        "image_url": image_url,
        "action": action,
        "duration_s": duration,
        "aspect": "9:16"
    }
    
    print(f"📡 Sending request to {VIDEO_SERVICE_URL}/animate")
    print(f"   Payload: {json.dumps(payload, indent=2)}")
    print()
    
    start_time = time.time()
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            # Send animation request
            response = await client.post(
                f"{VIDEO_SERVICE_URL}/animate",
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                elapsed = time.time() - start_time
                
                print("✅ Video generation successful!")
                print(f"   Video URL: {result.get('video_url')}")
                print(f"   Captions: {result.get('captions')}")
                print(f"   Service Latency: {result.get('latency_ms')}ms")
                print(f"   Total Time: {elapsed:.2f}s")
                print(f"   Cache Hit: {result.get('cache_hit', False)}")
                
                return result
                
            else:
                error_detail = response.text
                print(f"❌ Video generation failed: {response.status_code}")
                print(f"   Error: {error_detail}")
                return None
                
        except httpx.ConnectError:
            print("❌ Could not connect to MCP Video service")
            print(f"   Make sure the service is running at {VIDEO_SERVICE_URL}")
            print("   Run: cd mcp_video && uv run python main.py")
            return None
        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")
            return None

async def test_service_health():
    """Test if the video service is running"""
    print("🏥 Checking MCP Video service health...")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{VIDEO_SERVICE_URL}/health")
            if response.status_code == 200:
                health_data = response.json()
                print("✅ Service is healthy")
                print(f"   Status: {health_data.get('status')}")
                print(f"   Redis: {health_data.get('redis')}")
                print(f"   Version: {health_data.get('version')}")
                return True
            else:
                print(f"⚠️  Service responded with status {response.status_code}")
                return False
        except httpx.ConnectError:
            print("❌ Service is not running")
            print(f"   Start it with: cd mcp_video && uv run python main.py")
            return False
        except Exception as e:
            print(f"❌ Health check failed: {str(e)}")
            return False

async def create_storyboard(image_path: Path):
    """Create a storyboard for the video"""
    print("📋 Creating storyboard...")
    
    # Infer product attributes from filename
    product_attrs = {
        "type": "clothing",
        "style": "casual"
    }
    
    # Try to infer more from filename
    filename = image_path.stem.lower()
    if "swift" in filename:
        product_attrs["celebrity"] = "taylor_swift"
    if "banana" in filename:
        product_attrs["color"] = "yellow"
        product_attrs["type"] = "top"
    
    payload = {
        "image_url": f"file://{image_path.absolute()}",
        "product_attrs": product_attrs
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{VIDEO_SERVICE_URL}/storyboard",
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                print("✅ Storyboard created")
                print(f"   Beats: {result.get('beats')}")
                print(f"   Copy: {result.get('copy')}")
                return result
            else:
                print(f"⚠️  Storyboard creation failed: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Storyboard creation error: {str(e)}")
            return None

def main():
    parser = argparse.ArgumentParser(description="Generate video from VTON result")
    parser.add_argument(
        "--image", 
        default="vton_result_swift_banana.png", 
        help="Path to VTON result image"
    )
    parser.add_argument(
        "--action", 
        choices=["turn", "wave", "walk"], 
        default="turn",
        help="Action for the video (turn=slow rotation, wave=friendly gesture, walk=natural movement)"
    )
    parser.add_argument(
        "--duration", 
        type=int, 
        default=5, 
        help="Video duration in seconds (3-6)"
    )
    parser.add_argument(
        "--user-id", 
        default="demo_user",
        help="User ID for the request"
    )
    parser.add_argument(
        "--storyboard", 
        action="store_true",
        help="Create a storyboard first"
    )
    parser.add_argument(
        "--skip-health", 
        action="store_true",
        help="Skip health check"
    )
    
    args = parser.parse_args()
    
    # Validate duration
    if not (3 <= args.duration <= 6):
        print("❌ Duration must be between 3 and 6 seconds")
        return
    
    image_path = Path(args.image)
    
    print("🎬 MCP Video Generation Test")
    print("=" * 40)
    print(f"Image: {image_path}")
    print(f"Action: {args.action}")
    print(f"Duration: {args.duration}s")
    print(f"User ID: {args.user_id}")
    print()
    
    async def run_test():
        # Health check
        if not args.skip_health:
            healthy = await test_service_health()
            if not healthy:
                return
            print()
        
        # Optional storyboard
        if args.storyboard:
            await create_storyboard(image_path)
            print()
        
        # Generate video
        result = await generate_video(
            image_path=image_path,
            action=args.action,
            duration=args.duration,
            user_id=args.user_id
        )
        
        if result:
            print()
            print("🎉 Video generation completed successfully!")
            print("   The video URL would be available for download in a real implementation.")
        else:
            print()
            print("❌ Video generation failed. Check the service logs for details.")
    
    # Run the async function
    asyncio.run(run_test())

if __name__ == "__main__":
    main()
