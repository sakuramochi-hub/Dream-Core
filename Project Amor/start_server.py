#!/usr/bin/env python3
"""Serve the game locally and open it in the default browser."""

from __future__ import annotations

import argparse
import http.server
import os
import socketserver
import subprocess
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
http.server.SimpleHTTPRequestHandler.extensions_map = {
    **http.server.SimpleHTTPRequestHandler.extensions_map,
    ".g8s": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
}


class GameRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Serve local game files without stale browser-cached modules."""

    def end_headers(self) -> None:
        request_path = self.path.split("?", 1)[0].lower()
        if request_path.endswith((".html", ".js", ".css", ".woff2", ".woff", ".ttf", ".otf")):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def find_chrome_executable() -> Path | None:
    """Find Chrome in its common Windows installation locations."""
    candidates = []
    for variable in ("ProgramW6432", "ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
        base = os.environ.get(variable)
        if base:
            candidates.append(Path(base) / "Google" / "Chrome" / "Application" / "chrome.exe")

    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def open_browser(url: str) -> None:
    """Open the game in a Chrome app window, falling back to the default browser."""
    chrome = find_chrome_executable()
    if chrome is not None:
        try:
            subprocess.Popen(
                [str(chrome), f"--app={url}"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
            )
            print("Chromeをアプリモードで起動しました。", flush=True)
            return
        except OSError as exc:
            print(f"Chromeを起動できませんでした: {exc}", flush=True)

    print("Chromeが見つからないため、既定のブラウザで開きます。", flush=True)
    try:
        opened = webbrowser.open(url, new=2)
        if opened:
            print("ブラウザを起動しました。", flush=True)
        else:
            print("ブラウザを自動起動できませんでした。URLを手動で開いてください。", flush=True)
    except Exception as exc:  # Browser launch failure must not stop the server.
        print(f"ブラウザを自動起動できませんでした: {exc}", flush=True)
        print(f"次のURLを手動で開いてください: {url}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="ローカルゲームサーバー")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    os.chdir(ROOT)
    handler = lambda *a, **kw: GameRequestHandler(*a, directory=str(ROOT), **kw)

    try:
        server = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as exc:
        print(f"サーバーを起動できませんでした: {exc}", flush=True)
        print("ポート8000が使用中の場合は、既に起動しているサーバーを終了してください。", flush=True)
        return 1

    url_host = "127.0.0.1" if args.host in ("0.0.0.0", "") else args.host
    url = f"http://{url_host}:{server.server_address[1]}/"
    print(f"ゲームサーバー: {url}", flush=True)
    print("このウィンドウを閉じるとサーバーが終了します。", flush=True)
    print("停止するには Ctrl+C を押してください。", flush=True)

    if not args.no_browser:
        threading.Timer(0.8, open_browser, args=(url,)).start()

    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\nサーバーを停止しました。", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
