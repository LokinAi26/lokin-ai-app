// Shared JSON request helper for print-on-demand catalog integrations
// (Printful, Printify). Plain module — no Deno.serve.

export async function jsonRequest({ url, method = "GET", headers = {}, body }) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const error =
      data?.error?.message ||
      data?.error?.reason ||
      (typeof data?.result === "string" ? data.result : null) ||
      data?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      `Request failed (${res.status})`;
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data };
}