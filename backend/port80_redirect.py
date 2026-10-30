import http.server
import socketserver
import sys

class RedirectHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(302)
        self.send_header("Location", f"http://localhost:3000{self.path}")
        self.end_headers()

    def do_POST(self):
        self.send_response(307)
        self.send_header("Location", f"http://localhost:3000{self.path}")
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("0.0.0.0", 80), RedirectHandler) as httpd:
            print("Port 80 redirecting to port 3000...", flush=True)
            httpd.serve_forever()
    except Exception as e:
        print(f"Failed to bind port 80: {e}", file=sys.stderr, flush=True)

