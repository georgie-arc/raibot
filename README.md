# Rai Buddy

Rai Buddy is a no-login AI chat workspace built with React, Vite, Node.js, and Express. It keeps conversations in the visitor's browser and streams model replies through a server-side API, so provider keys never reach the frontend.

## Features

- Responsive Rai Buddy interface with the transparent KMITL logo and light/dark themes.
- Streaming conversations with stop, retry, copy, bookmark, search, rename, delete, and Markdown export.
- Prompt library and text/code attachments up to 100 KB.
- Browser-only chat history; no user account or database is required.
- Anthropic, OpenAI-compatible, and local Ollama backends.
- A single Render Web Service serves both the React build and the Node API.

## Project structure

```text
frontend/
  index.html                 Vite entry page
  src/App.jsx                React application shell
  src/uiController.js        Chat interactions and browser storage
  styles.css                 Responsive Rai Buddy design
  public/assets/             Public logo files
backend/
  ai.js                      AI provider adapters and streaming parsers
  server.js                  Express API and production static server
  server.test.js             Backend contract tests
render.yaml                  Render Blueprint
vite.config.js               React build and development proxy
```

## Run locally

Install Node.js 20 or later, then run:

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm start
```

Open `http://127.0.0.1:8000`. Update `.env` with one provider configuration before chatting. Existing `.env` files are ignored by Git.

For local Ollama:

```dotenv
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
AI_MODEL=qwen3:8b
```

## Deploy on Render

The repository includes a Render Blueprint. After the code is on GitHub:

1. In Render, choose **New → Blueprint**.
2. Connect `https://github.com/georgie-arc/raibot`.
3. Render reads `render.yaml` and creates the `rai-buddy` Node Web Service in Singapore.
4. Enter `ANTHROPIC_API_KEY` when Render asks for the secret.
5. Apply the Blueprint and wait for `/api/health` to pass.

The service uses `npm ci && npm run build` and `npm start`, listens on Render's `PORT`, and automatically redeploys commits from `main`. To use another provider, change the Render environment variables described in `.env.example`.

## Validate

```powershell
npm test
npm run build
```

Do not commit `.env`, API keys, `node_modules`, or `dist`. The included `.gitignore` already excludes them.
