"""Local CONNECT forwarder: Chromium does not send proxy auth preemptively,
but the egress proxy closes tunnels without a 407. This forwarder adds the
Proxy-Authorization header (credentials from env, never printed) and relays.
Listens on 127.0.0.1:18080. Run in background while screenshots are taken."""
import base64
import os
import socket
import threading
from urllib.parse import urlparse

UP = urlparse(os.environ.get("https_proxy") or os.environ.get("HTTPS_PROXY", ""))
AUTH = base64.b64encode(f"{UP.username}:{UP.password}".encode()).decode()
LISTEN = ("127.0.0.1", 18080)


def relay(a, b):
    try:
        while True:
            data = a.recv(65536)
            if not data:
                break
            b.sendall(data)
    except OSError:
        pass
    finally:
        try:
            b.shutdown(socket.SHUT_WR)
        except OSError:
            pass


def handle(client):
    try:
        req = b""
        while b"\r\n\r\n" not in req:
            chunk = client.recv(4096)
            if not chunk:
                return
            req += chunk
        line = req.split(b"\r\n", 1)[0].decode("latin1")
        method, target, _ = line.split(" ", 2)
        if method != "CONNECT":
            client.sendall(b"HTTP/1.1 405 Method Not Allowed\r\n\r\n")
            return
        upstream = socket.create_connection((UP.hostname, UP.port), timeout=30)
        upstream.sendall(
            f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n"
            f"Proxy-Authorization: Basic {AUTH}\r\n\r\n".encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            chunk = upstream.recv(4096)
            if not chunk:
                return
            resp += chunk
        if b" 200 " not in resp.split(b"\r\n", 1)[0]:
            client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
            upstream.close()
            return
        client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        t1 = threading.Thread(target=relay, args=(client, upstream), daemon=True)
        t2 = threading.Thread(target=relay, args=(upstream, client), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    except OSError:
        pass
    finally:
        try:
            client.close()
        except OSError:
            pass


srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(LISTEN)
srv.listen(50)
print("forwarding proxy on 127.0.0.1:18080", flush=True)
while True:
    client, _ = srv.accept()
    threading.Thread(target=handle, args=(client,), daemon=True).start()
