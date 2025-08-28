#!/usr/bin/env python3
"""
Simple HTTP Server for Miscrits Map
Serves the current directory on a random high port to avoid conflicts.
"""

import http.server
import socketserver
import webbrowser
import socket
import os
import sys
from pathlib import Path

def find_free_port():
    """Find a free port in the range 7000-9999 to avoid common conflicts."""
    for port in range(7347, 9999):  # Starting with a less common port
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return port
        except OSError:
            continue
    
    # Fallback to system-assigned port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('localhost', 0))
        return s.getsockname()[1]

def main():
    """Start the HTTP server and open the browser."""
    
    # Change to the directory containing this script
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check if index.html exists
    if not Path('index.html').exists():
        print("❌ Error: index.html not found in the current directory!")
        print(f"Current directory: {os.getcwd()}")
        sys.exit(1)
    
    # Find a free port
    port = find_free_port()
    
    # Set up the server
    handler = http.server.SimpleHTTPRequestHandler
    handler.extensions_map.update({
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
    })
    
    try:
        with socketserver.TCPServer(("localhost", port), handler) as httpd:
            server_url = f"http://localhost:{port}"
            
            print("🚀 Miscrits Map Server Starting...")
            print("=" * 50)
            print(f"🌐 Server URL: {server_url}")
            print(f"📁 Serving from: {os.getcwd()}")
            print(f"🔌 Port: {port}")
            print("=" * 50)
            print("📖 Instructions:")
            print("  • The browser should open automatically")
            print("  • If not, copy the URL above into your browser")
            print("  • Press Ctrl+C to stop the server")
            print("=" * 50)
            
            # Open the browser
            try:
                webbrowser.open(server_url)
                print("🌏 Opening browser...")
            except Exception as e:
                print(f"⚠️  Could not open browser automatically: {e}")
                print(f"Please open {server_url} manually")
            
            print("\n🎮 Server is running! Waiting for requests...")
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped by user. Goodbye!")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
