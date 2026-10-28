import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApp } from './server.js';

const MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';

async function withServer(options, run) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); await once(server, 'close'); }
}

test('health and NVIDIA model status are available', async () => {
  await withServer({ env: { NVIDIA_API_KEY: 'nvapi-test' } }, async base => {
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true });
    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.connected, true);
    assert.equal(status.provider, 'nvidia');
    assert.equal(status.default_model, MODEL);
    assert.deepEqual(status.models, [MODEL]);
  });
});

test('streams NVIDIA Nemotron text as NDJSON', async () => {
  const encoder = new TextEncoder();
  let upstreamRequest;
  const fetchImpl = async (url, options) => {
    upstreamRequest = { url, options };
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"hidden reasoning"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello from Nemotron"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }}), { status: 200 });
  };

  await withServer({ env: { NVIDIA_API_KEY: 'nvapi-test' }, fetchImpl }, async base => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }], temperature: 1.7 }) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '{"content":"Hello from Nemotron"}\n{"done":true}\n');
    assert.equal(upstreamRequest.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal(upstreamRequest.options.headers.authorization, 'Bearer nvapi-test');
    const body = JSON.parse(upstreamRequest.options.body);
    assert.equal(body.model, MODEL);
    assert.equal(body.temperature, 1);
    assert.equal(body.chat_template_kwargs.enable_thinking, false);
  });
});

test('retries temporary NVIDIA failures before returning a reply', async () => {
  const encoder = new TextEncoder();
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts < 3) return new Response('{"error":{"message":"temporarily unavailable"}}', { status: 503, headers: { 'content-type': 'application/json', 'retry-after': '0' } });
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Recovered"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }}), { status: 200 });
  };

  await withServer({ env: { NVIDIA_API_KEY: 'nvapi-test' }, fetchImpl }, async base => {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '{"content":"Recovered"}\n{"done":true}\n');
    assert.equal(attempts, 3);
  });
});

test('rejects invalid payloads and a missing NVIDIA key', async () => {
  await withServer({ env: {} }, async base => {
    const invalid = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [] }) });
    assert.equal(invalid.status, 400);
    const missing = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }) });
    assert.equal(missing.status, 503);
    assert.match((await missing.json()).error, /nvidia API configuration/i);
  });
});
