import { withDeadline } from "../../base44/shared/requestDeadline.js";

const pendingByClient = new WeakMap();

// Share simultaneous calls and stop waiting at the deadline. The SDK does not expose cancellation.
export function requestRouteOptimization(client, payload) {
  let pending = pendingByClient.get(client);
  if (!pending) {
    pending = new Map();
    pendingByClient.set(client, pending);
  }
  const key = JSON.stringify(payload);
  if (pending.has(key)) return pending.get(key);
  const request = withDeadline(
    () => client.functions.invoke("optimizeRoute", payload),
    30000,
    "contacting the route service",
  ).finally(() => {
    pending.delete(key);
  });
  pending.set(key, request);
  return request;
}
