# Rai Buddy

A personal AI workspace inspired by Rai Buddy's beginnings during an internship in Thailand. A custom responsive frontend and Python backend, with no login, build step, API key, or Python dependencies.

## Start

1. Install Python 3.10 or later and Ollama if they are not already installed.
2. Start Ollama. If the desktop app is not running, use `ollama serve`.
3. Install a model: `ollama pull qwen3:8b`.
4. From this folder, run:

   ```powershell
   python backend/app.py
   ```

5. Open **http://127.0.0.1:8000**.

`python backend/localama.py` also starts the same app. The old Streamlit entry points have been replaced; do not use `streamlit run`.

## Features

- Streaming Ollama chat with conversation context, stop, retry, and copy.
- Conversation history, search, renaming, bookmarks, deletion, and Markdown export.
- Twelve starter prompts, with category filters and rotating suggestions.
- Text/code attachments up to 100 KB (not PDF or images).
- Model discovery, connection status, creativity control, and light/dark themes.
- Responsive sidebar, keyboard navigation, `Ctrl+K` for a new chat, `Enter` to send, and `Shift+Enter` for a new line.
- Escaped Markdown rendering; model-generated HTML never executes.

Chats and preferences are stored in this browser's localStorage. They are not synchronized between browsers or devices. Clearing site data removes them. Export important conversations. Message text and attachments go to the configured Ollama server; no analytics or tracing is enabled. The assistant has no live web search or image-generation capability.

## Configuration

Optional: add these values to the existing `.env`, or copy `.env.example` to `.env` if no `.env` exists. Environment variables take precedence.

```dotenv
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
HOST=127.0.0.1
PORT=8000
```

Choose a different installed model in Settings. The Ollama URL is configured on the server, not through the browser. The default host is loopback, intended for personal use on your machine. Public hosting requires a production server, HTTPS, access controls, and resource limits. The app uses Python's development HTTP server.

The old Hugging Face token was removed from `login.py`. Revoke that previously hardcoded token in your Hugging Face account. Existing `.env` credentials were left untouched and are ignored by version control; this app does not require them.

## Validate

```powershell
python -m unittest discover -s backend -v
python -m py_compile backend/app.py backend/localama.py
node --check frontend/app.js
```

Backend tests use a temporary local server and mock Ollama. They cover streamed replies, conversation context, Unicode, validation, blocked cross-origin requests, offline behavior, and static-file access restrictions.

## Structure

```text
backend/app.py              Python HTTP server and Ollama streaming proxy
backend/localama.py         Compatibility launcher
backend/test_app.py         Backend contract tests
frontend/index.html         Accessible application structure
frontend/styles.css         Responsive themes and visual design
frontend/app.js             Chat UI, streaming, storage, and dialogs
frontend/assets/            Logo and brand assets
```

The frontend and backend are kept separate so the interface can evolve independently from the local AI server.
