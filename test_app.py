"""
test_app.py - In-memory and integration test suite for InsightForge Research Assistant.
Covers credibility indicators, conflict detection, bibliography, search history filters,
favorites toggling, and API endpoints.
"""

import unittest
import os
import io
import json
import tempfile
import shutil
import database
import research_engine
import server

class MockSocket:
    """Simulates a client socket connection for http.server testing without networking."""
    def __init__(self, raw_request: bytes):
        self.rfile = io.BytesIO(raw_request)
        self.wfile = io.BytesIO()

    def makefile(self, mode, *args, **kwargs):
        if "r" in mode:
            return self.rfile
        return self.wfile

    def sendall(self, data):
        self.wfile.write(data)

def invoke_handler(raw_request: bytes) -> tuple:
    """Helper to dispatch raw HTTP request to ResearchAppHandler and parse response."""
    sock = MockSocket(raw_request)
    server.ResearchAppHandler(sock, ("127.0.0.1", 8000), None)
    output = sock.wfile.getvalue().decode("utf-8")
    
    parts = output.split("\r\n\r\n", 1)
    header_block = parts[0]
    body = parts[1] if len(parts) > 1 else ""
    
    status_line = header_block.split("\r\n")[0]
    status_code = int(status_line.split(" ")[1])
    return status_code, header_block, body

class TestDatabase(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test_research.db")
        database.init_db(self.db_path)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_save_and_retrieve_history(self):
        sources = [{"title": "Test Source", "url": "https://example.com", "domain": "example.com", "snippet": "Sample text"}]
        insights = [{"id": 1, "headline": "Discovery", "body": "Details", "citations": [1]}]
        conflicts = [{"id": 1, "facet": "Timeline", "perspective_a": {"viewpoint": "A"}, "perspective_b": {"viewpoint": "B"}}]
        bib = [{"index": 1, "apa_citation": "APA text", "ieee_citation": "IEEE text"}]
        stats = {"word_count": 250, "sources_count": 1}

        sess_id = database.save_research(
            topic="Artificial Intelligence",
            focus="technology",
            depth="comprehensive",
            summary="AI Summary",
            report_markdown="# AI Report",
            sources=sources,
            key_insights=insights,
            conflicts=conflicts,
            bibliography=bib,
            stats=stats,
            is_favorite=0,
            db_path=self.db_path
        )
        self.assertIsInstance(sess_id, int)

        # Retrieve history
        history = database.get_history(db_path=self.db_path)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["topic"], "Artificial Intelligence")
        self.assertFalse(history[0]["is_favorite"])

        # Test toggle favorite
        is_fav = database.toggle_favorite(sess_id, db_path=self.db_path)
        self.assertTrue(is_fav)

        # Test filtering by favorites
        fav_history = database.get_history(favorites_only=True, db_path=self.db_path)
        self.assertEqual(len(fav_history), 1)

        # Test searching history
        search_results = database.get_history(search_query="Intelligence", db_path=self.db_path)
        self.assertEqual(len(search_results), 1)

        empty_search = database.get_history(search_query="NonExistentTopic1234", db_path=self.db_path)
        self.assertEqual(len(empty_search), 0)

        # Retrieve session by id and verify conflicts and bibliography
        sess = database.get_session_by_id(sess_id, db_path=self.db_path)
        self.assertIsNotNone(sess)
        self.assertEqual(sess["topic"], "Artificial Intelligence")
        self.assertEqual(len(sess["conflicts"]), 1)
        self.assertEqual(len(sess["bibliography"]), 1)
        self.assertTrue(sess["is_favorite"])

        # Clear all
        database.clear_all_history(db_path=self.db_path)
        self.assertEqual(len(database.get_history(db_path=self.db_path)), 0)

class TestResearchEngine(unittest.TestCase):
    def test_empty_topic_error(self):
        with self.assertRaises(ValueError):
            research_engine.run_research_pipeline("")

    def test_credibility_indicators(self):
        cred_academic = research_engine.evaluate_source_credibility("nature.com", "science", "Quantum Physics")
        self.assertIn("Tier 1", cred_academic["tier"])
        self.assertGreaterEqual(cred_academic["score"], 90)

        cred_news = research_engine.evaluate_source_credibility("reuters.com", "general", "Global Trade")
        self.assertIn("Tier 2", cred_news["tier"])

    def test_research_pipeline_generation_and_conflicts(self):
        topic = "Solid State Batteries"
        report = research_engine.run_research_pipeline(topic=topic, focus="technology", depth="comprehensive")

        self.assertEqual(report["topic"], topic)
        self.assertEqual(report["focus"], "technology")
        self.assertIn("summary", report)

        # Sources with Credibility
        self.assertIn("sources", report)
        for src in report["sources"]:
            self.assertIn("credibility", src)
            self.assertIn("score", src["credibility"])
            self.assertIn("tier", src["credibility"])

        # Conflicting-Information Detection
        self.assertIn("conflicts", report)
        self.assertGreaterEqual(len(report["conflicts"]), 1)
        for conf in report["conflicts"]:
            self.assertIn("facet", conf)
            self.assertIn("perspective_a", conf)
            self.assertIn("perspective_b", conf)
            self.assertIn("synthesis_verdict", conf)

        # Academic Bibliography
        self.assertIn("bibliography", report)
        self.assertGreaterEqual(len(report["bibliography"]), 1)
        for bib in report["bibliography"]:
            self.assertIn("apa_citation", bib)
            self.assertIn("ieee_citation", bib)

        # Markdown Report
        md = report["report_markdown"]
        self.assertIn("Conflicting Perspectives & Disputed Claims", md)
        self.assertIn("Verified Sources & Credibility Ratings", md)
        self.assertIn("Formal Academic Bibliography", md)

        # Stats
        stats = report["stats"]
        self.assertIn("average_credibility", stats)
        self.assertIn("conflicts_detected", stats)

