// VisionHud — phone-side HUD companion for LOKIN Vision XR.
//
// Every value on this page comes from a real data source (named per section)
// or shows an honest empty state. No placeholders, no seeded data, no
// simulated values — standing rule ahead of the App Store review.
//
// Data sources:
//   NAV ......... useLokinNavigation (same pattern as AiGps.jsx), destinations
//                 from the persisted optimized-route session AiGps writes.
//   CURRENT STOP  optimizeRoute backend function (sequenced stops, same as
//                 ActiveDelivery.jsx) + Offer.get for the customer name.
//   DOOR PIN .... getDoorPin from src/lib/doorPins.js (on-device pins).
//   ZONES ....... hotspot-map backend function (same args as Hotspots.jsx).
//   EARNINGS .... Earning entity, today's records (same math as Earnings.jsx).
//   VOICE ....... the lokin:voice-state CustomEvent bus (PROMPT-01).
//   GLASSES ..... latest LokinVisionTelemetry record for this user.
//
// Snapshot contract (consumed by the glasses projection step):
//   dispatches lokin:vision-hud-snapshot with 9 display-ready string fields;
//   any field with no real data is the empty string, never a guess.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Navigation, MapPin, DoorOpen, Flame, Banknote, Mic, Glasses, ChevronRight,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";
import useLokinNavigation from "@/hooks/useLokinNavigation";
import { formatDistance, formatDuration } from "@/lib/navigationGeometry";
import { getDoorPin } from "@/lib/doorPins";
import { loadOptimizedRouteSession } from "@/lib/optimizedRouteSession";

const GREEN = "#8FE44E"; // LOKIN Green — the only accent on this page.
const FALLBACK_CENTER = [36.8529, -75.978]; // Virginia Beach, same as Hotspots.jsx

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function compassLabel(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n)) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(n / 45) % 8];
}

function Section({ icon: Icon, title, children, right }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: GREEN }} />
          <span className="text-[10px] font-extrabold tracking-[0.22em] text-white/50">{title}</span>
        </div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <div className="text-sm text-white/40">{children}</div>;
}

