// Shared LOKIN AI delivery helpers — route optimization, true earning rate,
// Lock In Score. Used by backend functions (and mirrored for frontend constants).

export const CATEGORY_LABELS = {
  food_pickup: "Food Pickup",
  grocery_shop_deliver: "Grocery Shop & Deliver",
  grocery_pickup: "Grocery Pickup",
  retail: "Retail",
  package: "Package",
  alcohol: "Alcohol",
  pharmacy: "Pharmacy",
};

export const OPTIMIZATION_MODES = [
  { value: "fastest", label: "Fastest" },
  { value: "most_profit", label: "Most Profit" },
  { value: "most_money", label: "Most Money" },
  { value: "goal_mode", label: "Goal Mode" },
  { value: "low_stress", label: "Low-Stress" },
  { value: "minimum_mileage", label: "Minimum Mileage" },
  { value: "homeward", label: "Homeward" },
];

export const WORK_MODES = [
  { value: "delivery", label: "Delivery" },
  { value: "shop_deliver", label: "Shop & Deliver" },
  { value: "grocery_pickup", label: "Grocery Pickup" },
  { value: "grocery_shopping", label: "Grocery Shopping" },
  { value: "rideshare", label: "Rideshare" },
  { value: "packages", label: "Packages" },
  { value: "catering", label: "Catering" },
  { value: "tasks", label: "Tasks" },
  { value: "field_work", label: "Field Work" },
  { value: "other", label: "Other" },
];

export const WORK_FILTERS = [
  { value: "food_delivery", label: "Food Delivery" },
  { value: "grocery", label: "Grocery" },
  { value: "shop_deliver", label: "Shop & Deliver" },
  { value: "package", label: "Package Delivery" },
  { value: "catering", label: "Catering" },
  { value: "large_orders", label: "Large Orders" },
  { value: "short_distance", label: "Short-Distance Orders" },
  { value: "high_paying", label: "High-Paying Orders" },
  { value: "stacked", label: "Stacked Orders" },
];

// Pull a 5-digit zip from a free-form address string
export function zipFromAddress(addr = "") {
  const m = String(addr).match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : "";
}

