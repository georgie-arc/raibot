const DEFAULT_SYSTEM_PROMPT = 'You are Rai Buddy, a warm, practical thinking partner. Give clear and accurate answers, ask useful questions when context is missing, and never claim to have capabilities you do not have.';

export function getConfig(env = process.env) {
  const provider = (env.AI_PROVIDER || (env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : 'ollama')).toLowerCase();
  const defaults = { anthropic: 'claude-sonnet-5', nvidia: 'openai/gpt-oss-20b', openai: 'gpt-5-mini', ollama: 'qwen3:8b' };
  return {
    provider,
    model: env.AI_MODEL || env.OLLAMA_MODEL || defaults[provider] || '',
    apiKey: env.AI_API_KEY || (provider === 'anthropic' ? env.ANTHROPIC_API_KEY : provider === 'nvidia' ? env.NVIDIA_API_KEY : env.OPENAI_API_KEY) || '',
    baseUrl: (env.AI_BASE_URL || (provider === 'anthropic' ? 'https://api.anthropic.com/v1' : provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : provider === 'openai' ? 'https://api.openai.com/v1' : env.OLLAMA_URL || 'http://127.0.0.1:11434')).replace(/\/$/, ''),
    systemPrompt: env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
  };
}

export function isConfigured(config) {
  return config.provider === 'ollama' || Boolean(config.apiKey && config.model);
}

async function request(url, options, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    throw new Error(`Could not reach the ${options.providerName || 'AI'} service. ${error.message}`);
  }
  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try { detail = JSON.parse(body)?.error?.message || JSON.parse(body)?.error || body; } catch { /* use text */ }
    throw new Error(`${options.providerName || 'AI'} request failed (${response.status})${detail ? `: ${String(detail).slice(0, 300)}` : ''}`);
  }
  return response;
}

async function* sseEvents(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data) yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* ndjson(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) if (line.trim()) yield JSON.parse(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer);
  } finally {
    reader.releaseLock();
  }
}

async function* streamAnthropic(messages, config, fetchImpl, signal) {
  const response = await request(`${config.baseUrl}/messages`, {
    method: 'POST', providerName: 'Anthropic', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: config.model, max_tokens: 4096, system: config.systemPrompt, messages, stream: true }),
  }, fetchImpl);
  for await (const data of sseEvents(response.body)) {
    if (data === '[DONE]') break;
    const event = JSON.parse(data);
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') yield event.delta.text;
    if (event.type === 'error') throw new Error(event.error?.message || 'Anthropic stopped the reply.');
  }
}

async function* streamOpenAI(messages, config, fetchImpl, signal, temperature) {
  const body = { model: config.model, messages: [{ role: 'system', content: config.systemPrompt }, ...messages], stream: true };
  if (Number.isFinite(temperature)) body.temperature = temperature;
  const response = await request(`${config.baseUrl}/chat/completions`, {
    method: 'POST', providerName: 'AI provider', signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify(body),
  }, fetchImpl);
  for await (const data of sseEvents(response.body)) {
    if (data === '[DONE]') break;
    const event = JSON.parse(data);
    const text = event.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

async function* streamOllama(messages, config, fetchImpl, signal, temperature) {
  const response = await request(`${config.baseUrl}/api/chat`, {
    method: 'POST', providerName: 'Ollama', signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: config.systemPrompt }, ...messages], stream: true, options: { temperature } }),
  }, fetchImpl);
  for await (const event of ndjson(response.body)) {
    if (event.error) throw new Error(event.error);
    if (event.message?.content) yield event.message.content;
  }
}

export function streamReply({ messages, temperature, signal }, config, fetchImpl = fetch) {
  if (config.provider === 'anthropic') return streamAnthropic(messages, config, fetchImpl, signal);
  if (config.provider === 'nvidia' || config.provider === 'openai' || config.provider === 'openai-compatible') return streamOpenAI(messages, config, fetchImpl, signal, temperature);
  if (config.provider === 'ollama') return streamOllama(messages, config, fetchImpl, signal, temperature);
  throw new Error(`Unsupported AI_PROVIDER: ${config.provider}`);
}

export async function providerStatus(config, fetchImpl = fetch) {
  if (!isConfigured(config)) return { connected: false, models: [config.model].filter(Boolean) };
  if (config.provider !== 'ollama') return { connected: true, models: [config.model] };
  try {
    const response = await fetchImpl(`${config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    return { connected: true, models: (data.models || []).map(item => item.name).filter(Boolean) };
  } catch {
    return { connected: false, models: [config.model].filter(Boolean) };
  }
}
