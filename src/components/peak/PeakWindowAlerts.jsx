import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { TIME_BLOCKS, DEFAULT_CENTER, buildHotspots, blockPerHour } from "@/lib/heatData";

// Peak-window alerts: watches the clock against the time-of-day heat model for
// the driver's area and notifies when the best earning hours begin (or are
// ~15 minutes away). Each notification fires once per block per day.
const PRE_ALERT_MIN = 15;
const CHECK_MS = 30000;
const STORAGE_KEY = "lokin_peak_alerts";

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function blockStatus(hour, block) {
  const overnight = block.endHour > 24;
  const live = overnight
    ? hour >= block.startHour || hour < block.endHour - 24
    : hour >= block.startHour && hour < block.endHour;
  const startsInMin = live ? null : Math.round((block.startHour - hour) * 60);
  return { live, startsInMin };
}

export default function PeakWindowAlerts() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [zones, setZones] = useState(null);
  const [active, setActive] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{"dismissed":[]}').dismissed);
    } catch {
      return new Set();
    }
  });
  const notifiedRef = useRef(new Set());

  // Restore today's already-sent notifications so refreshes don't re-fire them.
  useEffect(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      notifiedRef.current = new Set(raw[dayKey(new Date())] || []);
    } catch {
      notifiedRef.current = new Set();
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setZones(buildHotspots(DEFAULT_CENTER));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setZones(buildHotspots([pos.coords.latitude, pos.coords.longitude])),
      () => setZones(buildHotspots(DEFAULT_CENTER)),
      { timeout: 6000 }
    );
  }, []);

  // The day's two strongest blocks for the driver's area: volume-weighted
  // estimated $/hr across nearby zones, plus each block's best zone.
  const peakBlocks = useMemo(() => {
    if (!zones) return [];
    const scored = TIME_BLOCKS.map((b) => {
      let weighted = 0;
      let totalVolume = 0;
      let best = null;
      zones.forEach((z) => {
        const value = blockPerHour(z, b.id);
        weighted += value * z.volume;
        totalVolume += z.volume;
        if (!best || value > best.value) best = { zone: z, value };
      });
      return { ...b, score: totalVolume > 0 ? weighted / totalVolume : 0, best };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 2);
  }, [zones]);

  function markShown(key) {
    notifiedRef.current.add(key);
    try {
      const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      const today = dayKey(new Date());
      raw[today] = [...new Set([...(raw[today] || []), key])];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    } catch {
      // Notification bookkeeping is best-effort.
    }
  }

  useEffect(() => {
    if (peakBlocks.length === 0) return undefined;

    const check = () => {
      const now = new Date();
      const today = dayKey(now);
      const hour = now.getHours() + now.getMinutes() / 60;
      let livePick = null;
      let soonPick = null;

      peakBlocks.forEach((b) => {
        const { live, startsInMin } = blockStatus(hour, b);
        if (live) {
          if (!notifiedRef.current.has(`${today}:${b.id}:live`)) {
            markShown(`${today}:${b.id}:live`);
            toastRef.current({
              title: "Peak hours are live",
              description: `${b.label} — best zone ${b.best.zone.name} at est $${b.best.value.toFixed(0)}/hr. Head there now.`,
              duration: 9000,
            });
          }
          if (!livePick || b.score > livePick.score) livePick = b;
        } else if (startsInMin != null && startsInMin > 0 && startsInMin <= PRE_ALERT_MIN) {
          if (!notifiedRef.current.has(`${today}:${b.id}:soon`)) {
            markShown(`${today}:${b.id}:soon`);
            toastRef.current({
              title: "Busy shift starting soon",
              description: `${b.label} rush begins in ~${startsInMin} min — best zone ${b.best.zone.name}.`,
              duration: 9000,
            });
          }
          if (!soonPick || startsInMin < soonPick.startsInMin) soonPick = { block: b, startsInMin };
        }
      });

      setActive(livePick ? { block: livePick, live: true } : (soonPick ? { block: soonPick.block, live: false, startsInMin: soonPick.startsInMin } : null));
    };

    check();
    const id = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(id);
  }, [peakBlocks]);

  const bannerKey = active ? `${dayKey(new Date())}:${active.block.id}:${active.live ? "live" : "soon"}` : null;

  function dismiss() {
    if (!bannerKey) return;
    setDismissed((prev) => {
      const next = new Set([...prev, bannerKey]);
      try {
        const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
        raw.dismissed = [...next];
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
      } catch {
        // Best-effort persistence.
      }
      return next;
    });
  }

  if (!active || dismissed.has(bannerKey)) return null;

  return (
    <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-primary/35 bg-primary/[0.08] p-3 shrink-0" style={{ boxShadow: "0 0 18px rgba(124,252,30,.25)" }}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 lokin-pulse">
        <Flame className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-heading text-xs font-black uppercase tracking-[0.08em] text-primary">
          {active.live ? "PEAK HOURS LIVE" : `BUSY SHIFT IN ~${Math.round(active.startsInMin)} MIN`}
        </div>
        <div className="truncate text-[11px] text-white/60">
          {active.block.label} · best zone {active.block.best.zone.name} · est ${active.block.best.value.toFixed(0)}/hr
        </div>
      </div>
      <Link
        to="/hotspots"
        className="shrink-0 rounded-full border border-primary/50 bg-primary/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-primary active:scale-95 transition-transform"
      >
        Hotspots
      </Link>
      <button
        type="button"
        aria-label="Dismiss peak alert"
        onClick={dismiss}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95"
      >
        <X className="h-4 w-4 text-white/50" />
      </button>
    </div>
  );
}