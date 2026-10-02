type StoreInventoryItem = {
  name: string;
  barcode?: string;
  item_code?: string;
  aisle?: string;
  shelf?: string;
  department?: string;
  price?: number;
  inventory_count?: number;
};

type SyncContext = {
  store_location_code: string;
  api_key_id?: string;
};

type SyncResult = {
  store: string;
  items: StoreInventoryItem[];
};

type SyncHandler = (context: SyncContext) => Promise<SyncResult>;

function placeholderHandler(store: string): SyncHandler {
  return async ({ store_location_code }) => {
    console.log(`[syncStoreInventory] Placeholder ${store} sync for store code "${store_location_code}"`);
    return { store, items: [] };
  };
}

const REGISTRY: Record<string, SyncHandler> = {
  walmart: placeholderHandler("walmart"),
  kroger: placeholderHandler("kroger"),
  target: placeholderHandler("target"),
  custom: placeholderHandler("custom"),
};

export function supportedStoreApis() {
  return Object.keys(REGISTRY);
}

export async function syncFromStoreApi(source: string, context: SyncContext): Promise<SyncResult> {
  const key = String(source || "").trim().toLowerCase();
  const handler = REGISTRY[key];
  if (!handler) {
    throw new Error(`Unsupported store_api_source "${source}". Supported: ${supportedStoreApis().join(", ")}`);
  }
  return handler(context);
}
