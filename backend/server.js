import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig, isConfigured, providerStatus, streamReply } from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '..', 'dist');

export function createApp({ env = process.env, fetchImpl = fetch } = {}) {
  const app = express();
  const config = getConfig(env);
  app.disable('x-powered-by');
  app.use((_, response, next) => {
    response.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_, response) => response.json({ ok: true }));
  app.get('/api/status', async (_, response) => {
    const provider = await providerStatus(config, fetchImpl);
    response.json({ ...provider, provider: config.provider, default_model: config.model });
  });
  app.post('/api/chat', async (request, response) => {
    const messages = request.body?.messages;
    const temperature = Number(request.body?.temperature);
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 200) return response.status(400).json({ error: 'Send between 1 and 200 messages.' });
    if (messages.some(item => !item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || item.content.length > 120000)) return response.status(400).json({ error: 'One or more messages are invalid.' });
    if (!isConfigured(config)) return response.status(503).json({ error: `Rai Buddy is missing its ${config.provider} API configuration.` });

    const upstream = new AbortController();
    response.on('close', () => { if (!response.writableEnded) upstream.abort(); });
    response.status(200).set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
    try {
      for await (const content of streamReply({ messages, temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(2, temperature)) : undefined, signal: upstream.signal }, config, fetchImpl)) {
        response.write(`${JSON.stringify({ content })}\n`);
      }
      response.write(`${JSON.stringify({ done: true })}\n`);
    } catch (error) {
      if (!response.writableEnded && !response.destroyed) response.write(`${JSON.stringify({ error: error.message || 'The AI service could not complete this reply.' })}\n`);
    } finally {
      if (!response.writableEnded && !response.destroyed) response.end();
    }
  });

  app.use(express.static(distPath, { index: false, maxAge: env.NODE_ENV === 'production' ? '1h' : 0 }));
  app.use((request, response, next) => {
    if (request.path.startsWith('/api/')) return next();
    response.sendFile(path.join(distPath, 'index.html'));
  });
  app.use((_, response) => response.status(404).json({ error: 'Not found.' }));
  app.use((error, _, response, __) => response.status(error.type === 'entity.too.large' ? 413 : 500).json({ error: error.type === 'entity.too.large' ? 'Request is too large.' : 'Unexpected server error.' }));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8000;
  const host = process.env.HOST || '0.0.0.0';
  createApp().listen(port, host, () => console.log(`Rai Buddy is running at http://${host}:${port}`));
}
