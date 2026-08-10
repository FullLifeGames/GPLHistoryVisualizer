"""Local dev server with caching disabled.

`python -m http.server` sends Last-Modified without Cache-Control, so browsers
apply heuristic freshness and keep serving stale ES modules after edits —
edited app code then appears not to take effect until a hard reload. This
wrapper sends `Cache-Control: no-store` on every response so a plain reload
always picks up the current files.

Usage: python scripts/serve.py [port]  (default 8000, serves the repo root)
"""

from __future__ import annotations

import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoStoreHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = HTTPServer(("127.0.0.1", port), NoStoreHandler)
    print(f"Serving on http://127.0.0.1:{port}/web/index.html (Cache-Control: no-store)")
    server.serve_forever()


if __name__ == "__main__":
    main()
