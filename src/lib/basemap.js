import { base44LiveFunctions } from "@/api/base44Client";

// Keyless CARTO dark basemap. CARTO stamps these tiles with an "API key
// required" watermark until a free basemap key is appended, so basemap-config
// returns the keyed URL once CARTO_BASEMAP_API_KEY is set in secrets.
export const CARTO_KEYLESS_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

let tileUrlPromise = null;

// Resolves once per session; falls back to the keyless URL on any failure so
// maps always render.
export function getBasemapTileUrl() {
  if (!tileUrlPromise) {
    tileUrlPromise = base44LiveFunctions.functions
      .invoke("basemap-config", {})
      .then((res) => res?.data?.tile_url || CARTO_KEYLESS_TILE_URL)
      .catch(() => CARTO_KEYLESS_TILE_URL);
  }
  return tileUrlPromise;
}