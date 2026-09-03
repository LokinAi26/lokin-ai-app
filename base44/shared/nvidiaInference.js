// LOKIN NVIDIA Compute Fabric — local-first OpenAI-compatible inference bridge.
// Routes LLM/VLM work to an owner-controlled NVIDIA gateway or directly to a
// self-hosted NVIDIA NIM endpoint. Paid hosted AI is opt-in elsewhere.

function env(name) {
  try { if (typeof Deno !== 'undefined' && Deno?.env?.get) return String(Deno.env.get(name) || '').trim(); } catch {}
  try { if (typeof process !== 'undefined' && process?.env) return String(process.env[name] || '').trim(); } catch {}
  return '';
}

function boolEnv(name, fallback = false) {
  const value = env(name).toLowerCase();
  if (!value) return fallback;
  return ['1','true','yes','on','enabled'].includes(value);
}

function stripSlash(value) { return String(value || '').replace(/\/+$/, ''); }
function isVideoUrl(value) { return /\.(mp4|mov|m4v|webm|mkv)(?:$|[?#])/i.test(String(value || '')); }
function schemaInstruction(schema) {
  if (!schema) return '';
  return `\nReturn ONLY valid JSON matching this JSON Schema exactly:\n${JSON.stringify(schema)}`;
}
function parseModelText(text, schema = null) {
  const raw = String(text || '').trim();
  if (!schema) {
    try { return JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()); }
    catch { return raw; }
  }
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch (error) {
    const e = new Error(`NVIDIA model returned invalid JSON for a schema-bound request: ${String(error?.message || error)}`);
    e.code = 'LOKIN_NVIDIA_INVALID_JSON';
    throw e;
  }
}

export function nvidiaInferenceConfig() {
  const gatewayUrl = stripSlash(env('LOKIN_NVIDIA_GATEWAY_URL'));
  const nimUrl = stripSlash(env('LOKIN_NVIDIA_NIM_URL'));
  return {
    configured: Boolean(gatewayUrl || nimUrl),
    mode: gatewayUrl ? 'gateway' : (nimUrl ? 'direct_nim' : 'unconfigured'),
    gatewayUrl,
    gatewayToken: env('LOKIN_NVIDIA_GATEWAY_TOKEN'),
    nimUrl,
    nimToken: env('LOKIN_NVIDIA_NIM_TOKEN'),
    llmModel: env('LOKIN_NVIDIA_LLM_MODEL') || 'local-llm',
    vlmModel: env('LOKIN_NVIDIA_VLM_MODEL') || env('LOKIN_NVIDIA_LLM_MODEL') || 'local-vlm',
    timeoutMs: Math.max(5_000, Number(env('LOKIN_NVIDIA_TIMEOUT_MS') || 120_000)),
  };
}

export function paidAiFallbackAllowed() {
  return boolEnv('LOKIN_ALLOW_PAID_AI_FALLBACK', false);
}

async function requestJson(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
    if (!response.ok) {
      const error = new Error(`NVIDIA inference HTTP ${response.status}: ${String(body?.error || body?.message || raw || 'request failed')}`);
      error.code = 'LOKIN_NVIDIA_HTTP_ERROR';
      error.status = response.status;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function invokeGateway(cfg, args, meta) {
  const headers = { 'content-type':'application/json' };
  if (cfg.gatewayToken) headers.authorization = `Bearer ${cfg.gatewayToken}`;
  const body = await requestJson(`${cfg.gatewayUrl}/v1/lokin/invoke`, {
    method:'POST', headers, body:JSON.stringify({ args, meta })
  }, cfg.timeoutMs);
  return body?.result !== undefined ? body.result : body;
}

async function invokeDirectNim(cfg, args) {
  const fileUrls = Array.isArray(args?.file_urls) ? args.file_urls.filter(Boolean).map(String) : [];
  if (fileUrls.some(isVideoUrl)) {
    const error = new Error('Video QC requires LOKIN_NVIDIA_GATEWAY_URL so the gateway can extract and analyze frames locally.');
    error.code = 'LOKIN_NVIDIA_GATEWAY_REQUIRED_FOR_VIDEO_QC';
    throw error;
  }

  const schema = args?.response_json_schema || null;
  const prompt = `${String(args?.prompt || '')}${schemaInstruction(schema)}`;
  const content = fileUrls.length
    ? [{ type:'text', text:prompt }, ...fileUrls.map((url) => ({ type:'image_url', image_url:{ url } }))]
    : prompt;
  const headers = { 'content-type':'application/json' };
  if (cfg.nimToken) headers.authorization = `Bearer ${cfg.nimToken}`;
  const model = fileUrls.length ? cfg.vlmModel : cfg.llmModel;
  const payload = {
    model,
    messages:[{ role:'user', content }],
    temperature:Number.isFinite(Number(args?.temperature)) ? Number(args.temperature) : 0.2,
    max_tokens:Math.max(64, Math.min(8192, Number(args?.max_tokens || 2048))),
  };
  const body = await requestJson(`${cfg.nimUrl}/v1/chat/completions`, {
    method:'POST', headers, body:JSON.stringify(payload)
  }, cfg.timeoutMs);
  const text = body?.choices?.[0]?.message?.content ?? '';
  return parseModelText(text, schema);
}

export async function nvidiaInvokeLLM(args = {}, meta = {}) {
  const cfg = nvidiaInferenceConfig();
  if (!cfg.configured) {
    const error = new Error('LOKIN NVIDIA inference is not configured. Set LOKIN_NVIDIA_GATEWAY_URL or LOKIN_NVIDIA_NIM_URL.');
    error.code = 'LOKIN_NVIDIA_INFERENCE_REQUIRED';
    throw error;
  }
  return cfg.mode === 'gateway' ? invokeGateway(cfg, args, meta) : invokeDirectNim(cfg, args);
}
