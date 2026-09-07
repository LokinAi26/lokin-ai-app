import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Satellite } from "lucide-react";
import { base44LiveFunctions } from "@/api/base44Client";
import RoadMatchedMap from "@/components/RoadMatchedMap";

function currentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Device GPS is unavailable"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000,
      ...options,
    });
  });
}

export default function SatelliteRoutePreview({ stops = [], destinationAddress = "", compact = false }) {
  const addresses = useMemo(() => {
    if (destinationAddress?.trim()) return [destinationAddress.trim()];
    return stops.map((s) => String(s?.dropoff_address || "").trim()).filter(Boolean).slice(0, 12);
  }, [destinationAddress, stops]);
  const [route, setRoute] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setRoute(null);
    setOrigin(null);
    setError("");
    if (!addresses.length) { setLoading(false); return; }
    setLoading(true);
    currentPosition()
      .then((position) => {
        if (!alive) return null;
        const coordinate = [Number(position.coords.longitude), Number(position.coords.latitude)];
        if (alive) setOrigin({ coordinate, accuracy_m: Number(position.coords.accuracy || 0), heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null });
        return base44LiveFunctions.functions.invoke("navigation-engine", {
          action: "route_addresses",
          origin: { longitude: coordinate[0], latitude: coordinate[1] },
          destination_addresses: addresses,
        });
      })
      .then((response) => {
        if (!alive) return;
        const nextRoute = response.data?.route || null;
        if (!nextRoute?.geometry?.coordinates?.length) throw new Error("No road-matched satellite route is available yet");
        setRoute(nextRoute);
      })
      .catch((e) => {
        if (!alive) return;
        setRoute(null);
        setError(e?.response?.data?.error || e?.message || "Could not load satellite route preview");
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [addresses.join("|")]);

  if (!addresses.length) return null;

  if (route) {
    return (
      <div className={compact ? "max-h-[360px] overflow-hidden rounded-[2rem]" : ""}>
        <RoadMatchedMap
          routeGeometry={route.geometry}
          snappedPosition={origin ? { coordinate: origin.coordinate, heading: origin.heading, segment_index: 0 } : null}
          maneuver={route.maneuvers?.[0] || null}
          remainingDurationS={route.duration_s}
          followDriver={false}
          perspective
        />
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border ${error ? "border-amber-400/25 bg-amber-400/[0.05]" : "border-accent/20 bg-accent/[0.04]"} p-4`}>
      <div className="flex items-start gap-3">
        {error ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /> : <Satellite className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-accent" />}
        <div>
          <div className="text-sm font-bold text-white">{error ? "Satellite route preview unavailable" : loading ? "Loading real satellite route…" : "Satellite route preview"}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-white/45">
            {error || "Using device GPS, production road geometry, and provider satellite/aerial imagery. Imagery is not a live orbital camera feed."}
          </div>
        </div>
      </div>
    </div>
  );
}
