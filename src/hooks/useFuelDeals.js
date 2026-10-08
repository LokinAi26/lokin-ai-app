import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Shared fuel-deals fetch: cheapest saved FuelDeal records nearby.
// Extracted from FuelDealsOverlay so the nav ETA sheet can show the same
// best-price pill without duplicating the query.
const NEARBY_MI = 15;
const TOP_N = 3;

export function netPrice(d) {
  return Number(d.price_per_gallon || 0) - Number(d.discount_per_gallon || 0);
}

export default function useFuelDeals() {
  const [deals, setDeals] = useState(null);

  useEffect(() => {
    let on = true;
    base44.entities.FuelDeal.filter({}, "price_per_gallon")
      .then((rows) => {
        if (!on) return;
        const today = new Date().toISOString().slice(0, 10);
        setDeals(
          rows
            .filter((d) => !d.expires_on || d.expires_on >= today)
            .filter((d) => d.distance_miles == null || d.distance_miles <= NEARBY_MI)
            .sort((a, b) => netPrice(a) - netPrice(b))
            .slice(0, TOP_N)
        );
      })
      .catch(() => {
        if (on) setDeals([]);
      });
    return () => {
      on = false;
    };
  }, []);

  return deals;
}
