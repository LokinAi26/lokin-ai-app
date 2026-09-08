import { withDeadline } from "../../base44/shared/requestDeadline.js";

const pendingByClient = new WeakMap();

// Share simultaneous calls and abort the HTTP request when its deadline expires.
export function requestRouteOptimization(client, payload) {
  let pending = pendingByClient.get(client);
  if (!pending) {
    pending = new Map();
    pendingByClient.set(client, pending);
  }
  const key = JSON.stringify(payload);
  if (pending.has(key)) return pending.get(key);
  const controller = new AbortController();
  const request = withDeadline(async () => {
    const response = await client.functions.fetch("/optimizeRoute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data?.error || "Route optimization failed. Please try again.");
      error.code = data?.code;
      error.response = { status: response.status, data };
      throw error;
    }
    return { data };
  }, 30000, "contacting the route service").finally(() => {
    controller.abort();
    pending.delete(key);
  });
  pending.set(key, request);
  return request;
}
