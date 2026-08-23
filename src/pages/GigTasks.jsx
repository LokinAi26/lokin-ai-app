import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, ExternalLink, MapPin, RefreshCw, ShoppingBag, Utensils, Package, FlaskConical, ClipboardList, Clock3 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const LIVE_TTL_MS = 6 * 60 * 60 * 1000;
const FIELD_TYPES = new Set(["mystery_shop", "food_review", "product_test", "paid_research", "survey"]);

const TYPE_META = {
  mystery_shop: { label: "Mystery Shop", icon: ShoppingBag },
  food_review: { label: "Food Review", icon: Utensils },
  product_test: { label: "Product Test", icon: Package },
  paid_research: { label: "Paid Research", icon: FlaskConical },
  survey: { label: "Survey / Field Study", icon: ClipboardList },
};

function isFreshLive(item) {
  if (item?.live_status !== "live" || !item?.apply_url || !item?.source_url || !item?.verified_at) return false;
  const verified = new Date(item.verified_at).getTime();
  const expires = item?.expires_at ? new Date(item.expires_at).getTime() : verified + LIVE_TTL_MS;
  const now = Date.now();
  return Number.isFinite(verified) && now <= expires && now - verified <= LIVE_TTL_MS;
}

function relativeVerified(value) {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "verified now";
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 2) return "verified now";
  if (mins < 60) return `verified ${mins}m ago`;
  return `verified ${Math.round(mins / 60)}h ago`;
}

function dedupeLatest(items) {
  const map = new Map();
  items
    .filter(isFreshLive)
    .filter((x) => FIELD_TYPES.has(x.category))
    .sort((a, b) => String(b.verified_at || "").localeCompare(String(a.verified_at || "")))
    .forEach((item) => {
      const key = String(item.apply_url || "").toLowerCase();
      if (key && !map.has(key)) map.set(key, item);
    });
  return [...map.values()];
}

export default function GigTasks() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [lastScanAt, setLastScanAt] = useState(null);

  async function loadFresh() {
    const all = await base44.entities.OpportunityScan.list("-verified_at", 200);
    const fresh = dedupeLatest(all);
    setItems(fresh);
    if (fresh[0]?.verified_at) setLastScanAt(fresh[0].verified_at);
    return fresh;
  }

  async function scanLive({ quiet = false } = {}) {
    setScanning(true);
    try {
      const response = await base44.functions.invoke("scanOpportunities", { mode: "gigs" });
      if (!response.data?.ok) throw new Error(response.data?.error || "Live scan failed");
      await loadFresh();
      setLastScanAt(response.data?.scanned_at || new Date().toISOString());
      if (!quiet) {
        toast({
          title: "Live opportunity scan complete",
          description: `${response.data?.verified_live || 0} currently reachable opportunities verified.`,
        });
      }
    } catch (e) {
      if (!quiet) toast({ title: "Live scan failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const fresh = await loadFresh();
        if (!alive) return;
        const newest = fresh[0]?.verified_at ? new Date(fresh[0].verified_at).getTime() : 0;
        if (!newest || Date.now() - newest > 15 * 60 * 1000) await scanLive({ quiet: true });
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(
    () => filter === "all" ? items : items.filter((x) => x.category === filter),
    [items, filter],
  );

  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold font-heading metal-text">Live Paid Opportunities</h1>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/45">Mystery shopping, food evaluation, product testing and paid research — live public opportunities only.</p>
        </div>
        <button
          type="button"
          onClick={() => scanLive()}
          disabled={scanning}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-2 text-[10px] font-extrabold text-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> {scanning ? "LIVE SCAN" : "REFRESH"}
        </button>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-3 text-[11px] leading-relaxed text-white/55">
        <span className="font-bold text-primary">LIVE-ONLY:</span> LOKIN displays an opportunity only when its source page and application/signup URL were reachable during a recent live scan. LOKIN does not create these third-party jobs or promise their payout.
        {lastScanAt && <div className="mt-1 text-[10px] text-white/35">Latest verification: {relativeVerified(lastScanAt)}</div>}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {[{ value: "all", label: "All" }, ...Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label }))].map((x) => (
          <button
            key={x.value}
            type="button"
            onClick={() => setFilter(x.value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === x.value ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-14 text-center text-sm text-white/40">Checking live sources…</div>
      ) : scanning && filtered.length === 0 ? (
        <div className="py-14 text-center text-sm text-white/40">Searching and verifying current opportunities…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 text-center">
          <div className="text-sm font-semibold text-white/70">No verified live opportunities right now.</div>
          <div className="mt-1 text-xs text-white/35">LOKIN will not fill this screen with samples or stale assignments.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const meta = TYPE_META[item.category] || TYPE_META.mystery_shop;
            const Icon = meta.icon;
            return (
              <article key={item.id} className="rounded-3xl border border-white/10 lokin-panel p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.06]">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold leading-tight text-white">{item.title}</div>
                        <div className="mt-0.5 text-xs text-white/45">{item.company || item.source} · {meta.label}</div>
                      </div>
                      {item.pay && <div className="shrink-0 text-sm font-extrabold text-primary">{item.pay}</div>}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/50">
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.05] px-2 py-1 text-primary"><BadgeCheck className="h-3 w-3" /> LIVE · {relativeVerified(item.verified_at)}</span>
                      {item.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.location}</span>}
                      {item.posted_at && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Posted {item.posted_at}</span>}
                    </div>

                    {item.notes && <p className="mt-2 text-xs leading-relaxed text-white/55">{item.notes}</p>}
                    {item.qualifications && <p className="mt-1 text-[11px] text-white/40"><span className="text-white/55">Requirements:</span> {item.qualifications}</p>}

                    <div className="mt-3 flex gap-2">
                      <a href={item.apply_url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary px-3 py-2.5 text-xs font-extrabold text-black active:scale-[0.98]">
                        Open Opportunity <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white/55">
                        Source
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
