import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApp } from './server.js';

async function withServer(options, run) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); await once(server, 'close'); }
}

test('health and provider status are available', async () => {
  await withServer({ env: { AI_PROVIDER: 'anthropic', AI_MODEL: 'claude-sonnet-5', ANTHROPIC_API_KEY: 'test' } }, async base => {
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true });
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.connected, true);
    assert.equal(status.provider, 'anthropic');
  });
});

test('recognizes NVIDIA as an OpenAI-compatible hosted provider', async () => {
  await withServer({ env: { AI_PROVIDER: 'nvidia', NVIDIA_API_KEY: 'nvapi-test' } }, async base => {
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.connected, true);
    assert.equal(status.provider, 'nvidia');
    assert.equal(status.default_model, 'openai/gpt-oss-20b');
  });
});

test('streams Anthropic text as NDJSON', async () => {
  const encoder = new TextEncoder();
  const fetchImpl = async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n'));
    controller.enqueue(encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'));
    controller.close();
  }}), { status: 200 });
  await withServer({ env: { AI_PROVIDER: 'anthropic', AI_MODEL: 'claude-sonnet-5', ANTHROPIC_API_KEY: 'test' }, fetchImpl }, async base => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '{"content":"Hello"}\n{"done":true}\n');
  });
});

test('rejects invalid chat payloads and missing cloud keys', async () => {
  await withServer({ env: { AI_PROVIDER: 'openai', AI_MODEL: 'gpt-5-mini' } }, async base => {
    const invalid = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [] }) });
    assert.equal(invalid.status, 400);
    const missing = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }) });
    assert.equal(missing.status, 503);
  });
});
