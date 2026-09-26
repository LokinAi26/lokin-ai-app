import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Navigation, MapPin, Clock, DollarSign, Check, ChevronLeft, ChevronRight, MessageSquare, Package, Flame, ArrowUpRight, Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CATEGORY_LABELS } from "@/lib/deliveryLabels";
import { guardedInvoke } from "@/lib/creditGuardian";
import { captureDoorFix } from "@/lib/doorPins";
import useDoorPin from "@/hooks/useDoorPin";

// Mirrors the LOKIN "Active Delivery" mockup: customer card, ETA/distance,
// earnings + $/hr, quick status actions, auto-update messages toggle.
const STATUS = ["5 MIN AWAY", "AT PICKUP", "ON MY WAY", "OUTSIDE"];
const AUTO_MSGS = ["Order Confirmed", "On My Way", "Arriving Soon", "Delivered"];

function zipFromAddress(address) {
  const match = String(address || "").match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] || "";
}

export default function ActiveDelivery() {
  const [data, setData] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [statusIdx, setStatusIdx] = useState(-1); // -1 none, 0-3 quick statuses, 4 delivered
  const [auto, setAuto] = useState(true);
  const [pinState, setPinState] = useState("idle"); // idle | pinning | pinned | error

  // Auto-learn the door: when a drop-off is marked delivered, quietly save
  // where the driver actually stopped. A manual pin later overrides it.
  async function autoLearnDoor(address) {
    if (!address || hasDoorPinForAddress(address)) return false;
    try {
      const fix = await captureDoorFix(12000);
      await saveDoorPinRemote({
        targetAddress: address,
        zip_code: zipFromAddress(address),
        latitude: fix.latitude,
        longitude: fix.longitude,
        description: "auto delivery confirmation",
        source: "auto",
      });
      await refreshDoorPin({ address, zip_code: zipFromAddress(address) });
      return true;
    } catch {
      return false;
    }
  }

  async function pinTheDoor() {
    const address = stops[idx]?.dropoff_address || "";
    if (!address || pinState === "pinning") return;
    setPinState("pinning");
    try {
      const fix = await captureDoorFix(15000);
      await saveDoorPinRemote({
        targetAddress: address,
        zip_code: zipFromAddress(address),
        latitude: fix.latitude,
        longitude: fix.longitude,
        description: "manual driver pin",
        source: "manual",
      });
      await refreshDoorPin({ address, zip_code: zipFromAddress(address) });
      setPinState("pinned");
    } catch {
      setPinState("error");
      setTimeout(() => setPinState("idle"), 2500);
    }
  }

  useEffect(() => { load(); }, []);

  async function load(force = false) {
    setLoading(true);
    setIdx(0);
    setStatusIdx(-1);
    try {
      const pl = await base44.entities.DriverPreference.filter({});
      const p = pl[0] || null;
      setPrefs(p);
      const res = await guardedInvoke(base44, "optimizeRoute", { mode: p?.optimization_mode || "most_profit" }, { force, userInitiated: force });
      setData(res.data);
    } catch (e) {
      setData({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  const stops = data?.sequenced || [];
  const total = stops.length;
  const current = stops[idx];
  const currentZip = zipFromAddress(current?.dropoff_address || "");
  const {
    saveDoorPin: saveDoorPinRemote,
    hasDoorPinForAddress,
    refresh: refreshDoorPin,
  } = useDoorPin(current?.dropoff_address || "", currentZip);
  const delivered = statusIdx === 4;

  useEffect(() => {
    setOffer(null);
    if (!current?.id) return;
    base44.entities.Offer.get(current.id).then(setOffer).catch(() => setOffer(null));
  }, [current?.id]);

  function pickStop(i) { setIdx(i); setStatusIdx(-1); setPinState("idle"); }
  async function markDelivered() {
    setStatusIdx(4);
    setAuto(true); // ensure delivered auto-message
    const address = current?.dropoff_address || "";
    const learned = await autoLearnDoor(address);
    setPinState(learned || hasDoorPinForAddress(address) ? "pinned" : "idle");
  }
  function nextDelivery() {
    if (idx < total - 1) { setIdx(idx + 1); setStatusIdx(-1); }
    else { setIdx(total); } // route done
  }

  const customerName = offer?.customer_name || current?.merchant || "Customer";
  const initial = (customerName || "C").trim().charAt(0).toUpperCase();
  const earnings = current?.rate?.gross ?? current?.payout ?? 0;
  const perHour = current?.rate?.netPerHour ?? 0;

  // route complete
  if (total > 0 && idx >= total) {
    return (
      <div className="p-4 space-y-4 pb-10">
        <Header />
        <div className="rounded-3xl border border-primary/40 bg-primary/[0.08] p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10 glow-primary mb-3">
            <Check className="h-7 w-7 text-primary" />
          </div>
          <div className="font-display text-xl font-extrabold tracking-wider text-primary text-glow">ALL DELIVERIES DONE</div>
          <div className="text-xs text-white/50 mt-1">Route cleared. Lock in the next run.</div>
          <button onClick={() => load(true)} className="mt-4 w-full rounded-2xl border border-white/10 lokin-panel py-3 text-sm font-semibold text-white/80">
            Recompute route
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-10">
      <Header />

      {loading ? (
        <div className="lokin-card p-6 text-center text-sm text-white/50">
          Loading active delivery…
        </div>
      ) : !current ? (
        <div className="lokin-card p-6 text-center text-sm text-white/50">
          {data?.error || "No active deliveries match your filters."}
        </div>
      ) : (
        <>
          {/* stop switcher */}
          {total > 1 && (
            <div className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.03] px-2 py-1.5">
              <button onClick={() => pickStop(Math.max(0, idx - 1))} disabled={idx === 0}
                className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30"><ChevronLeft className="h-4 w-4 text-primary" /></button>
              <span className="text-xs font-semibold text-white/70">DELIVERY {idx + 1} / {total}</span>
              <button onClick={() => pickStop(Math.min(total - 1, idx + 1))} disabled={idx === total - 1}
                className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30"><ChevronRight className="h-4 w-4 text-primary" /></button>
            </div>
          )}

          {/* customer card */}
          <motion.div key={current.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="lokin-card radial-fade p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] tracking-[0.22em] text-primary/80 font-display">ACTIVE DELIVERY</span>
              <span className="text-[11px] text-white/40">{CATEGORY_LABELS[current.category] || current.category}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-500 text-black font-bold text-lg">{initial}</div>
              <div className="min-w-0">
                <div className="text-lg font-semibold text-white truncate">{customerName}</div>
                <div className="text-[11px] text-white/45 flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{current.dropoff_address || "—"}</div>
              </div>
            </div>
            {offer?.items_count > 1 && (
              <div className="mt-1.5 text-[11px] text-white/45 flex items-center gap-1"><Package className="h-3 w-3 text-primary" /> {offer.items_count} items</div>
            )}

            {/* metrics */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Metric icon={Navigation} label="Distance" value={`${current.miles ?? 0} mi`} />
              <Metric icon={Clock} label="ETA" value={`${current.est_minutes ?? 0} min`} />
              <Metric icon={DollarSign} label="Earn" value={`$${(earnings || 0).toFixed(2)}`} accent />
            </div>

            {/* earnings banner */}
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-primary/10 border border-primary/30 px-3 py-2.5">
              <span className="text-xs text-white/65">Est. Earnings</span>
              <div className="text-right">
                <span className="text-xl font-bold text-primary">${(earnings || 0).toFixed(2)}</span>
                <span className="text-[11px] text-white/45 ml-2">${(perHour || 0).toFixed(0)}/hr</span>
              </div>
            </div>
          </motion.div>

          {/* status actions */}
          {delivered ? (
            <div className="rounded-3xl border border-primary/40 bg-primary/[0.08] p-5 text-center">
              <Check className="h-7 w-7 text-primary mx-auto" />
              <div className="mt-1 font-display font-bold tracking-wide text-primary text-glow">DELIVERED</div>
              <div className="text-xs text-white/50 mt-0.5">Auto-update sent to {customerName}.</div>
              <button onClick={pinTheDoor} disabled={pinState === "pinning"}
                className={`mt-3 w-full rounded-2xl border py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${pinState === "pinned" ? "border-primary/50 bg-primary/10 text-primary" : "border-white/15 bg-white/5 text-white/70"}`}>
                <MapPin className="h-3.5 w-3.5" />
                {pinState === "pinning" ? "Pinning your location…" : pinState === "pinned" ? "Door pinned ✓ — future routes come straight here" : pinState === "error" ? "Couldn't get GPS — try again" : "Pin the door here"}
              </button>
              {idx < total - 1 ? (
                <button onClick={nextDelivery} className="mt-3 w-full rounded-2xl bg-primary text-black py-3 text-sm font-bold glow-primary">
                  Next Delivery →
                </button>
              ) : (
                <button onClick={nextDelivery} className="mt-3 w-full rounded-2xl border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary">
                  Complete Route
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                {STATUS.map((s, i) => {
                  const activeS = statusIdx === i;
                  return (
                    <button key={s} onClick={() => setStatusIdx(i)}
                      className={`rounded-2xl py-3 text-xs font-bold tracking-wide transition-all ${activeS ? "bg-primary text-black glow-primary" : "border border-primary/30 bg-primary/10 text-primary"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>

              {/* delivered + navigate */}
              <div className="grid grid-cols-2 gap-2.5">
                <Link to={`/ai-gps?focus=locked&nav=1&view=real&destination=${encodeURIComponent(current.dropoff_address || "")}`} className="rounded-2xl border border-accent/40 bg-accent/[0.08] text-accent py-3 flex items-center justify-center gap-1.5 text-sm font-bold">
                  <Navigation className="h-4 w-4" /> LOKIN GPS
                </Link>
                <button onClick={markDelivered} disabled={statusIdx < 0}
                  className={`rounded-2xl py-3 flex items-center justify-center gap-1.5 text-sm font-bold transition-all ${statusIdx < 0 ? "border border-white/10 text-white/30" : "bg-primary text-black glow-primary"}`}>
                  <Check className="h-4 w-4" /> Delivered
                </button>
              </div>

              {/* auto updates */}
              <div className="lokin-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Bell className="h-4 w-4 text-primary" /> Auto Updates
                  </div>
                  <button onClick={() => setAuto((a) => !a)}
                    className={`h-6 w-11 rounded-full p-0.5 flex items-center transition-colors ${auto ? "bg-primary justify-end" : "bg-white/15 justify-start"}`}>
                    <div className="h-5 w-5 rounded-full bg-black" />
                  </button>
                </div>
                {auto ? (
                  <div className="mt-3 space-y-1.5">
                    {AUTO_MSGS.map((m, i) => {
                      // map current status to an auto-message progress
                      const sent = delivered ? i <= 3 : statusIdx >= 0 && i <= statusIdx;
                      return (
                        <div key={m} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-white/60"><MessageSquare className="h-3 w-3 text-primary" /> {m}</span>
                          <span className={sent ? "text-primary text-[9px] font-bold tracking-wide" : "text-white/25 text-[9px]"}>{sent ? "SENT" : "QUEUED"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-white/40">Auto customer updates paused.</div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <Link to="/drive" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-white">Back to Driving Mode</span>
        </div>
        <ArrowUpRight className="h-4 w-4 text-white/40" />
      </Link>
    </div>
  );
}

function Header() {
  return (
    <div>
      <div className="lokin-kicker lokin-kicker-lime mb-1">DELIVERY</div>
      <div className="flex items-center justify-between">
      <div>
        <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">LIVE ORDER</div>
        <h1 className="text-2xl font-bold font-heading metal-text">Active Delivery</h1>
      </div>
      <Flame className="h-5 w-5 text-orange-400" />
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-center gap-1 text-[10px] text-white/40">
        <Icon className="h-3 w-3 text-primary" /> {label}
      </div>
      <div className={`font-display text-sm font-bold mt-0.5 ${accent ? "text-primary text-glow" : "text-white"}`}>{value}</div>
    </div>
  );
}