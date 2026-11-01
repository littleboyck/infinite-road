#!/usr/bin/env python3
"""静态服务器（开发用）：强制 no-store，避免浏览器缓存旧 JS 模块。

python3 viaduct_web/serve.py 8777
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):  # 安静一点
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    handler = partial(NoCacheHandler, directory=str(ROOT))
    with ThreadingHTTPServer(('127.0.0.1', port), handler) as httpd:
        print(f'serving {ROOT} at http://127.0.0.1:{port}/  (no-store)')
        httpd.serve_forever()


if __name__ == '__main__':
    main()
