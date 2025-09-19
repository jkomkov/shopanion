#!/usr/bin/env python3
"""
UV-optimized startup script for MCP Video Service
"""

import os
import sys
import subprocess
from pathlib import Path

def check_uv():
    """Check if uv is installed"""
    try:
        subprocess.run(["uv", "--version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def setup_environment():
    """Set up the environment with uv"""
    print("🔧 Setting up environment with uv...")
    
    # Create virtual environment if it doesn't exist
    if not Path(".venv").exists():
        print("📦 Creating virtual environment...")
        subprocess.run(["uv", "venv"], check=True)
    
    # Install dependencies
    print("⬇️  Installing dependencies...")
    subprocess.run(["uv", "pip", "install", "-r", "requirements.txt"], check=True)
    
    print("✅ Environment setup complete!")

def check_env_vars():
    """Check for required environment variables"""
    # Load from root .env file
    root_env = Path(__file__).parent.parent / ".env"
    if root_env.exists():
        from dotenv import load_dotenv
        load_dotenv(root_env)
        print(f"✅ Loaded environment from {root_env}")
    else:
        print(f"⚠️  No .env file found at {root_env}")

    required_vars = ["MINIMAX_API_KEY"]
    missing_vars = []

    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)

    if missing_vars:
        print("❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print(f"\nPlease add these variables to {root_env}")
        return False

    return True

def check_redis():
    """Check if Redis is running"""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        print("✅ Redis is running")
        return True
    except Exception:
        print("⚠️  Redis not detected. Starting without Redis (some features may be limited)")
        return False

def main():
    """Main function"""
    print("🚀 MCP Video Service - UV Runner")
    print("=" * 40)
    
    # Check if uv is installed
    if not check_uv():
        print("❌ uv is not installed. Please install it first:")
        print("   curl -LsSf https://astral.sh/uv/install.sh | sh")
        sys.exit(1)
    
    # Setup environment
    setup_environment()
    
    # Check environment variables
    if not check_env_vars():
        sys.exit(1)
    
    # Check Redis (optional)
    check_redis()
    
    # Configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    print(f"🌐 Starting service at http://{host}:{port}")
    print(f"📊 Log level: {log_level}")
    print(f"🔄 Reload: {reload}")
    print()
    
    # Start the server with uv
    try:
        cmd = [
            "uv", "run", "uvicorn", "app:app",
            "--host", host,
            "--port", str(port),
            "--log-level", log_level
        ]
        
        if reload:
            cmd.append("--reload")
        
        subprocess.run(cmd, check=True)
        
    except KeyboardInterrupt:
        print("\n👋 Shutting down MCP Video Service...")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