export default function VisionHud() {
  // ---- NAV (useLokinNavigation, same pattern as AiGps.jsx) ----
  const sessionStops = useMemo(() => loadOptimizedRouteSession()?.stops || [], []);
  const destinationAddresses = useMemo(
    () => sessionStops.map((s) => String(s.dropoff_address || "").trim()).filter(Boolean),
    [sessionStops]
  );
  const nav = useLokinNavigation({
    destinationAddresses,
    enabled: destinationAddresses.length > 0,
    voiceGuidance: true,
  });
  const navActive = nav.route != null;
  const maneuverText = nav.maneuver?.maneuver?.instruction || "";
  const maneuverDistanceText = nav.maneuver?.distance_from_driver_m != null
    ? formatDistance(nav.maneuver.distance_from_driver_m)
    : "";
  const speedMs = nav.rawPosition?.coords?.speed;
  const speedText = Number.isFinite(Number(speedMs)) && Number(speedMs) >= 0
    ? `${Math.round(Number(speedMs) * 2.23694)} mph`
    : "";
  const headingText = compassLabel(nav.rawPosition?.coords?.heading);

  // ---- CURRENT STOP (optimizeRoute + Offer.get, read-only mirror of ActiveDelivery.jsx) ----
  const [stopData, setStopData] = useState(null);
  const [stopLoading, setStopLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prefs = await base44.entities.DriverPreference.filter({});
        const res = await guardedInvoke(
          base44,
          "optimizeRoute",
          { mode: prefs[0]?.optimization_mode || "most_profit" },
          { userInitiated: false }
        );
        if (!alive) return;
        setStopData(res.data || null);
      } catch {
        if (alive) setStopData(null);
      } finally {
        if (alive) setStopLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);
  const sequenced = stopData?.sequenced || [];
  const current = sequenced[0] || null;
  useEffect(() => {
    setOffer(null);
    if (!current?.id) return;
    let alive = true;
    base44.entities.Offer.get(current.id)
      .then((o) => { if (alive) setOffer(o); })
      .catch(() => { if (alive) setOffer(null); });
    return () => { alive = false; };
  }, [current?.id]);
  const customerName = offer?.customer_name || current?.merchant || "";
  const stopMiles = current?.miles ?? null;
  const stopEtaMin = current?.est_minutes ?? null;
  const stopPayout = current?.rate?.gross ?? current?.payout ?? null;
  const stopPerHour = current?.rate?.netPerHour ?? null;
  const stopLabel = current ? `Stop 1 of ${sequenced.length}${customerName ? ` · ${customerName}` : ""}` : "";
  const etaText = stopEtaMin != null ? `${stopEtaMin} min` : "";

  // ---- DOOR PIN (src/lib/doorPins.js) ----
  const doorPin = current?.dropoff_address ? getDoorPin(current.dropoff_address) : null;

  // ---- ZONES (hotspot-map, same args as Hotspots.jsx) ----
  const [zonesPayload, setZonesPayload] = useState(null);
  const [zonesLoading, setZonesLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const run = (center) => {
      guardedInvoke(base44, "hotspot-map", {
        origin: { latitude: center[0], longitude: center[1] },
        origin_address: "",
        market_state: "VA",
        feed_revision: 0,
        mode: "most_profit",
        selected_offer_ids: [],
      }, { userInitiated: false })
        .then((res) => { if (alive) setZonesPayload(res.data || null); })
        .catch(() => { if (alive) setZonesPayload(null); })
        .finally(() => { if (alive) setZonesLoading(false); });
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => run([pos.coords.latitude, pos.coords.longitude]),
        () => run(FALLBACK_CENTER),
        { timeout: 6000 }
      );
    } else {
      run(FALLBACK_CENTER);
    }
    return () => { alive = false; };
  }, []);
  const topZone = useMemo(() => {
    const raw = zonesPayload?.zones || [];
    const ranked = [...raw].sort((a, b) => Number(b.net_per_hour || 0) - Number(a.net_per_hour || 0));
    return ranked[0] || null;
  }, [zonesPayload]);

  // ---- EARNINGS (Earning entity, today's records — same math as Earnings.jsx) ----
  const [earnings, setEarnings] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [records, prefsList] = await Promise.all([
          base44.entities.Earning.filter({}, "date"),
          base44.entities.DriverPreference.filter({}),
        ]);
        if (!alive) return;
        const prefs = prefsList[0] || null;
        const today = dayKey(new Date());
        const todays = records.filter((r) => r.date === today);
        if (!todays.length) { setEarnings(null); return; }
        const gross = todays.reduce((s, r) => s + (r.amount || 0), 0);
        const miles = todays.reduce((s, r) => s + (r.miles || 0), 0);
        const trips = todays.reduce((s, r) => s + (r.trips || 0), 0);
        const fuel = miles > 0 ? (miles / (prefs?.vehicle_mpg || 26)) * (prefs?.gas_price || 3.45) : 0;
        const net = gross - fuel;
        const hours = trips * 0.4;
        setEarnings({ gross, hourly: hours > 0 ? net / hours : 0, hasRecords: true });
      } catch {
        if (alive) setEarnings(null);
      }
    })();
    return () => { alive = false; };
  }, []);
  const earningsToday = earnings ? `$${earnings.gross.toFixed(2)}` : "";
  const hourlyAvgText = earnings ? `$${earnings.hourly.toFixed(2)}/hr` : "";

  // ---- VOICE (lokin:voice-state event bus) ----
  const [voiceState, setVoiceState] = useState("idle");
  useEffect(() => {
    const onVoice = (e) => {
      const s = e?.detail?.state;
      if (["speaking", "listening", "thinking", "idle"].includes(s)) setVoiceState(s);
    };
    window.addEventListener("lokin:voice-state", onVoice);
    return () => window.removeEventListener("lokin:voice-state", onVoice);
  }, []);
  const voiceLabel = voiceState.toUpperCase();

  // ---- GLASSES LINK (latest LokinVisionTelemetry record for this user) ----
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryChecked, setTelemetryChecked] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await base44.auth.me().catch(() => null);
        if (!me?.id) { if (alive) setTelemetryChecked(true); return; }
        const rows = await base44.entities.LokinVisionTelemetry
          .filter({ user_id: me.id }, "-last_seen_at", 1)
          .catch(() => []);
        if (alive) setTelemetry(rows?.[0] || null);
      } catch {
        if (alive) setTelemetry(null);
      } finally {
        if (alive) setTelemetryChecked(true);
      }
    })();
    return () => { alive = false; };
  }, []);
  // Never claim ONLINE unless the telemetry record itself says so.
  const xrStatus = telemetry?.status ? String(telemetry.status).toUpperCase() : "";
  const batteryText = telemetry?.battery_percent != null ? `${Math.round(Number(telemetry.battery_percent))}%` : "";

  // ---- Snapshot contract: dispatch on every render where NAV or CURRENT STOP changes ----
  const snapshot = useMemo(() => ({
    nextManeuver: navActive ? maneuverText : "",
    maneuverDistanceText: navActive ? maneuverDistanceText : "",
    stopLabel,
    etaText,
    earningsToday,
    hourlyAvgText,
    voiceState: voiceLabel,
    xrStatus,
    batteryText,
  }), [navActive, maneuverText, maneuverDistanceText, stopLabel, etaText, earningsToday, hourlyAvgText, voiceLabel, xrStatus, batteryText]);
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent("lokin:vision-hud-snapshot", { detail: snapshot }));
    } catch {}
  }, [snapshot]);

  return (
    <div className="min-h-screen bg-black p-4 pb-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.28em]" style={{ color: GREEN }}>LOKIN VISION XR</div>
          <h1 className="text-2xl font-black text-white">Phone HUD</h1>
        </div>
        <Link to="/vision-bridge" className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/60">
          <Glasses className="h-3.5 w-3.5" /> Bridge <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* 1. NAV */}
      <Section icon={Navigation} title="NAVIGATION">
        {!navActive ? (
          <Empty>Navigation not active.</Empty>
        ) : (
          <div>
            <div className="text-lg font-extrabold leading-tight text-white">{maneuverText || "Continue on route"}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="text-[9px] tracking-[0.14em] text-white/40">TURN IN</div>
                <div className="mt-0.5 text-sm font-bold" style={{ color: GREEN }}>{maneuverDistanceText || "—"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="text-[9px] tracking-[0.14em] text-white/40">SPEED</div>
                <div className="mt-0.5 text-sm font-bold text-white">{speedText || "—"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="text-[9px] tracking-[0.14em] text-white/40">HEADING</div>
                <div className="mt-0.5 text-sm font-bold text-white">{headingText || "—"}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
              <span>Remaining {nav.remainingDistanceM != null ? formatDistance(nav.remainingDistanceM) : "—"}</span>
              <span>ETA {nav.remainingDurationS != null ? formatDuration(nav.remainingDurationS) : "—"}</span>
            </div>
          </div>
        )}
      </Section>

      {/* 2. CURRENT STOP */}
      <Section icon={MapPin} title="CURRENT STOP">
        {stopLoading ? (
          <Empty>Loading route…</Empty>
        ) : !current ? (
          <Empty>No active delivery.</Empty>
        ) : (
          <div>
            <div className="text-sm font-bold text-white">{stopLabel}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-white/45">
              <MapPin className="h-3 w-3" style={{ color: GREEN }} />
              <span className="truncate">{current.dropoff_address || "—"}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                <div className="text-[9px] tracking-[0.12em] text-white/40">MILES</div>
                <div className="mt-0.5 text-sm font-bold text-white">{stopMiles != null ? `${stopMiles} mi` : "—"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                <div className="text-[9px] tracking-[0.12em] text-white/40">ETA</div>
                <div className="mt-0.5 text-sm font-bold text-white">{etaText || "—"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                <div className="text-[9px] tracking-[0.12em] text-white/40">PAYOUT</div>
                <div className="mt-0.5 text-sm font-bold" style={{ color: GREEN }}>{stopPayout != null ? `$${Number(stopPayout).toFixed(2)}` : "—"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                <div className="text-[9px] tracking-[0.12em] text-white/40">$/HR</div>
                <div className="mt-0.5 text-sm font-bold text-white">{stopPerHour != null ? `$${Number(stopPerHour).toFixed(0)}` : "—"}</div>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* 3. DOOR PIN — rendered only when a pin exists for the destination */}
      {doorPin && (
        <Section icon={DoorOpen} title="DOOR PIN">
          <div className="text-sm font-bold" style={{ color: GREEN }}>Door pin saved</div>
          {doorPin.note && <div className="mt-0.5 text-[11px] text-white/45">{doorPin.note}</div>}
        </Section>
      )}

      {/* 4. ZONES */}
      <Section icon={Flame} title="TOP ZONE">
        {zonesLoading ? (
          <Empty>Loading zones…</Empty>
        ) : !topZone ? (
          <Empty>No offer data yet — your real heat map builds as you evaluate offers.</Empty>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{topZone.name || "Unnamed zone"}</div>
              <div className="mt-0.5 text-[11px] text-white/45">
                {topZone.seal_score != null ? `SEAL ${topZone.seal_score}/100` : "SEAL —"}
                {topZone.offer_count != null ? ` · ${topZone.offer_count} offers` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xl font-black" style={{ color: GREEN }}>${Number(topZone.net_per_hour || 0).toFixed(0)}</div>
              <div className="text-[9px] tracking-[0.14em] text-white/40">NET $/HR</div>
            </div>
          </div>
        )}
      </Section>

      {/* 5. EARNINGS */}
      <Section icon={Banknote} title="TODAY'S EARNINGS">
        {!earnings ? (
          <Empty>No earnings logged today.</Empty>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-2xl font-black" style={{ color: GREEN }}>{earningsToday}</div>
            <div className="text-sm font-bold text-white/70">{hourlyAvgText}</div>
          </div>
        )}
      </Section>

      {/* 6. VOICE */}
      <Section icon={Mic} title="VOICE">
        <span
          className="inline-block rounded-full border px-4 py-1.5 text-xs font-extrabold tracking-[0.18em]"
          style={
            voiceState === "idle"
              ? { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }
              : { borderColor: `${GREEN}66`, backgroundColor: `${GREEN}1a`, color: GREEN }
          }
        >
          {voiceLabel}
        </span>
      </Section>

      {/* 7. GLASSES LINK */}
      <Section icon={Glasses} title="GLASSES">
        {!telemetryChecked ? (
          <Empty>Checking pairing…</Empty>
        ) : !telemetry ? (
          <Empty>No glasses paired.</Empty>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">{xrStatus || "UNKNOWN"}</div>
              <div className="mt-0.5 text-[11px] text-white/45">{telemetry.device_id || "paired device"}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-white">{batteryText || "—"}</div>
              <div className="text-[9px] tracking-[0.14em] text-white/40">BATTERY</div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
