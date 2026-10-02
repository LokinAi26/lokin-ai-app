export const STORE_API_REGISTRY = {
  walmart: { endpoint: "/api/functions/syncStoreInventory", description: "Walmart inventory sync placeholder" },
  kroger: { endpoint: "/api/functions/syncStoreInventory", description: "Kroger inventory sync placeholder" },
  target: { endpoint: "/api/functions/syncStoreInventory", description: "Target inventory sync placeholder" },
  custom: { endpoint: "/api/functions/syncStoreInventory", description: "Custom inventory sync placeholder" },
};

export function supportedStoreApiSources() {
  return Object.keys(STORE_API_REGISTRY);
}
