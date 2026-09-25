#!/usr/bin/env python3
"""Serve RANK / MOTION locally with no third-party dependencies."""

from __future__ import annotations

import argparse
import functools
import http.server
import pathlib
import threading
import webbrowser


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run RANK / MOTION locally.")
    parser.add_argument("--directory", default="dist", help="Directory to serve")
    parser.add_argument("--host", default="127.0.0.1", help="Server host")
    parser.add_argument("--port", type=int, default=8765, help="Server port")
    parser.add_argument("--open", action="store_true", help="Open the app in a browser")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    directory = pathlib.Path(args.directory).resolve()
    if not (directory / "index.html").is_file():
        raise SystemExit(f"index.html was not found in {directory}")

    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler,
        directory=str(directory),
    )
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    url = f"http://{args.host}:{args.port}/"

    print(f"RANK / MOTION is running at {url}")
    print("Press Control+C to stop.")
    if args.open:
        threading.Timer(0.35, webbrowser.open, args=(url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