// Very small Haversine approximation in miles (good enough for ranking)
export function milesBetween(a, b) {
  if (!a || !b) return 0;
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

function zipLat(addr) {
  const z = zipFromAddress(addr) || "00000";
  return 25 + (parseInt(z, 10) % 2400) / 100;
}
function zipLon(addr) {
  const z = zipFromAddress(addr) || "00000";
  return -125 + (parseInt(z, 10) % 5000) / 100;
}

// True earning rate — gross, fuel, mileage cost, expenses, net, $/hr (gross + net)
export function trueEarningRate(offer, prefs = {}) {
  const total = (offer.payout || 0) + (offer.tip || 0);
  const minutes = offer.est_minutes || Math.max(8, offer.miles * 3);
  const hours = minutes / 60;
  const fuel = (offer.miles / (prefs.vehicle_mpg || 26)) * (prefs.gas_price || 3.45);
  const mileageCost = offer.miles * (prefs.mileage_cost || 0);
  const expenses = fuel + mileageCost;
  const net = total - expenses;
  return {
    gross: Math.round(total * 100) / 100,
    fuel: Math.round(fuel * 100) / 100,
    mileage: offer.miles,
    mileageCost: Math.round(mileageCost * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    net: Math.round(net * 100) / 100,
    minutes,
    hours: Math.round(hours * 100) / 100,
    grossPerHour: hours > 0 ? Math.round((total / hours) * 100) / 100 : 0,
    netPerHour: hours > 0 ? Math.round((net / hours) * 100) / 100 : 0,
  };
}

// Backwards-compatible net/hr score (kept for any older callers)
export function scoreOffer(offer, prefs) {
  const t = trueEarningRate(offer, prefs);
  return { total: t.gross, gasCost: t.fuel, net: t.net, perHour: t.netPerHour, hours: t.hours };
}

// Filter offers by driver prefs + blocked customers + avoid list, then rank
export function filterAndRank(offers, prefs, blocked, avoidPlaces = []) {
  const blockedNames = new Set((blocked || []).map((b) => String(b.name).toLowerCase()));
  const avoidNames = (avoidPlaces || []).map((a) => String(a.name).toLowerCase());
  const accepted = new Set(prefs.accepted_categories || []);
  const eligible = offers.filter((o) => {
    if (o.status && o.status !== "available") return false;
    if (!accepted.has(o.category)) return false;
    const cust = String(o.customer_name || "").toLowerCase();
    const merch = String(o.merchant || "").toLowerCase();
    const drop = String(o.dropoff_address || "").toLowerCase();
    if (blockedNames.has(cust)) return false;
    if (avoidNames.some((n) => n && (merch.includes(n) || drop.includes(n) || cust.includes(n)))) return false;
    if ((o.payout || 0) < (prefs.min_payout || 0)) return false;
    if ((o.miles || 0) > (prefs.max_miles || 99)) return false;
    if (trueEarningRate(o, prefs).netPerHour < (prefs.min_per_hour || 0)) return false;
    return true;
  });
  return eligible
    .map((o) => ({ ...o, _score: trueEarningRate(o, prefs) }))
    .sort((a, b) => b._score.netPerHour - a._score.netPerHour);
}

// Re-rank eligible offers by the selected optimization mode
export function rankByMode(eligible, mode = "most_profit", originAddress = "") {
  const cmp = {
    fastest: (a, b) => (a.est_minutes || 99) - (b.est_minutes || 99),
    most_profit: (a, b) => b._score.netPerHour - a._score.netPerHour,
    most_money: (a, b) => b._score.gross - a._score.gross,
    goal_mode: (a, b) => b._score.net - a._score.net,
    low_stress: (a, b) => (a.miles - b.miles) || ((a.est_minutes || 99) - (b.est_minutes || 99)),
    minimum_mileage: (a, b) => a.miles - b.miles,
    homeward: (a, b) =>
      milesBetween(a.dropoff_address, originAddress) - milesBetween(b.dropoff_address, originAddress),
  };
  return [...eligible].sort(cmp[mode] || cmp.most_profit);
}

// Sequence accepted offers by zip code, then by street address so the driver
// moves linearly instead of zig-zagging — minimizes total drive time.
export function sequenceByZone(offers, originAddress = "") {
  const byZone = {};
  for (const o of offers) {
    const z = zipFromAddress(o.dropoff_address) || zipFromAddress(o.pickup_address) || "00000";
    (byZone[z] = byZone[z] || []).push(o);
  }
  return Object.keys(byZone)
    .sort()
    .flatMap((z) =>
      byZone[z]
        .sort((a, b) => String(a.dropoff_address || "").localeCompare(String(b.dropoff_address || "")))
    )
    .map((o, i) => ({ ...o, sequence: i + 1 }));
}

export function totalRouteStats(sequenced, prefs, originAddress = "") {
  const stops = sequenced.length;
  let miles = 0, net = 0, gross = 0, fuel = 0, minutes = 0;
  let prev = originAddress;
  for (const o of sequenced) {
    miles += (o.miles || 0) + milesBetween(prev, o.pickup_address);
    const t = trueEarningRate(o, prefs);
    net += t.net; gross += t.gross; fuel += t.fuel; minutes += o.est_minutes || 0;
    prev = o.dropoff_address;
  }
  const hours = minutes / 60;
  return {
    stops,
    miles: Math.round(miles * 10) / 10,
    gross: Math.round(gross * 100) / 100,
    fuel: Math.round(fuel * 100) / 100,
    net: Math.round(net * 100) / 100,
    hours: Math.round(hours * 100) / 100,
    perHour: hours > 0 ? Math.round((net / hours) * 100) / 100 : 0,
    // route efficiency: net earned per mile driven
    efficiency: miles > 0 ? Math.round((net / miles) * 100) / 100 : 0,
  };
}

// 0–100 Lock In Score — earnings efficiency, route efficiency, offer quality,
// goal progress, time utilization, mileage efficiency.
export function lockInScore({
  todayEarnings = 0, dailyGoal = 150,
  netPerHour = 0, targetPerHour = 22,
  hoursWorked = 0, hoursGoal = 8,
  miles = 0, net = 0,
  avgPerHour = 0, routeEfficiency = 0,
}) {
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const earningsEff = clamp((netPerHour / Math.max(1, targetPerHour)) * 100);
  const goalProgress = clamp((todayEarnings / Math.max(1, dailyGoal)) * 100);
  const offerQuality = clamp((avgPerHour / Math.max(1, targetPerHour)) * 100);
  const timeUtil = clamp((hoursWorked / Math.max(1, hoursGoal)) * 100);
  const mileageEff = miles > 0 ? clamp((net / miles) * 8) : 50;
  const routeEff = clamp((earningsEff + offerQuality) / 2);
  const overall = clamp(
    earningsEff * 0.25 + goalProgress * 0.25 + offerQuality * 0.2 + timeUtil * 0.15 + mileageEff * 0.15
  );
  return {
    overall,
    breakdown: { earningsEff, goalProgress, offerQuality, timeUtil, mileageEff, routeEff },
  };
}