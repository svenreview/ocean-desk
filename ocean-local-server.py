"""OCEAN DESK local preview server. Never deploys, uploads data or changes accounts.

Windows: py ocean-local-server.py
Mobile LAN: py ocean-local-server.py --lan
Stop: Ctrl+C. LAN mode only on a trusted private network.
"""
import argparse
import ipaddress
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Avoid stale UI during testing; do not change authentication policies.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def private_ipv4_candidates():
    addresses = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addresses.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in addresses if ipaddress.ip_address(ip).is_private
                  and not ipaddress.ip_address(ip).is_loopback
                  and not ipaddress.ip_address(ip).is_link_local)


def main():
    parser = argparse.ArgumentParser(description="OCEAN DESK safe local preview")
    parser.add_argument("--lan", action="store_true", help="Allow access on trusted local Wi-Fi only; never forward router ports")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Port must be between 1024 and 65535")
    bind = "0.0.0.0" if args.lan else "127.0.0.1"
    if args.lan:
        print("WARNING: HTTP preview is visible to other devices on this network.")
        print("Only run on private trusted Wi-Fi. No public Wi-Fi, router port forwarding, or sensitive data.")
        candidates = private_ipv4_candidates()
        if candidates:
            for addr in candidates:
                print(f"Possible phone URL: http://{addr}:{args.port}/ (verify this PC's LAN address)")
        else:
            print("No private IPv4 detected. Check your PC's local Wi-Fi IPv4 address.")
        print("Phone and PC records do NOT synchronize. Login and server rewards are disabled.")
    else:
        print(f"PC-only URL: http://127.0.0.1:{args.port}/")
        print("For phone testing on trusted Wi-Fi, restart with --lan.")
    with ThreadingHTTPServer((bind, args.port), NoCacheHandler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped local preview.")


if __name__ == "__main__":
    main()
