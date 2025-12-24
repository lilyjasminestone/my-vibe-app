from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write('{"status": "GET works"}'.encode('utf-8'))
        return

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {
            "status": "POST works from test.py",
            "received_body": body.decode('utf-8'),
            "path": self.path
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
        return
