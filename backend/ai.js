const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const DEFAULT_SYSTEM_PROMPT = 'You are Rai Buddy, a warm, practical thinking partner. Give clear and accurate answers, ask useful questions when context is missing, and never claim to have capabilities you do not have.';
const MAX_REQUEST_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function getConfig(env = process.env) {
  return {
    provider: 'nvidia',
    model: NVIDIA_MODEL,
    apiKey: env.NVIDIA_API_KEY?.trim() || '',
    baseUrl: NVIDIA_BASE_URL,
    systemPrompt: env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
  };
}

export function isConfigured(config) {
  return Boolean(config.apiKey);
}

async function request(url, options, fetchImpl) {
  let lastNetworkError;
  for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, options);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      lastNetworkError = error;
      if (attempt < MAX_REQUEST_ATTEMPTS - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * (2 ** attempt)));
        continue;
      }
      break;
    }
    if (response.ok) return response;

    const body = await response.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message || parsed?.error || body;
    } catch { /* use response text */ }
    if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_REQUEST_ATTEMPTS - 1) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) ? Math.min(5000, Math.max(0, retryAfter * 1000)) : 500 * (2 ** attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    throw new Error(`NVIDIA request failed (${response.status})${detail ? `: ${String(detail).slice(0, 300)}` : ''}`);
  }
  throw new Error(`Could not reach the NVIDIA service. ${lastNetworkError?.message || 'Network request failed.'}`);
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

export async function* streamReply({ messages, temperature, signal }, config, fetchImpl = fetch) {
  const body = {
    model: NVIDIA_MODEL,
    messages: [{ role: 'system', content: config.systemPrompt }, ...messages],
    max_tokens: 4096,
    stream: true,
    top_p: 0.95,
    temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(1, temperature)) : 1,
    chat_template_kwargs: { enable_thinking: false },
  };
  const response = await request(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
  }, fetchImpl);

  for await (const data of sseEvents(response.body)) {
    if (data === '[DONE]') break;
    const event = JSON.parse(data);
    const text = event.choices?.[0]?.delta?.content;
    if (text) yield text;
  }
}

export async function providerStatus(config) {
  return { connected: isConfigured(config), models: [NVIDIA_MODEL] };
}
