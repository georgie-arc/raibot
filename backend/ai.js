const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const DEFAULT_SYSTEM_PROMPT = 'You are Rai Buddy, a warm, practical thinking partner. Give clear and accurate answers, ask useful questions when context is missing, and never claim to have capabilities you do not have.';

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
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    throw new Error(`Could not reach the NVIDIA service. ${error.message}`);
  }
  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message || parsed?.error || body;
    } catch { /* use response text */ }
    throw new Error(`NVIDIA request failed (${response.status})${detail ? `: ${String(detail).slice(0, 300)}` : ''}`);
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
