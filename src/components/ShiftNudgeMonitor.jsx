import { useEffect, useRef, useState } from "react";
import { AlarmClock, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";

// Shift nudge: watches the driver's connected calendar (upcoming shifts) and
// nudges them 30 minutes before a scheduled high-earning shift begins, so they
// can get on the road on time. Each shift nudges once per session; the banner
// stays up (with a live countdown) until dismissed, the shift starts, or the
// driver is already locked in.
const NUDGE_MIN = 30;
const CHECK_MS = 30000;
const REFRESH_MS = 5 * 60000;
const STORAGE_KEY = "lokin_shift_nudges";

export default function ShiftNudgeMonitor({ workStatus = "off" }) {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const eventsRef = useRef([]);
  const workingRef = useRef(false);
  workingRef.current = workStatus === "working";
  const nudgedRef = useRef(new Set());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });
  const [active, setActive] = useState(null);

  // Refresh the upcoming-shift list (calendar events with a start time).
  useEffect(() => {
    let alive = true;
    async function loadShifts() {
      try {
        const res = await guardedInvoke(base44, "getUpcomingShifts", {}, { force: false });
        if (alive) {
          eventsRef.current = (res.data?.events || []).filter((e) => e.start && !e.allDay);
        }
      } catch {
        // Calendar unavailable — the next refresh retries.
      }
    }
    loadShifts();
    const loadId = window.setInterval(loadShifts, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(loadId);
    };
  }, []);

  // Tick: nudge once when a shift enters the 30-minute window, then keep the
  // banner up with a live countdown until it's dismissed or the shift begins.
  useEffect(() => {
    function persist(ids) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
      } catch {
        // Best-effort bookkeeping.
      }
    }

    function check() {
      const now = Date.now();
      let pick = null;
      eventsRef.current.forEach((e) => {
        const start = new Date(e.start).getTime();
        if (!Number.isFinite(start)) return;
        const minUntil = (start - now) / 60000;
        if (minUntil > NUDGE_MIN || minUntil <= -2 || dismissed.has(e.id)) return;
        if (minUntil > 0 && !nudgedRef.current.has(e.id) && !workingRef.current) {
          nudgedRef.current.add(e.id);
          persist(new Set([...nudgedRef.current, ...dismissed]));
          const mins = Math.round(minUntil);
          toastRef.current({
            title: `High-earning shift in ~${mins} min`,
            description: `${e.title} starts at ${new Date(start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — get on the road.`,
            duration: 10000,
          });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(`LOKIN — shift in ~${mins} min`, { body: `${e.title} starts soon. Get on the road.` });
            } catch {
              // Notification delivery is best-effort.
            }
          }
        }
        if (!pick || start < pick.start) pick = { id: e.id, title: e.title, start, minUntil };
      });
      setActive(pick);
    }

    check();
    const id = window.setInterval(check, CHECK_MS);
    return () => window.clearInterval(id);
  }, [dismissed]);

  function dismiss(id) {
    setDismissed((prev) => {
      const next = new Set([...prev, id]);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Best-effort bookkeeping.
      }
      return next;
    });
  }

  if (workStatus === "working" || !active) return null;

  const mins = Math.round(active.minUntil);
  const starting = mins <= 0;

  return (
    <div
      className="relative z-10 flex items-center gap-3 rounded-2xl border border-primary/35 bg-primary/[0.08] p-3 shrink-0"
      style={{ boxShadow: "0 0 18px rgba(124,252,30,.25)" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 lokin-pulse">
        <AlarmClock className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-heading text-xs font-black uppercase tracking-[0.08em] text-primary">
          {starting ? "SHIFT STARTING NOW" : `SHIFT IN ~${mins} MIN`}
        </div>
        <div className="truncate text-[11px] text-white/60">
          {active.title} · {new Date(active.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
      <Link
        to="/ai-gps?focus=locked"
        className="shrink-0 rounded-full border border-primary/50 bg-primary/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-primary active:scale-95 transition-transform"
      >
        Lock in
      </Link>
      <button
        type="button"
        aria-label="Dismiss shift nudge"
        onClick={() => dismiss(active.id)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95"
      >
        <X className="h-4 w-4 text-white/50" />
      </button>
    </div>
  );
}