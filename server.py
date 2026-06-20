#!/usr/bin/env python3
"""WQ Balance Constructor — сервер с прокси для Google Sheets"""

import http.server, socketserver, os, sys, time, threading, hashlib
from pathlib import Path
from urllib.parse import urlparse, parse_qs, quote
import urllib.request, urllib.error, ssl

PORT = 8731
DIR  = Path(__file__).parent.resolve()

# SSL context that doesn't verify (some corporate/VPN setups block Google certs)
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# ── SSE for auto-reload ──
clients = []
clients_lock = threading.Lock()

def notify_reload():
    with clients_lock:
        dead = []
        for wfile in clients:
            try:
                wfile.write(b"data: reload\n\n")
                wfile.flush()
            except: dead.append(wfile)
        for d in dead: clients.remove(d)

def file_hash(path):
    try: return hashlib.md5(path.read_bytes()).hexdigest()
    except: return ""

def watch():
    watched = {p: file_hash(p) for p in DIR.glob("*.html")}
    while True:
        time.sleep(1)
        for p in DIR.glob("*.html"):
            h = file_hash(p)
            if watched.get(p) != h:
                watched[p] = h
                print(f"  ↺  {p.name} changed — reloading browser")
                notify_reload()

RELOAD_SNIPPET = b"""
<script>
(function(){
  var es = new EventSource('/--reload');
  es.onmessage = function(e){ if(e.data==='reload') location.reload(); };
  es.onerror = function(){ setTimeout(function(){ location.reload(); }, 2000); };
})();
</script>
"""

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(DIR), **kw)

    def log_message(self, fmt, *args):
        # Show all requests except SSE keepalive
        if '/--reload' not in self.path:
            print(f"  →  {self.path[:80]}")

    def do_GET(self):
        # ── Google Sheets proxy ──
        if '/--proxy-sheets' in self.path:
            print(f"  📡 Proxy request: {self.path[:100]}")
            try:
                qs = parse_qs(urlparse(self.path).query)
                sheet_id = qs.get('id', [''])[0]
                sheet_name = qs.get('sheet', [''])[0]
                print(f"  📡 Sheet ID: {sheet_id[:20]}..., Sheet: {sheet_name}")

                if not sheet_id:
                    self.send_error(400, 'Missing id')
                    return

                urls = [
                    f'https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&sheet={quote(sheet_name)}',
                    f'https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&sheet={quote(sheet_name)}',
                ]

                for i, url in enumerate(urls):
                    print(f"  📡 Trying URL {i+1}: {url[:80]}...")
                    try:
                        req = urllib.request.Request(url, headers={
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                            'Accept': 'text/csv,text/plain,*/*',
                        })
                        resp = urllib.request.urlopen(req, timeout=20, context=CTX)
                        data = resp.read()
                        print(f"  ✅ Got {len(data)} bytes from URL {i+1}")

                        self.send_response(200)
                        self.send_header('Content-Type', 'text/csv; charset=utf-8')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Content-Length', str(len(data)))
                        self.end_headers()
                        self.wfile.write(data)
                        return
                    except Exception as e:
                        print(f"  ❌ URL {i+1} failed: {e}")
                        continue

                print("  ❌ All URLs failed")
                self.send_error(502, 'Could not fetch from Google Sheets')
            except Exception as e:
                print(f"  ❌ Proxy error: {e}")
                self.send_error(500, str(e))
            return

        # ── SSE endpoint ──
        if self.path == '/--reload':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()
            with clients_lock: clients.append(self.wfile)
            try:
                while True:
                    time.sleep(30)
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except:
                with clients_lock:
                    if self.wfile in clients: clients.remove(self.wfile)
            return

        # ── Serve constructor.html with reload snippet ──
        if self.path in ('/', '/constructor.html', ''):
            path = DIR / 'constructor.html'
            if path.exists():
                content = path.read_bytes()
                content = content.replace(b'</body>', RELOAD_SNIPPET + b'</body>', 1)
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                self.wfile.write(content)
                return

        super().do_GET()

class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    threading.Thread(target=watch, daemon=True).start()

    url = f"http://localhost:{PORT}"
    print()
    print("  ╔══════════════════════════════════════════╗")
    print("  ║   WQ Balance Constructor  🐉             ║")
    print(f"  ║   {url:<42}║")
    print("  ║   Ctrl+C — stop server                  ║")
    print("  ╚══════════════════════════════════════════╝")
    print()

    import webbrowser
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    with ThreadedServer(("", PORT), Handler) as httpd:
        try: httpd.serve_forever()
        except KeyboardInterrupt: print("\n  Server stopped.")
