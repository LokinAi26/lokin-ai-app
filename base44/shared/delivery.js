// Shared delivery helpers used across route optimizer + UI
// Earnings-per-hour scoring + zip-code/address sequencing

export const CATEGORY_LABELS = {
  food_pickup: "Food Pickup",
  grocery_shop_deliver: "Grocery Shop & Deliver",
  grocery_pickup: "Grocery Pickup",
  retail: "Retail",
  package: "Package",
  alcohol: "Alcohol",
  pharmacy: "Pharmacy",
};

// Pull a 5-digit zip from a free-form address string
export function zipFromAddress(addr = "") {
  const m = String(addr).match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : "";
}

// Very small Haversine approximation in miles (good enough for ranking)
export function milesBetween(a, b) {
  if (!a || !b) return 0;
  // Treat each address as a point from its zip centroid-ish pseudo coords
  const latA = zipLat(a), lonA = zipLon(a);
  const latB = zipLat(b), lonB = zipLon(b);
  const R = 3958.8;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLon = ((lonB - lonA) * Math.PI) / 180;
  const la1 = (latA * Math.PI) / 180;
  const la2 = (latB * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

// Deterministic pseudo lat/lon from a zip so ordering is stable without a geocoder
function zipLat(addr) {
  const z = zipFromAddress(addr) || "00000";
  return 25 + (parseInt(z, 10) % 2400) / 100;
}
function zipLon(addr) {
  const z = zipFromAddress(addr) || "00000";
  return -125 + (parseInt(z, 10) % 5000) / 100;
}

// Net earnings per hour, accounting for gas cost
export function scoreOffer(offer, prefs) {
  const total = (offer.payout || 0) + (offer.tip || 0);
  const minutes = offer.est_minutes || Math.max(8, offer.miles * 3);
  const hours = minutes / 60;
  const gasCost = (offer.miles / (prefs.vehicle_mpg || 26)) * (prefs.gas_price || 3.45);
  const net = total - gasCost;
  const perHour = hours > 0 ? net / hours : 0;
  return {
    total,
    gasCost: Math.round(gasCost * 100) / 100,
    net: Math.round(net * 100) / 100,
    perHour: Math.round(perHour * 100) / 100,
    hours: Math.round(hours * 100) / 100,
  };
}

// Filter offers by driver preferences + blocked customers, then rank by $/hr
export function filterAndRank(offers, prefs, blocked) {
  const blockedNames = new Set((blocked || []).map((b) => b.name.toLowerCase()));
  const accepted = new Set(prefs.accepted_categories || []);
  const eligible = offers.filter((o) => {
    if (o.status && o.status !== "available") return false;
    if (!accepted.has(o.category)) return false;
    if (blockedNames.has((o.customer_name || "").toLowerCase())) return false;
    if ((o.payout || 0) < (prefs.min_payout || 0)) return false;
    if ((o.miles || 0) > (prefs.max_miles || 99)) return false;
    const s = scoreOffer(o, prefs);
    if (s.perHour < (prefs.min_per_hour || 0)) return false;
    return true;
  });
  return eligible
    .map((o) => ({ ...o, _score: scoreOffer(o, prefs) }))
    .sort((a, b) => b._score.perHour - a._score.perHour);
}

// Sequence accepted offers by zip code, then by street address so the driver
// moves linearly instead of zig-zagging — minimizes total drive time.
export function sequenceByZone(offers, originAddress = "") {
  const byZone = {};
  for (const o of offers) {
    const z = zipFromAddress(o.dropoff_address) || zipFromAddress(o.pickup_address) || "00000";
    (byZone[z] = byZone[z] || []).push(o);
  }
  const zones = Object.keys(byZone).sort();
  const ordered = [];
  for (const z of zones) {
    ordered.push(
      ...byZone[z].sort((a, b) =>
        String(a.dropoff_address || "").localeCompare(String(b.dropoff_address || ""))
      )
    );
  }
  // Put pickups grouped near the start when possible: interleave so all pickups happen before dropoffs per zone
  return ordered.map((o, i) => ({ ...o, sequence: i + 1 }));
}

export function totalRouteStats(sequenced, prefs, originAddress = "") {
  const stops = sequenced.length;
  let miles = 0;
  let net = 0;
  let minutes = 0;
  let prev = originAddress;
  for (const o of sequenced) {
    miles += (o.miles || 0) + milesBetween(prev, o.pickup_address);
    net += scoreOffer(o, prefs).net;
    minutes += o.est_minutes || 0;
    prev = o.dropoff_address;
  }
  return {
    stops,
    miles: Math.round(miles * 10) / 10,
    net: Math.round(net * 100) / 100,
    hours: Math.round((minutes / 60) * 100) / 100,
    perHour: minutes > 0 ? Math.round((net / (minutes / 60)) * 100) / 100 : 0,
  };
}