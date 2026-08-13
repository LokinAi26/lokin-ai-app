import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellRing, MapPin, Zap, X, Crosshair } from "lucide-react";

// Foreground geofence monitor: watches the device position and fires a
// notification + in-app alert when the user enters a high-earning heatmap zone.
// True background push requires a native mobile build; this works whenever the
// app is open (the realistic path on web).

const RADIUS_MI = 0.3; // zone entry radius
const HIGH_THRESHOLD = 28; // $/hr counts as "high-earning"

function haversineMi(a, b) {
  const R = 3958.8;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function ZoneAlertMonitor({ zones }) {
  const [on, setOn] = useState(false);
  const [denied, setDenied] = useState(false);
  const [nearest, setNearest] = useState(null);
  const [alert, setAlert] = useState(null);
  const watchId = useRef(null);
  const entered = useRef(new Set());

  const targets = (zones || []).filter((z) => z.perHour >= HIGH_THRESHOLD);

  useEffect(() => () => stop(), []);

  function stop() {
    if (watchId.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }

  function fireZone(z) {
    const body = `${z.name} · $${z.perHour}/hr — time to lock in and go active.`;
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("High-earning zone entered", { body, tag: `lokin-zone-${z.id}` });
      } catch (e) {
        /* notifications may be blocked in iframe; in-app banner is the fallback */
      }
    }
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    setAlert({ ...z, ts: Date.now() });
  }

  async function enable() {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (e) {
        /* ignore — banner still works */
      }
    }
    entered.current.clear();
    setDenied(false);
    setOn(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const me = [p.coords.latitude, p.coords.longitude];
        let near = null;
        let nd = Infinity;
        for (const z of targets) {
          const d = haversineMi(me, [z.lat, z.lng]);
          if (d < nd) {
            nd = d;
            near = { ...z, d };
          }
          if (d <= RADIUS_MI) {
            if (!entered.current.has(z.id)) {
              entered.current.add(z.id);
              fireZone(z);
            }
          } else if (d > RADIUS_MI * 1.6 && entered.current.has(z.id)) {
            // re-arm when leaving the zone
            entered.current.delete(z.id);
          }
        }
        setNearest(near);
      },
      () => setDenied(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  function disable() {
    stop();
    setOn(false);
    setNearest(null);
  }

  return (
    <div>
      <div className="rounded-2xl border border-white/10 lokin-panel p-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
              on ? "border-primary/50 bg-primary/15 glow-primary" : "border-white/10 bg-black"
            }`}
          >
            {on ? <BellRing className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5 text-white/60" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">Live Zone Alerts</div>
            <div className="text-xs text-white/50 truncate">
              {!on && !denied && "Get pinged when you enter a high-earning zone ($28+/hr)."}
              {on && !denied && (nearest ? `Nearest: ${nearest.name} · ${nearest.d.toFixed(2)} mi` : "Locating you…")}
              {denied && "Location access blocked — enable it to use alerts."}
            </div>
          </div>
          <button
            onClick={on ? disable : enable}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
              on ? "border border-white/15 bg-white/10 text-white" : "border border-primary/40 bg-primary/15 text-primary glow-primary"
            }`}
          >
            {on ? "Stop" : "Enable"}
          </button>
        </div>
      </div>

      {alert && (
        <div className="mt-2 rounded-2xl border border-primary/40 lokin-panel radial-fade p-3 glow-primary">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15">
              <Zap className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-primary text-glow">High-earning zone entered</div>
              <div className="text-xs text-white/70 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <MapPin className="h-3 w-3" /> {alert.name}
                <span className="text-primary font-bold">· ${alert.perHour}/hr</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Link
                  to="/drive"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-bold active:scale-95 transition-transform"
                >
                  <Zap className="h-3.5 w-3.5" /> Go Active
                </Link>
                <button
                  onClick={() => setAlert(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 active:scale-95"
                >
                  <X className="h-3.5 w-3.5" /> Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}