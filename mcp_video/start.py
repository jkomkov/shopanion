#!/usr/bin/env python3
"""
Startup script for MCP Video Service
"""

import os
import sys
import uvicorn
from pathlib import Path

def main():
    """Main startup function"""

    # Add current directory to Python path
    current_dir = Path(__file__).parent
    sys.path.insert(0, str(current_dir))

    # Load environment variables from root .env file
    root_env_file = current_dir.parent / ".env"
    if root_env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(root_env_file)
        print(f"✅ Loaded environment from {root_env_file}")
    else:
        print(f"⚠️  No .env file found at {root_env_file}")

    # Check for required environment variables
    required_env_vars = ["MINIMAX_API_KEY"]
    missing_vars = []

    for var in required_env_vars:
        if not os.getenv(var):
            missing_vars.append(var)

    if missing_vars:
        print("❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print(f"\nPlease add these variables to {root_env_file}")
        sys.exit(1)
    
    # Configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    print("🚀 Starting MCP Video Service...")
    print(f"   Host: {host}")
    print(f"   Port: {port}")
    print(f"   Reload: {reload}")
    print(f"   Log Level: {log_level}")
    print()
    
    # Start the server
    try:
        uvicorn.run(
            "app:app",
            host=host,
            port=port,
            reload=reload,
            log_level=log_level,
            access_log=True
        )
    except KeyboardInterrupt:
        print("\n👋 Shutting down MCP Video Service...")
    except Exception as e:
        print(f"❌ Failed to start service: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
