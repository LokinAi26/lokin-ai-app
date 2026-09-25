#!/usr/bin/env python3
"""Build the static Hampton Roads retail-building cache from a Geofabrik extract.

Deterministic alternative to scripts/build-retail-cache.py (which polls the
flappy Overpass API). Consumes the GeoJSON produced by:

  osmium tags-filter virginia-260924.osm.pbf \\
    'w/building=retail,commercial,supermarket,warehouse' 'w/shop' \\
    'w/amenity=restaurant,fast_food,cafe' -o retail-ways.osm.pbf --overwrite
  osmium export retail-ways.osm.pbf --geometry-types=polygon \\
    -o retail-ways.geojson --overwrite

then keeps only closed ways inside the metro bbox, dedupes by OSM id, applies
the app's documented height rule, and writes the compact cache the retail
layer loads at public/data/retail-cache.geojson.

Usage:
  python3 scripts/build-retail-cache-from-extract.py <osmium-export.geojson>
"""

import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT_PATH = os.path.join(REPO, "public", "data", "retail-cache.geojson")

LAT_MIN, LAT_MAX = 36.70, 37.10
LON_MIN, LON_MAX = -76.65, -75.90

DEFAULT_RETAIL_HEIGHT_M = 7.0
LEVEL_HEIGHT_M = 3.4
SLIVER_CUTOFF_DEG2 = 1.1e-8  # same as the app: ~150 m^2


def parse_height(tags):
    # OSM height is meters by convention, but US mappers sometimes tag feet
    # (37' or 37 ft). Convert so a KFC tagged 37' never renders 37 m tall.
    raw = tags.get("height") or ""
    if isinstance(raw, str):
        num = "".join(c for c in raw if c.isdigit() or c == ".")
        try:
            h = float(num)
            if h > 0:
                if "'" in raw or "ft" in raw.lower() or "feet" in raw.lower():
                    h *= 0.3048
                return min(h, 60.0), False
        except (TypeError, ValueError):
            pass
    try:
        levels = float(tags.get("building:levels") or 0)
        if levels > 0:
            return min(levels * LEVEL_HEIGHT_M, 60.0), False
    except (TypeError, ValueError):
        pass
    return DEFAULT_RETAIL_HEIGHT_M, True


def ring_area_deg2(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(s / 2)


def main():
    src = sys.argv[1]
    print(f"reading {src} ...", flush=True)
    with open(src) as f:
        data = json.load(f)
    feats = data.get("features") or []
    print(f"{len(feats)} raw features", flush=True)

    seen = set()
    out = []
    named = 0
    skipped_bbox = 0
    skipped_sliver = 0
    for feat in feats:
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        # osmium export emits MultiPolygon; take the largest outer ring.
        polys = []
        if gtype == "Polygon":
            polys = [coords[0]] if coords else []
        elif gtype == "MultiPolygon":
            for poly in coords:
                if poly:
                    polys.append(poly[0])
        if not polys:
            continue
        ring = max(polys, key=ring_area_deg2)
        ring = [[round(p[0], 5), round(p[1], 5)] for p in ring]
        if len(ring) < 4:
            continue
        if ring[0] != ring[-1]:
            ring.append([ring[0][0], ring[0][1]])
        # metro bbox check on ring centroid
        cx = sum(p[0] for p in ring) / len(ring)
        cy = sum(p[1] for p in ring) / len(ring)
        if not (LON_MIN <= cx <= LON_MAX and LAT_MIN <= cy <= LAT_MAX):
            skipped_bbox += 1
            continue
        if ring_area_deg2(ring) < SLIVER_CUTOFF_DEG2:
            skipped_sliver += 1
            continue
        props = feat.get("properties") or {}
        tags = props.get("tags") or props
        oid = props.get("@id") or props.get("id") or f"{cx:.5f},{cy:.5f}"
        if oid in seen:
            continue
        seen.add(oid)
        height, estimated = parse_height(tags)
        name = tags.get("name") or tags.get("brand") or ""
        if name:
            named += 1
        out.append({
            "type": "Feature",
            "properties": {
                "id": str(oid),
                "name": name,
                "height_m": round(height, 1),
                "estimated": estimated,
            },
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        })

    collection = {
        "type": "FeatureCollection",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "source": "OpenStreetMap building footprints via Geofabrik Virginia extract (real data, no synthesis)",
        "coverage": {"lat_min": LAT_MIN, "lat_max": LAT_MAX,
                     "lon_min": LON_MIN, "lon_max": LON_MAX},
        "height_rule": "OSM height tag (meters; foot-marked values converted at 0.3048), else building:levels * 3.4 m, else documented 7 m retail fallback (estimated=true)",
        "features": out,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(collection, f, separators=(",", ":"))
    size_mb = os.path.getsize(OUT_PATH) / 1e6
    print(f"wrote {OUT_PATH}", flush=True)
    print(f"buildings: {len(out)} ({named} named) | {size_mb:.2f} MB", flush=True)
    print(f"skipped: {skipped_bbox} outside bbox, {skipped_sliver} slivers", flush=True)


if __name__ == "__main__":
    main()
