#!/usr/bin/env python3
"""
serve_local.py — fallback when a browser refuses scripts on file:// pages (RESEARCH ONLY).

    python3 -I serve_local.py [port]      # then open http://127.0.0.1:<port>/review.html

Serves this directory read-only on 127.0.0.1 only (never 0.0.0.0, never another interface), GET/HEAD only, no
directory listing, no upload. Pictures are still chosen with the page's file picker and never pass through it.
"""
import functools
import http.server
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(404)

    def do_POST(self):
        self.send_error(405)

    do_PUT = do_DELETE = do_PATCH = do_POST

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


def main(argv):
    port = int(argv[0]) if argv else 8765
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=HERE))
    assert httpd.server_address[0] == '127.0.0.1'
    print(f'http://127.0.0.1:{port}/review.html  (Ctrl+C stops; only this computer can connect)')
    httpd.serve_forever()


if __name__ == '__main__':
    main(sys.argv[1:])
