#!/usr/bin/env python3
"""Build the static Hampton Roads retail-building cache.

Fetches real OpenStreetMap retail/commercial building footprints from Overpass
in a tile grid, dedupes by OSM way id, and writes a single GeoJSON file the
app's retail layer loads as its primary data source.

Why: Overpass (the live OSM query service) flaps. The app's retail layer must
never depend on it at view time. This cache is real OSM data, stored locally —
the layer falls back to it instantly and only uses live Overpass as a silent
background refresh.

Coverage: Hampton Roads metro core —
  lat 36.70 - 37.10, lon -76.65 - -75.90
  (Virginia Beach, Norfolk, Chesapeake, Portsmouth, Suffolk, Hampton,
   Newport News and the retail corridors between them.)

Query family matches the app's live query in src/lib/retailExtrusion.js:
  way["building"~"retail|commercial|supermarket|warehouse"];
  way["shop"]; way["amenity"~"restaurant|fast_food|cafe"];
Only closed ways with real geometry are kept. Slivers/sheds are dropped with
the same area cutoff as the app. Heights follow the app's documented rule:
OSM height tag -> building:levels * 3.4 m -> documented 7 m retail fallback
(flagged as estimated).

Crash-safe: per-tile result files land in scripts/.retail-cache-tiles/; the
final merge reads those files, so an interrupted run resumes instead of
restarting. Tiles that fail every endpoint stay listed and are retried on
later passes.

Usage:
  python3 scripts/build-retail-cache.py          # fetch + merge
  python3 scripts/build-retail-cache.py --merge  # merge existing tiles only
"""

import json
import math
import os
import subprocess
import sys
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
TILE_DIR = os.path.join(HERE, ".retail-cache-tiles")
OUT_PATH = os.path.join(REPO, "public", "data", "retail-cache.geojson")

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Hampton Roads metro core
LAT_MIN, LAT_MAX = 36.70, 37.10
LON_MIN, LON_MAX = -76.65, -75.90
STEP_LAT, STEP_LON = 0.04, 0.05

PER_TILE_CAP = 5000
QUERY_TIMEOUT = 60
CURL_TIMEOUT = 95
RETRY_SLEEPS = [3, 8, 15]  # between endpoint attempts
MAX_PASSES = 120  # cheap passes: keep trying for many hours
PASS_SLEEP = 300  # 5 min between passes — polite to a struggling service
# Circuit breaker: when the service is fully down, abort the pass early after
# this many consecutive all-endpoint failures instead of burning hours.
CONSECUTIVE_FAIL_ABORT = 12

DEFAULT_RETAIL_HEIGHT_M = 7.0
LEVEL_HEIGHT_M = 3.4
SLIVER_CUTOFF_DEG2 = 1.1e-8  # same as the app: ~150 m^2


def tiles():
    out = []
    lat = LAT_MIN
    while lat < LAT_MAX:
        lon = LON_MIN
        while lon < LON_MAX:
            out.append((lat, min(lat + STEP_LAT, LAT_MAX),
                        lon, min(lon + STEP_LON, LON_MAX)))
            lon += STEP_LON
        lat += STEP_LAT
    return out


def tile_name(s, w, n, e):
    return f"{s:.2f}_{w:.2f}_{n:.2f}_{e:.2f}.json"


def build_query(s, w, n, e):
    bbox = f"{s:.5f},{w:.5f},{n:.5f},{e:.5f}"
    return (
        f"[out:json][timeout:{QUERY_TIMEOUT}];"
        f'(way["building"~"retail|commercial|supermarket|warehouse"]({bbox});'
        f'way["shop"]({bbox});'
        f'way["amenity"~"restaurant|fast_food|cafe"]({bbox}););'
        f"out geom tags {PER_TILE_CAP};"
    )


def fetch_tile(query):
    body = "data=" + urllib.parse.quote(query)
    for attempt, endpoint in enumerate(ENDPOINTS * 2):  # primary->fallback->primary->fallback
        if attempt > 0:
            time.sleep(RETRY_SLEEPS[min(attempt - 1, len(RETRY_SLEEPS) - 1)])
        try:
            p = subprocess.run(
                ["curl", "-s", "--max-time", str(CURL_TIMEOUT),
                 "-X", "POST",
                 "-H", "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
                 "--data-binary", "@-",
                 endpoint],
                input=body.encode(), capture_output=True, timeout=CURL_TIMEOUT + 15,
            )
        except Exception as ex:
            print(f"    curl error: {ex}", flush=True)
            continue
        if p.returncode != 0:
            print(f"    {endpoint} curl exit {p.returncode}", flush=True)
            continue
        try:
            data = json.loads(p.stdout.decode("utf-8", "replace"))
        except Exception:
            print(f"    {endpoint} bad/empty response ({len(p.stdout)} bytes)", flush=True)
            continue
        if not isinstance(data, dict) or "elements" not in data:
            print(f"    {endpoint} unexpected payload", flush=True)
            continue
        return data["elements"]
    return None


