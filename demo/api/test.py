import os
import sys
import traceback
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# Add the current directory to path to find main.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Try to import the main app
try:
    from main import app
except Exception as e:
    # If main fails (e.g. missing env vars), create a dummy app that reports the error
    app = FastAPI()
    error_msg = traceback.format_exc()
    
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"])
    async def catch_all(path_name: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "FastAPI Initialization Failed",
                "detail": "The application failed to start. This is likely due to missing environment variables or dependencies.",
                "traceback": error_msg
            }
        )
