// LOKIN Store Intelligence Engine
// Converts a shopping list into a simple in-store route using normalized item/map data.
// Real retailer feeds remain authoritative; estimated points are explicitly marked.

function point(item, index = 0) {
  if (Number.isFinite(item?.map_x) && Number.isFinite(item?.map_y)) {
    return { x: item.map_x, y: item.map_y, estimated: false };
  }
  const aisle = parseInt(String(item?.aisle || '').replace(/\D/g, '')) || index + 1;
  const shelf = parseInt(String(item?.shelf || '').replace(/\D/g, '')) || 1;
  return {
    x: 12 + ((aisle * 13) % 72),
    y: 15 + ((shelf * 17 + aisle * 5) % 68),
    estimated: true,
  };
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function optimizeStoreRoute(items = []) {
  const remaining = items.map((item, i) => ({ ...item, _point: point(item, i) }));
  const route = [];
  let cursor = { x: 5, y: 92 }; // entrance

  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (distance(cursor, remaining[i]._point) < distance(cursor, remaining[best]._point)) best = i;
    }
    const [next] = remaining.splice(best, 1);
    route.push({ ...next, route_order: route.length + 1 });
    cursor = next._point;
  }
  return route;
}

export function substitutionRisk(item) {
  const count = Number(item?.inventory_count || 0);
  if (item?.inventory_status === 'out_of_stock') return 'high';
  if (item?.inventory_status === 'low_stock' || (count > 0 && count <= 3)) return 'medium';
  return 'low';
}
