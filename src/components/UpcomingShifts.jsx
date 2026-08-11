import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, RefreshCw, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

function fmt(d) {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  const sameDay = dt.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = dt.toDateString() === tomorrow.toDateString();
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}

export default function UpcomingShifts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await base44.functions.invoke("getUpcomingShifts", {});
      setData(res.data);
    } catch {
      setData({ connected: false, events: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => { load(); }, []);

  const connected = data?.connected;
  const events = data?.events || [];

  return (
    <div className="rounded-3xl border border-white/10 lokin-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold tracking-wide text-white">UPCOMING SHIFTS</div>
        </div>
        {connected && (
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-primary disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <div className="text-sm text-white/50">Loading your calendar…</div>
        </div>
      ) : !connected ? (
        <div className="text-center py-3">
          <p className="text-sm text-white/55 mb-4 leading-relaxed">
            Connect Google Calendar to surface your delivery shifts here.
          </p>
          <a href="https://calendar.google.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-4 py-2 text-xs font-bold tracking-wide text-primary glow-primary">
            <Link2 className="h-3.5 w-3.5" /> CONNECT CALENDAR
          </a>
        </div>
      ) : events.length === 0 ? (
        <div className="text-sm text-white/50 py-4">No upcoming shifts on your calendar.</div>
      ) : (
        <div className="space-y-2.5">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate">{e.title}</div>
                <div className="text-xs text-white/50 mt-0.5">{fmt(e.start)}</div>
                {e.location && (
                  <div className="text-xs text-white/45 flex items-center gap-1 truncate mt-1">
                    <MapPin className="h-3 w-3 text-primary/70" />{e.location}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}