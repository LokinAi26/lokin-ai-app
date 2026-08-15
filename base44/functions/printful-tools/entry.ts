import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { getEffectiveToken } from "../../shared/printfulOAuth.ts";
import { jsonRequest } from "../../shared/printRequest.ts";

/**
 * printful-tools — Printful capability surface exposed to ChatGPT / the app UI over
 * the connected OAuth account (falls back to the shared personal token).
 * Secures Printful's File Library, Product Templates, Mockup Generator, and Webhook
 * configuration behind a backend function so tokens never reach the client.
 *
 * Client call: base44.functions.invoke('printful-tools', { action, ... })
 *
 * Actions (payload.action):
 *   addFile         file library — add a new file (file_url, optional file_name)
 *   file            file library — get a single file by id
 *   templates       product templates — list (paginated)
 *   template        product templates — single by id
 *   mockupTask      mockup generator — create a generation task (product_id, variant_ids[], files[])
 *   mockupResult    mockup generator — poll a task by id for status + mockup URLs
 *   printfiles      mockup generator — retrieve printfile specs for a product/variant
 *   layoutTemplates mockup generator — list layout templates
 *   getWebhook      webhook config — read current webhook url + events
 *   setWebhook      webhook config — set webhook url + events[]
 *
 * Docs: https://developers.printful.com
 */
const API = "https://api.printful.com";
const VALID_ACTIONS = ["addFile", "file", "templates", "template", "mockupTask", "mockupResult", "printfiles", "layoutTemplates", "getWebhook", "setWebhook"];

async function pfGet(path: string, token: string, storeId: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (storeId) headers["X-PF-Store-Id"] = String(storeId);
  const r = await jsonRequest({ url: `${API}${path}`, headers });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, code: r.data?.code, result: r.data?.result, paging: r.data?.paging, extras: r.data?.extras };
}

async function pfPost(path: string, token: string, storeId: string, body: any) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (storeId) headers["X-PF-Store-Id"] = String(storeId);
  const r = await jsonRequest({ url: `${API}${path}`, method: "POST", headers, body });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  return { ok: true, code: r.data?.code, result: r.data?.result };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "").toLowerCase();
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json({ error: `Invalid action. Use one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
    }

    const { token, storeId: tokenStoreId } = await getEffectiveToken(base44, user);
    if (!token) return Response.json({ error: "No Printful OAuth connection or PRINTFUL_API_TOKEN configured." }, { status: 500 });
    const storeId = payload.storeId || tokenStoreId || "";

    // ----- File library: add a new file -----
    if (action === "addFile") {
      const fileUrl = String(payload.file_url || "").trim();
      const fileName = String(payload.file_name || "").trim();
      if (!fileUrl) return Response.json({ error: "file_url is required." }, { status: 400 });
      const body: any = { url: fileUrl };
      if (fileName) body.name = fileName;
      const r = await pfPost(`/store/files`, token, storeId, body);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ file: r.result });
    }

    // ----- File library: get a file -----
    if (action === "file") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required." }, { status: 400 });
      const r = await pfGet(`/store/files/${encodeURIComponent(id)}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ file: r.result });
    }

    // ----- Product templates: list -----
    if (action === "templates") {
      const offset = Math.max(0, Number(payload.offset) || 0);
      const limit = Math.min(100, Math.max(1, Number(payload.limit) || 50));
      const r = await pfGet(`/store/product-templates?offset=${offset}&limit=${limit}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ templates: r.result, paging: r.paging });
    }

    // ----- Product templates: single -----
    if (action === "template") {
      const id = String(payload.id || "");
      if (!id) return Response.json({ error: "id is required." }, { status: 400 });
      const r = await pfGet(`/store/product-templates/${encodeURIComponent(id)}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ template: r.result });
    }

    // ----- Mockup generator: create a task -----
    if (action === "mockupTask") {
      const productId = Number(payload.product_id);
      if (!productId) return Response.json({ error: "product_id is required." }, { status: 400 });
      const variantIds = Array.isArray(payload.variant_ids) ? payload.variant_ids : [];
      const files = Array.isArray(payload.files) ? payload.files : [];
      const body: any = {
        product_id: productId,
        variant_ids: variantIds,
        files,
        format: payload.format || "jpg",
        crop: payload.crop !== undefined ? payload.crop : true,
      };
      if (payload.options) body.options = payload.options;
      const r = await pfPost(`/mockup-generator/tasks`, token, storeId, body);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ task: r.result });
    }

    // ----- Mockup generator: task result -----
    if (action === "mockupResult") {
      const id = String(payload.id || payload.task_id || "");
      if (!id) return Response.json({ error: "id is required." }, { status: 400 });
      const r = await pfGet(`/mockup-generator/tasks/${encodeURIComponent(id)}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ task: r.result });
    }

    // ----- Mockup generator: variant printfiles -----
    if (action === "printfiles") {
      const productId = Number(payload.product_id);
      if (!productId) return Response.json({ error: "product_id is required." }, { status: 400 });
      const variantId = payload.variant_id ? `&variant_id=${encodeURIComponent(payload.variant_id)}` : "";
      const technique = payload.technique ? `&technique=${encodeURIComponent(payload.technique)}` : "";
      const r = await pfGet(`/mockup-generator/printfiles/${productId}?${variantId}${technique}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ printfiles: r.result });
    }

    // ----- Mockup generator: layout templates -----
    if (action === "layoutTemplates") {
      const offset = Math.max(0, Number(payload.offset) || 0);
      const limit = Math.min(100, Math.max(1, Number(payload.limit) || 50));
      const technique = payload.technique ? `&technique=${encodeURIComponent(payload.technique)}` : "";
      const productId = payload.product_id ? `&product_id=${encodeURIComponent(payload.product_id)}` : "";
      const r = await pfGet(`/mockup-generator/layout-templates?offset=${offset}&limit=${limit}${technique}${productId}`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ layout_templates: r.result, paging: r.paging });
    }

    // ----- Webhooks: get config -----
    if (action === "getWebhook") {
      const r = await pfGet(`/store/webhooks`, token, storeId);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ webhook: r.result });
    }

    // ----- Webhooks: set config -----
    if (action === "setWebhook") {
      const url = String(payload.url || "").trim();
      if (!url) return Response.json({ error: "url is required." }, { status: 400 });
      const body: any = { url };
      if (Array.isArray(payload.events)) body.events = payload.events;
      const r = await pfPost(`/store/webhooks`, token, storeId, body);
      if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
      return Response.json({ webhook: r.result });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("printful-tools error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}