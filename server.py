#!/usr/bin/env python3
"""Local preview server for the static Ghost Forest Atlas.

Serves the web/ folder with HTTP range-request support (PMTiles fetches byte
ranges) and no-cache headers (so edits show on reload). This is ONLY for local
preview — for deployment the web/ folder is served directly by GitHub Pages /
Cloudflare Pages, which support range requests natively. No server runs there.

Run:  python3 server.py [port]      (default 8011)
"""
import http.server
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8011


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_GET(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        m = re.match(r"bytes=(\d+)-(\d*)", rng or "")
        if not rng or not m or not os.path.isfile(path):
            return super().do_GET()  # normal full-file response
        size = os.path.getsize(path)
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416)
            return
        length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            self.wfile.write(f.read(length))

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"Ghost Forest Atlas (local preview) -> http://127.0.0.1:{PORT}/")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
