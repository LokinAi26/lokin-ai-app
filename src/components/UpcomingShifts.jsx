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
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          <div className="text-sm font-semibold">Upcoming Shifts</div>
        </div>
        {connected && (
          <button onClick={() => load(true)} disabled={refreshing} className="text-muted-foreground disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-3">Loading your calendar…</div>
      ) : !connected ? (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground mb-3">Connect Google Calendar to see your delivery shifts here.</p>
          <a href="https://calendar.google.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
            <Link2 className="h-3.5 w-3.5" /> Connect Calendar
          </a>
        </div>
      ) : events.length === 0 ? (
        <div className="text-sm text-muted-foreground py-3">No upcoming shifts on your calendar.</div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-xl bg-muted/40 p-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                <Clock className="h-4 w-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{e.title}</div>
                <div className="text-xs text-muted-foreground">{fmt(e.start)}</div>
                {e.location && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 truncate mt-0.5">
                    <MapPin className="h-3 w-3" />{e.location}
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