#!/usr/bin/env python3
"""
Main entry point for MCP Video Service
This file handles the import issues by setting up the Python path correctly
"""

import sys
import os
from pathlib import Path

# Add the current directory to Python path to enable absolute imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Load environment from root .env file
root_env_file = current_dir.parent / ".env"
if root_env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(root_env_file)
    print(f"✅ Loaded environment from {root_env_file}")

# Now import and run the app
if __name__ == "__main__":
    import uvicorn
    
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
