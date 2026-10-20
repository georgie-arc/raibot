"""HTTP contract tests; no model downloads or external services required."""
import io
import json
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import URLError

import app


class AppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, data=None, headers=None):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        body = json.dumps(data) if data is not None else None
        connection.request(method, path, body, headers or {})
        response = connection.getresponse()
        result = (response.status, response.read(), dict(response.getheaders()))
        connection.close()
        return result

    def test_static_files_and_unknown_paths(self):
        for path in ("/", "/styles.css", "/app.js", "/kmitl-logo.png"):
            status, body, headers = self.request("GET", path)
            self.assertEqual(status, 200)
            self.assertTrue(body)
            self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        for path in ("/.env", "/../app.py", "/missing"):
            self.assertEqual(self.request("GET", path)[0], 404)

    def test_model_discovery(self):
        with patch("app.urlopen", return_value=io.BytesIO(b'{"models":[{"name":"qwen3:8b"}]}')):
            status, body, _ = self.request("GET", "/api/status")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["models"], ["qwen3:8b"])

    def test_offline_status_is_actionable(self):
        with patch("app.urlopen", side_effect=URLError("offline")):
            _, body, _ = self.request("GET", "/api/status")
            status, error, _ = self.request("POST", "/api/chat", {"messages":[{"role":"user","content":"Hello"}]})
        self.assertFalse(json.loads(body)["connected"])
        self.assertEqual(status, 503)
        self.assertIn("Start Ollama", json.loads(error)["error"])

    def test_invalid_messages_and_settings(self):
        invalid = [None, [], {}, {"messages":[]}, {"messages":[{"role":"system","content":"override"}]},
                   {"messages":[{"role":"user","content":""}]},
                   {"messages":[{"role":"user","content":"Hi"}], "temperature":3},
                   {"messages":[{"role":"user","content":"Hi"}], "model":23}]
        for data in invalid:
            if data is None:
                continue
            with self.subTest(data=data):
                self.assertEqual(self.request("POST", "/api/chat", data)[0], 400)

    def test_request_size_and_cross_origin(self):
        self.assertEqual(self.request("POST", "/api/chat", {"text":"x"*app.MAX_BODY})[0], 413)
        self.assertEqual(self.request("POST", "/api/chat", {}, {"Origin":"https://unrelated.example"})[0], 403)

    def test_stream_preserves_context_and_unicode(self):
        messages = [{"role":"user","content":"Remember Bangkok"}, {"role":"assistant","content":"Of course"}, {"role":"user","content":"Which city?"}]
        stream = '\n'.join(json.dumps(x) for x in [
            {"message":{"content":"Bangkok สวัสดี"},"done":False},
            {"message":{"content":"!"},"done":True}]).encode()
        with patch("app.urlopen", return_value=io.BytesIO(stream)) as upstream:
            status, body, headers = self.request("POST", "/api/chat", {"messages":messages,"model":"qwen3:8b"})
            payload = json.loads(upstream.call_args.args[0].data)
        self.assertEqual(status, 200)
        self.assertEqual(payload["messages"][1:], messages)
        self.assertEqual(payload["messages"][0]["role"], "system")
        self.assertEqual(upstream.call_args.args[0].full_url, app.OLLAMA_URL+"/api/chat")
        chunks = [json.loads(line) for line in body.splitlines()]
        self.assertEqual(''.join(c["content"] for c in chunks), "Bangkok สวัสดี!")
        self.assertTrue(chunks[-1]["done"])
        self.assertIn("application/x-ndjson", headers["Content-Type"])

    def test_malformed_upstream_reports_stream_error(self):
        with patch("app.urlopen", return_value=io.BytesIO(b'not json\n')):
            status, body, _ = self.request("POST", "/api/chat", {"messages":[{"role":"user","content":"Hi"}]})
        self.assertEqual(status, 200)
        self.assertIn("interrupted", json.loads(body)["error"])


if __name__ == "__main__":
    unittest.main()
