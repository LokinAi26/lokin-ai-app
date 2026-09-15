import { secrets } from "base44:runtime";

// CARTO basemaps now stamp keyless raster-tile requests with an "API key
// required" watermark. A free basemap key (https://carto.com/basemaps/apikey)
// appended as ?key= removes it. Basemap keys are public-by-design, so serving
// the assembled tile URL to the app is safe; nothing else is exposed.
const KEYLESS_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export default async function(req: Request): Promise<Response> {
  try {
    let key = "";
    try {
      key = String(secrets.get("CARTO_BASEMAP_API_KEY") || "").trim();
    } catch {
      key = "";
    }
    if (!key) {
      // Key not configured yet — keep maps rendering (watermarked tiles).
      return Response.json({ tile_url: KEYLESS_TILE_URL, keyed: false });
    }
    return Response.json({
      tile_url: `${KEYLESS_TILE_URL}?key=${encodeURIComponent(key)}`,
      keyed: true,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "basemap-config failed" },
      { status: 500 }
    );
  }
}