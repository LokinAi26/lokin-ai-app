export type DoorPinRecord = {
  id?: string;
  address: string;
  zip_code?: string | null;
  gps_latitude: number;
  gps_longitude: number;
  map_x?: number | null;
  map_y?: number | null;
  precise_location_description?: string | null;
  last_updated?: string;
  created_at?: string;
  driver_id?: string;
  verified_by_delivery_count?: number;
};

export type TriggerItemLocatorResult =
  | { triggered: false }
  | {
      triggered: true;
      store_name: string;
      item_count: number;
      items: Array<Record<string, unknown>>;
    };

export type SyncStoreInventoryResult = {
  synced_count: number;
  failed_items: string[];
  last_sync: string;
  store: string;
  source: string;
};
