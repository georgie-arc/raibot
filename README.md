# Rai Buddy

Rai Buddy is a no-login AI chat workspace built with React, Vite, Node.js, and Express. It uses NVIDIA's hosted `nvidia/nemotron-3.5-lightning-30b-a3b` model and streams replies through the Node server, so the NVIDIA key never reaches the browser.

## Features

- Responsive Rai Buddy interface with the transparent KMITL logo and light/dark themes.
- Streaming conversations with stop, retry, copy, bookmark, search, rename, delete, and Markdown export.
- Prompt library and text/code attachments up to 100 KB.
- Browser-only chat history; no user account or database is required.
- NVIDIA Nemotron is the only AI provider and model.
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
  ai.js                      NVIDIA streaming API client
  server.js                  Express API and production static server
  server.test.js             Backend contract tests
render.yaml                  Render Blueprint
vite.config.js               React build and development proxy
```

## Configure and run locally

1. Generate an API key at `https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b`.
2. Copy `.env.example` to `.env` and add the key:

   ```dotenv
   NVIDIA_API_KEY=nvapi-your-key-here
   HOST=0.0.0.0
   PORT=8000
   ```

3. Install, build, and start:

   ```powershell
   npm install
   npm run build
   npm start
   ```

4. Open `http://127.0.0.1:8000`.

The model and NVIDIA endpoint are fixed in the backend. Only `NVIDIA_API_KEY` is required.

## Deploy on Render

1. In Render, choose **New → Blueprint**.
2. Connect `https://github.com/georgie-arc/raibot`.
3. Enter `NVIDIA_API_KEY` when Render asks for the secret.
4. Apply the Blueprint and wait for `/api/health` to pass.

Render runs `npm ci && npm run build`, starts the Express server with `npm start`, and automatically redeploys commits from `main`.

## Validate

```powershell
npm test
npm run build
```

Do not commit `.env`, API keys, `node_modules`, or `dist`. The included `.gitignore` excludes them.
