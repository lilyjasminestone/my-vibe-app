import os
import sys
import traceback

# Add the current directory to path to find main.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from main import app
except Exception as e:
    # If main fails, create a dummy app that returns the error
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI()
    
    error_msg = traceback.format_exc()
    
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"])
    async def catch_all(path_name: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to initialize FastAPI app",
                "traceback": error_msg
            }
        )
