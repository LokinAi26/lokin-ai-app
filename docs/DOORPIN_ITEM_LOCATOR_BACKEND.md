# Door PIN + Item Locator Backend Integration

## Entity Schema Overview

### DoorPin
- `address` (string, normalized address key per driver)
- `zip_code` (string, Virginia ZIP filtering)
- `gps_latitude` / `gps_longitude` (number)
- `map_x` / `map_y` (number)
- `precise_location_description` (string)
- `last_updated` / `created_at` (ISO timestamp)
- `driver_id` (string)
- `verified_by_delivery_count` (number)

### LocatorItem additions
- `geofence_latitude` / `geofence_longitude` / `geofence_radius_meters`
- `store_api_source`, `store_api_sync_status`, `store_api_last_sync`
- `driver_reports_count`, `last_driver_report`

## Functions

- `saveDoorPin`: upserts per `address + driver_id`, increments verification count, validates finite coordinates.
- `getDoorPin`: returns a single pin by address or a list by driver / Virginia ZIP.
- `triggerItemLocator`: checks incoming GPS position against all known item geofences and returns store items when inside radius.
- `reportItemLocation`: records crowd reports and confidence-weighted map coordinate averages.
- `syncStoreInventory`: pluggable store sync with placeholder handlers and 1-hour in-function cache.

## Store API Registry Structure

- Backend registry: `base44/shared/storeApiRegistry.ts`
  - Placeholder handlers for `walmart`, `kroger`, `target`, `custom`.
- Frontend registry: `src/lib/storeApiRegistry.js`
  - Maps source keys to sync endpoint metadata for future UI wiring.

## React Usage Examples

### Door pin save on delivery

```js
const { saveDoorPin } = useDoorPin(currentAddress);
await saveDoorPin({
  targetAddress: currentAddress,
  latitude: fix.latitude,
  longitude: fix.longitude,
  description: "manual driver pin",
});
```

### GPS geofence trigger loop

```js
const { geofenceResult, reportItemLocation } = useItemLocator({ enabled: true });
if (geofenceResult.triggered) {
  // show geofence banner + quick search
}
```
