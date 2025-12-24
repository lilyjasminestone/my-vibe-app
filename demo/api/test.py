# Trojan Horse: Run FastAPI inside test.py to see if it works
import sys
import os
import traceback
from http.server import BaseHTTPRequestHandler
import json

# Add current directory to path just in case
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

try:
    from main import app
    # Vercel looks for 'app' variable for ASGI apps
except Exception as e:
    # If import fails, create a fallback handler to show the error
    error_msg = traceback.format_exc()
    
    class handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_error(200, error_msg)
        def do_POST(self):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": "FastAPI Import Failed",
                "details": error_msg,
                "cwd": os.getcwd(),
                "path": sys.path
            }).encode('utf-8'))
    
    # Expose handler for Vercel
    app = handler
