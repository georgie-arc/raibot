"""Rai Buddy: a dependency-free local web app backed by Ollama."""
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BACKEND = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND.parent
FRONTEND = PROJECT_ROOT / "frontend"


def load_env():
    path = PROJECT_ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip() and not key.strip().startswith("#"):
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_env()
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
SYSTEM_PROMPT = (
    "You are Rai Buddy, a thoughtful, friendly AI companion born from an internship "
    "in Thailand. Help people learn, write, code, and think through ideas. Give clear, "
    "accurate, practical answers. Admit uncertainty. Use Markdown when helpful. "
    "Never claim to browse the web or access files unless their content is supplied."
)
MAX_BODY = 1_048_576


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def reply(self, status, data, content_type="application/json; charset=utf-8"):
        body = json.dumps(data).encode() if isinstance(data, dict) else data
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.close_connection = True
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/status":
            try:
                with urlopen(OLLAMA_URL + "/api/tags", timeout=3) as response:
                    models = [m["name"] for m in json.load(response).get("models", [])]
                self.reply(200, {"connected": True, "models": models, "default_model": DEFAULT_MODEL})
            except (OSError, ValueError, KeyError):
                self.reply(200, {"connected": False, "models": [], "default_model": DEFAULT_MODEL})
            return
        files = {"/": ("index.html", "text/html; charset=utf-8"),
                 "/styles.css": ("styles.css", "text/css; charset=utf-8"),
                 "/app.js": ("app.js", "text/javascript; charset=utf-8"),
                 "/kmitl-logo.png": ("assets/kmitl-logo.png", "image/png")}
        if path not in files:
            self.reply(404, {"error": "Not found"})
            return
        name, mime = files[path]
        self.reply(200, (FRONTEND / name).read_bytes(), mime)

    def do_POST(self):
        if self.path != "/api/chat":
            self.reply(404, {"error": "Not found"})
            return
        origin = self.headers.get("Origin")
        if origin and origin not in (f"http://{self.headers.get('Host')}", f"https://{self.headers.get('Host')}"):
            self.reply(403, {"error": "Cross-origin requests are not allowed."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY:
                self.reply(413, {"error": "Message is too large. Keep the conversation under 1 MB."})
                return
            data = json.loads(self.rfile.read(length))
            messages = data.get("messages")
            if not isinstance(messages, list) or not messages or len(messages) > 200:
                raise ValueError("Send between 1 and 200 conversation messages.")
            for message in messages:
                if not isinstance(message, dict) or message.get("role") not in ("user", "assistant") or not isinstance(message.get("content"), str) or not message["content"].strip():
                    raise ValueError("Each message needs a role and nonempty text.")
            model = data.get("model", DEFAULT_MODEL)
            if not isinstance(model, str) or not model.strip() or len(model) > 100:
                raise ValueError("Choose a valid model.")
            temperature = float(data.get("temperature", 0.7))
            if not 0 <= temperature <= 2:
                raise ValueError("Creativity must be between 0 and 2.")
        except (ValueError, TypeError, AttributeError) as exc:
            self.reply(400, {"error": str(exc) or "Invalid request."})
            return
        payload = {"model": model, "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                   "stream": True, "think": False, "options": {"temperature": temperature}}
        request = Request(OLLAMA_URL + "/api/chat", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        try:
            upstream = urlopen(request, timeout=120)
        except HTTPError:
            self.reply(502, {"error": f"Ollama could not load {model}. Check that the model is installed and try again."})
            return
        except (URLError, OSError):
            self.reply(503, {"error": "Cannot reach Ollama. Start Ollama, install a model, then try again. Open Settings for setup steps."})
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.close_connection = True
        try:
            with upstream:
                for line in upstream:
                    if not line.strip():
                        continue
                    item = json.loads(line)
                    if item.get("error"):
                        self.event({"error": "The model stopped responding. Please try again."})
                        break
                    self.event({"content": item.get("message", {}).get("content", ""), "done": item.get("done", False)})
                    if item.get("done"):
                        break
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except (OSError, ValueError):
            try:
                self.event({"error": "The connection was interrupted. Please try again."})
            except OSError:
                pass

    def event(self, item):
        self.wfile.write((json.dumps(item) + "\n").encode())
        self.wfile.flush()


def main():
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"\n  Rai Buddy is ready at http://{host}:{port}\n  Press Ctrl+C to stop.\n", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