class TestServerEndpoints(unittest.TestCase):
    def setUp(self):
        database.init_db()

    def test_health_check(self):
        req = b"GET /api/health HTTP/1.1\r\nHost: localhost\r\n\r\n"
        status, headers, body = invoke_handler(req)
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertEqual(data.get("status"), "healthy")

    def test_serve_static_files(self):
        # Index.html
        status, headers, body = invoke_handler(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
        self.assertEqual(status, 200)
        self.assertIn("InsightForge", body)

        # style.css
        status, headers, body = invoke_handler(b"GET /style.css HTTP/1.1\r\nHost: localhost\r\n\r\n")
        self.assertEqual(status, 200)
        self.assertIn("@media print", body)

        # app.js
        status, headers, body = invoke_handler(b"GET /app.js HTTP/1.1\r\nHost: localhost\r\n\r\n")
        self.assertEqual(status, 200)
        self.assertIn("executeResearch", body)

    def test_research_api_and_favorite_flow(self):
        payload = json.dumps({
            "topic": "Autonomous Drone Networks",
            "focus": "technology",
            "depth": "comprehensive"
        }).encode("utf-8")
        
        req = (
            f"POST /api/research HTTP/1.1\r\n"
            f"Host: localhost\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(payload)}\r\n\r\n"
        ).encode("utf-8") + payload

        status, headers, body = invoke_handler(req)
        self.assertEqual(status, 200)
        res_data = json.loads(body)
        self.assertEqual(res_data["status"], "success")
        report_data = res_data["data"]
        self.assertEqual(report_data["topic"], "Autonomous Drone Networks")
        self.assertIn("conflicts", report_data)
        self.assertIn("bibliography", report_data)
        session_id = report_data["session_id"]

        # Toggle favorite endpoint
        fav_req = f"POST /api/history/{session_id}/favorite HTTP/1.1\r\nHost: localhost\r\nContent-Length: 0\r\n\r\n".encode("utf-8")
        status, headers, body = invoke_handler(fav_req)
        self.assertEqual(status, 200)
        fav_data = json.loads(body)
        self.assertTrue(fav_data["is_favorite"])

        # History with search query
        search_req = b"GET /api/history?q=Autonomous HTTP/1.1\r\nHost: localhost\r\n\r\n"
        status, headers, body = invoke_handler(search_req)
        self.assertEqual(status, 200)
        h_data = json.loads(body)
        self.assertGreaterEqual(len(h_data["history"]), 1)

        # History with favorites filter
        fav_filter_req = b"GET /api/history?favorites=1 HTTP/1.1\r\nHost: localhost\r\n\r\n"
        status, headers, body = invoke_handler(fav_filter_req)
        self.assertEqual(status, 200)
        fav_hist_data = json.loads(body)
        self.assertGreaterEqual(len(fav_hist_data["history"]), 1)

        # Delete single session
        del_req = f"DELETE /api/history/{session_id} HTTP/1.1\r\nHost: localhost\r\n\r\n".encode("utf-8")
        status, headers, body = invoke_handler(del_req)
        self.assertEqual(status, 200)

        # Clear all
        clear_req = b"DELETE /api/history/all HTTP/1.1\r\nHost: localhost\r\n\r\n"
        status, headers, body = invoke_handler(clear_req)
        self.assertEqual(status, 200)

    def test_special_characters_and_safety(self):
        payload = json.dumps({
            "topic": "<script>alert('xss')</script> & Quantum 'AI' 100% #1",
            "focus": "technology",
            "depth": "comprehensive"
        }).encode("utf-8")
        req = (
            f"POST /api/research HTTP/1.1\r\n"
            f"Host: localhost\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(payload)}\r\n\r\n"
        ).encode("utf-8") + payload
        status, headers, body = invoke_handler(req)
        self.assertEqual(status, 200)
        res_data = json.loads(body)
        self.assertEqual(res_data["status"], "success")
        self.assertIn("data", res_data)

    def test_validation_errors(self):
        # Empty topic
        payload = json.dumps({"topic": "   "}).encode("utf-8")
        req = (
            f"POST /api/research HTTP/1.1\r\n"
            f"Host: localhost\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(payload)}\r\n\r\n"
        ).encode("utf-8") + payload
        status, headers, body = invoke_handler(req)
        self.assertEqual(status, 400)

        # Invalid JSON
        bad_payload = b"not-a-json-object"
        req = (
            f"POST /api/research HTTP/1.1\r\n"
            f"Host: localhost\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(bad_payload)}\r\n\r\n"
        ).encode("utf-8") + bad_payload
        status, headers, body = invoke_handler(req)
        self.assertEqual(status, 400)

        # Non-existent endpoint
        not_found_req = b"GET /non-existent-page HTTP/1.1\r\nHost: localhost\r\n\r\n"
        status, headers, body = invoke_handler(not_found_req)
        self.assertEqual(status, 404)

if __name__ == "__main__":
    unittest.main()