def parse_height(tags):
    raw = (tags.get("height") or "")
    if isinstance(raw, str):
        num = "".join(c for c in raw if c.isdigit() or c == ".")
        try:
            h = float(num)
            if h > 0:
                return min(h, 60.0), False
        except (TypeError, ValueError):
            pass
    try:
        levels = float(tags.get("building:levels") or 0)
        if levels > 0:
            return min(levels * LEVEL_HEIGHT_M, 60.0), False
    except Exception:
        pass
    return DEFAULT_RETAIL_HEIGHT_M, True


def ring_area_deg2(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(s / 2)


def elements_to_features(elements):
    feats = []
    for el in elements or []:
        if el.get("type") != "way":
            continue
        geom = el.get("geometry") or []
        if len(geom) < 4:
            continue
        ring = [[round(p["lon"], 5), round(p["lat"], 5)] for p in geom]
        if ring[0] != ring[-1]:
            ring.append([ring[0][0], ring[0][1]])
        if ring_area_deg2(ring) < SLIVER_CUTOFF_DEG2:
            continue
        tags = el.get("tags") or {}
        height, estimated = parse_height(tags)
        feats.append({
            "type": "Feature",
            "properties": {
                "id": f"w{el.get('id')}",
                "name": tags.get("name") or tags.get("brand") or "",
                "height_m": round(height, 1),
                "estimated": estimated,
            },
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        })
    return feats


def fetch_all():
    os.makedirs(TILE_DIR, exist_ok=True)
    all_tiles = tiles()
    print(f"{len(all_tiles)} tiles to fetch", flush=True)
    pending = [t for t in all_tiles
               if not os.path.exists(os.path.join(TILE_DIR, tile_name(*t)))]
    print(f"{len(pending)} tiles pending (rest already on disk)", flush=True)
    for pass_no in range(1, MAX_PASSES + 1):
        if not pending:
            break
        print(f"--- pass {pass_no}: {len(pending)} tiles pending ---", flush=True)
        still_pending = []
        consec_fail = 0
        for i, t in enumerate(pending):
            s, n, w, e = t[1], t[3], t[0], t[2]
            print(f"[{i+1}/{len(pending)}] tile {tile_name(*t)}", flush=True)
            els = fetch_tile(build_query(s, w, n, e))
            if els is None:
                print("    FAILED all endpoints", flush=True)
                still_pending.append(t)
                consec_fail += 1
                if consec_fail >= CONSECUTIVE_FAIL_ABORT:
                    print(f"    circuit breaker: {consec_fail} consecutive failures, "
                          f"aborting pass early", flush=True)
                    # everything not yet tried stays pending for the next pass
                    still_pending.extend(pending[i + 1:])
                    break
                continue
            consec_fail = 0
            feats = elements_to_features(els)
            with open(os.path.join(TILE_DIR, tile_name(*t)), "w") as f:
                json.dump(feats, f)
            print(f"    ok: {len(els)} ways -> {len(feats)} buildings", flush=True)
        pending = still_pending
        if pending and pass_no < MAX_PASSES:
            print(f"sleeping {PASS_SLEEP}s before next pass...", flush=True)
            time.sleep(PASS_SLEEP)
    if pending:
        print(f"WARNING: {len(pending)} tiles never fetched:", flush=True)
        for t in pending:
            print("   ", tile_name(*t), flush=True)
    return pending


def merge():
    feats = {}
    named = 0
    files = sorted(f for f in os.listdir(TILE_DIR) if f.endswith(".json"))
    for fn in files:
        try:
            with open(os.path.join(TILE_DIR, fn)) as f:
                tile_feats = json.load(f)
        except Exception as ex:
            print(f"skip {fn}: {ex}", flush=True)
            continue
        for feat in tile_feats:
            fid = feat["properties"]["id"]
            if fid not in feats:
                feats[feat["properties"]["id"]] = feat
                if feat["properties"]["name"]:
                    named += 1
    collection = {
        "type": "FeatureCollection",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "source": "OpenStreetMap building footprints via Overpass API (real data, no synthesis)",
        "coverage": {"lat_min": LAT_MIN, "lat_max": LAT_MAX,
                     "lon_min": LON_MIN, "lon_max": LON_MAX},
        "height_rule": "OSM height tag, else building:levels * 3.4 m, else documented 7 m retail fallback (estimated=true)",
        "features": list(feats.values()),
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(collection, f, separators=(",", ":"))
    size_mb = os.path.getsize(OUT_PATH) / 1e6
    print(f"wrote {OUT_PATH}", flush=True)
    print(f"buildings: {len(feats)} ({named} named) | {size_mb:.2f} MB", flush=True)
    return len(feats), named, size_mb


def main():
    only_merge = "--merge" in sys.argv
    pending = []
    if not only_merge:
        pending = fetch_all()
    total, named, size_mb = merge()
    if pending:
        print(f"DONE with gaps: {len(pending)} tiles missing, {total} buildings cached", flush=True)
        sys.exit(2)
    print(f"DONE: full coverage, {total} buildings ({named} named)", flush=True)


if __name__ == "__main__":
    main()
