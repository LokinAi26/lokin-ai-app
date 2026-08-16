// Shared JSON request helper for print-on-demand catalog integrations
// (Printful, Printify). Plain module — no Deno.serve.

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retryable = (status) => status === 408 || status === 429 || status >= 500;

function safeError(data, status) {
  return data?.error?.message || data?.error?.reason ||
    (typeof data?.result === "string" ? data.result : null) || data?.message ||
    (typeof data?.error === "string" ? data.error : null) || `Request failed (${status})`;
}

export async function jsonRequest({ url, method = "GET", headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const requestId = crypto.randomUUID();
  let last = { ok: false, status: 0, error: "Provider request failed", requestId };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init = {
        method,
        headers: { ...headers, "X-LOKIN-Request-Id": requestId },
        signal: controller.signal,
      };
      if (body !== undefined) {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      const res = await fetch(url, init);
      let data;
      try { data = await res.json(); } catch { data = null; }
      if (res.ok) return { ok: true, data, status: res.status, headers: res.headers, requestId, attempt };

      last = { ok: false, status: res.status, error: safeError(data, res.status), requestId, attempt };
      if (!retryable(res.status) || attempt === MAX_ATTEMPTS) return last;

      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 250 * (2 ** (attempt - 1)));
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      last = { ok: false, status: timedOut ? 408 : 0, error: timedOut ? "Provider request timed out" : "Provider network request failed", requestId, attempt };
      if (attempt === MAX_ATTEMPTS) return last;
      await sleep(250 * (2 ** (attempt - 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  return last;
}