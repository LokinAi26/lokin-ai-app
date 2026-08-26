import { useEffect, useState, useMemo } from "react";
import { Radar, RefreshCw, Sparkles, GitCompare, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { rankSealOpportunities } from "@/lib/sealDecisionEngine";
import OpportunityFilters from "@/components/opportunities/OpportunityFilters";
import OpportunityCard from "@/components/opportunities/OpportunityCard";
import OpportunityCompare from "@/components/opportunities/OpportunityCompare";
import OpportunityAlerts from "@/components/opportunities/OpportunityAlerts";

const FILTER_KEY = "lokin_opp_filters";
const LIVE_TTL_MS = 6 * 60 * 60 * 1000;

function isFreshLive(item) {
  if (item?.live_status !== "live" || !item?.apply_url || !item?.source_url || !item?.verified_at) return false;
  const verified = new Date(item.verified_at).getTime();
  const expires = item?.expires_at ? new Date(item.expires_at).getTime() : verified + LIVE_TTL_MS;
  const now = Date.now();
  return Number.isFinite(verified) && now <= expires && now - verified <= LIVE_TTL_MS;
}

function dedupeLive(items) {
  const seen = new Set();
  return items
    .filter(isFreshLive)
    .sort((a, b) => String(b.verified_at || "").localeCompare(String(a.verified_at || "")))
    .filter((item) => {
      const key = String(item.apply_url || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default function Opportunities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [prefs, setPrefs] = useState({});
  const [selected, setSelected] = useState([]);
  const [sheet, setSheet] = useState({ open: false, mode: "compare", autoRecommend: false });

  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_KEY) || "{}");
      return { q: "", category: "all", vehicle: "any", schedule: "any", sort: "net", ...saved };
    } catch {
      return { q: "", category: "all", vehicle: "any", schedule: "any", sort: "net" };
    }
  });

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
  }, [filters]);

  async function load() {
    setLoading(true);
    try {
      const recs = await base44.entities.OpportunityScan.list("-verified_at", 250);
      setItems(dedupeLive(recs));
      try {
        const p = await base44.entities.DriverPreference.filter({});
        setPrefs(p[0] || {});
      } catch {}
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      try {
        const recs = await base44.entities.OpportunityScan.list("-verified_at", 20);
        const fresh = dedupeLive(recs);
        const newest = fresh[0]?.verified_at ? new Date(fresh[0].verified_at).getTime() : 0;
        if (!newest || Date.now() - newest > 15 * 60 * 1000) await runScan(true);
      } catch {}
    })();
  }, []);

  async function runScan(quiet = false) {
    setScanning(true);
    try {
      await base44.functions.invoke("scanOpportunities", { mode: "jobs" });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  }

  function toggleSelect(opp) {
    setSelected((sel) => {
      if (sel.find((s) => s.id === opp.id)) return sel.filter((s) => s.id !== opp.id);
      if (sel.length >= 3) return sel;
      return [...sel, opp];
    });
  }

  const filtered = useMemo(() => {
    let list = items.slice();
    const q = filters.q.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        [o.title, o.company, o.platform, o.location, o.source].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    if (filters.category !== "all") list = list.filter((o) => o.category === filters.category);
    if (filters.vehicle !== "any") list = list.filter((o) => o.role_type === filters.vehicle || o.role_type === "any");
    if (filters.schedule !== "any") list = list.filter((o) => o.schedule === filters.schedule);

    if (filters.sort === "net") list = rankSealOpportunities(list, prefs).map(({ opportunity }) => opportunity);
    else if (filters.sort === "gross") list.sort((a, b) => (b.pay_amount || 0) - (a.pay_amount || 0));
    else list.sort((a, b) => (b.scan_date || "").localeCompare(a.scan_date || ""));
    return list;
  }, [items, filters, prefs]);

  const lastScan = items[0]?.verified_at || null;

  function openCompare() {
    setSheet({ open: true, mode: "compare", autoRecommend: false });
  }
  function openRecommend() {
    // Rank the top filtered opportunities through deterministic SEAL scoring.
    setSelected(filtered.slice(0, 12));
    setSheet({ open: true, mode: "recommend", autoRecommend: true });
  }

  const sheetOpps = sheet.mode === "recommend" ? selected : selected;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Radar className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-heading metal-text leading-tight">Driver Opportunity Hub</h1>
            <p className="text-[11px] text-white/40 truncate">SEAL-ranked · live verified openings only · no sample jobs.</p>
          </div>
        </div>
        <button onClick={runScan} disabled={scanning}
          className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary glow-primary disabled:opacity-60 active:scale-95 transition-transform shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> {scanning ? "Verifying…" : "Refresh Live"}
        </button>
      </div>

      {lastScan && (
        <div className="text-[11px] text-white/40 -mt-2">Latest live verification: <span className="text-primary font-semibold">{lastScan}</span> · {items.length} reachable openings</div>
      )}

      <OpportunityAlerts prefs={prefs} onPrefsChange={setPrefs} />

      <OpportunityFilters filters={filters} setFilters={setFilters} />

      {/* action bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={openRecommend}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm font-bold text-accent glow-cyan active:scale-[0.98] transition-transform"
        >
          <Sparkles className="h-4 w-4" /> SEAL Recommend
        </button>
        <button
          onClick={openCompare}
          disabled={selected.length < 1}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary glow-primary active:scale-[0.98] disabled:opacity-40 transition-transform"
        >
          <GitCompare className="h-4 w-4" /> Compare ({selected.length}/3)
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-white/50 text-center py-10">Loading opportunities…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-white/45 text-center py-10">No verified live openings match right now. LOKIN will not substitute stale or sample jobs.</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o) => (
            <OpportunityCard key={o.id} opp={o} prefs={prefs} selected={Boolean(selected.find((s) => s.id === o.id))} onToggleSelect={toggleSelect} />
          ))}
        </div>
      )}

      {/* transparency footer */}
      <div className="rounded-2xl border border-white/8 bg-black/20 p-3 flex gap-2">
        <Info className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
        <p className="text-[10px] text-white/40 leading-relaxed">
          LIVE-ONLY: every displayed opening has a source page and application URL that were reachable during a recent web scan. Published pay is shown only when the source provides it; LOKIN does not guarantee hiring, availability, or compensation.
        </p>
      </div>

      <div className="text-center text-[10px] tracking-[0.18em] text-white/30 pt-1">
        HAMPTON ROADS · LIVE VERIFIED SOURCES · LOKIN AI
      </div>

      <OpportunityCompare
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        opps={sheetOpps}
        prefs={prefs}
        autoRecommend={sheet.autoRecommend}
      />
    </div>
  );
}