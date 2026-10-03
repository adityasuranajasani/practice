"""
server.py - Lightweight, production-grade HTTP Server for the Research Assistant Web App.
No third-party packages required; runs anywhere with Python 3.
"""

import http.server
import json
import mimetypes
import os
import sys
import urllib.parse
from typing import Tuple

import database
import research_engine

PORT = int(os.environ.get("PORT", 8000))
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

class ResearchAppHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json_response(self, data: dict, status_code: int = 200):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_response(self, message: str, status_code: int = 400):
        self.send_json_response({"error": message, "status": "error"}, status_code=status_code)

    def serve_static_file(self, file_path: str):
        norm_path = os.path.normpath(file_path)
        if not norm_path.startswith(STATIC_DIR):
            self.send_error_response("Forbidden", 403)
            return

        if not os.path.isfile(norm_path):
            self.send_error_response("Not Found", 404)
            return

        mime_type, _ = mimetypes.guess_type(norm_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        try:
            with open(norm_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8" if "text" in mime_type or "json" in mime_type or "javascript" in mime_type else mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error_response(f"Internal file read error: {str(e)}", 500)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        if not path:
            path = "/"

        # API: Health Check
        if path == "/api/health":
            self.send_json_response({
                "status": "healthy",
                "app": "InsightForge Research Assistant",
                "version": "1.2.0"
            })
            return

        # API: Get History (supports search query, favorites, focus filter)
        if path == "/api/history":
            try:
                params = urllib.parse.parse_qs(parsed.query)
                search_q = params.get("q", [""])[0]
                fav_only = params.get("favorites", ["0"])[0] in ("1", "true")
                focus_flt = params.get("focus", [""])[0]

                history = database.get_history(
                    search_query=search_q,
                    favorites_only=fav_only,
                    focus_filter=focus_flt
                )
                self.send_json_response({"history": history, "status": "success"})
            except Exception as e:
                self.send_error_response(f"Database error: {str(e)}", 500)
            return

        # API: Get Session by ID
        if path.startswith("/api/history/"):
            parts = path.split("/")
            if len(parts) == 4 and parts[3].isdigit():
                session_id = int(parts[3])
                session = database.get_session_by_id(session_id)
                if session:
                    self.send_json_response({"session": session, "status": "success"})
                else:
                    self.send_error_response("Research session not found", 404)
                return

        # Static Web Assets
        if path == "/":
            self.serve_static_file(os.path.join(STATIC_DIR, "index.html"))
            return

        requested_file = os.path.join(STATIC_DIR, path.lstrip("/"))
        if os.path.isfile(requested_file):
            self.serve_static_file(requested_file)
            return

        self.send_error_response("Not found", 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        # API: Toggle Favorite for a Session
        if path.startswith("/api/history/") and path.endswith("/favorite"):
            parts = path.split("/")
            if len(parts) == 5 and parts[3].isdigit():
                session_id = int(parts[3])
                new_favorite_state = database.toggle_favorite(session_id)
                if new_favorite_state is not None:
                    self.send_json_response({
                        "status": "success",
                        "is_favorite": new_favorite_state,
                        "session_id": session_id
                    })
                else:
                    self.send_error_response("Session not found", 404)
                return

        # API: Research Generation
        if path == "/api/research":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                if content_length == 0:
                    self.send_error_response("Empty request body", 400)
                    return
                body_raw = self.rfile.read(content_length).decode("utf-8")
                data = json.loads(body_raw)
            except Exception as e:
                self.send_error_response(f"Invalid JSON payload: {str(e)}", 400)
                return

            topic = data.get("topic", "").strip()
            focus = data.get("focus", "general").strip().lower()
            depth = data.get("depth", "comprehensive").strip().lower()

            if not topic:
                self.send_error_response("Topic cannot be empty", 400)
                return

            try:
                # Execute research workflow
                report_data = research_engine.run_research_pipeline(topic=topic, focus=focus, depth=depth)

                # Persist to database
                session_id = database.save_research(
                    topic=report_data["topic"],
                    focus=report_data["focus"],
                    depth=report_data["depth"],
                    summary=report_data["summary"],
                    report_markdown=report_data["report_markdown"],
                    sources=report_data["sources"],
                    key_insights=report_data["key_insights"],
                    conflicts=report_data.get("conflicts", []),
                    bibliography=report_data.get("bibliography", []),
                    stats=report_data["stats"],
                    is_favorite=0
                )
                report_data["session_id"] = session_id
                report_data["is_favorite"] = False

                self.send_json_response({
                    "status": "success",
                    "data": report_data
                })
            except Exception as e:
                self.send_error_response(f"Research pipeline error: {str(e)}", 500)
            return

        self.send_error_response("Endpoint not found", 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Clear All History
        if path == "/api/history/all":
            database.clear_all_history()
            self.send_json_response({"status": "success", "message": "All history cleared"})
            return

        # Delete Single History Item
        if path.startswith("/api/history/"):
            parts = path.split("/")
            if len(parts) == 4 and parts[3].isdigit():
                session_id = int(parts[3])
                deleted = database.delete_session(session_id)
                if deleted:
                    self.send_json_response({"status": "success", "message": f"Deleted session {session_id}"})
                else:
                    self.send_error_response("Session not found", 404)
                return

        self.send_error_response("Endpoint not found", 404)

    def log_message(self, format, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def run_server(port: int = PORT):
    database.init_db()
    server_address = ("", port)
    httpd = http.server.ThreadingHTTPServer(server_address, ResearchAppHandler)
    print(f"✨ Research Assistant Web App running at http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server gracefully...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
