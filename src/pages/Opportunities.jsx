import { useEffect, useState, useMemo } from "react";
import { Radar, RefreshCw, Sparkles, GitCompare, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { estimateNet } from "@/lib/opportunityEstimates";
import OpportunityFilters from "@/components/opportunities/OpportunityFilters";
import OpportunityCard from "@/components/opportunities/OpportunityCard";
import OpportunityCompare from "@/components/opportunities/OpportunityCompare";
import OpportunityAlerts from "@/components/opportunities/OpportunityAlerts";

const FILTER_KEY = "lokin_opp_filters";

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
      const recs = await base44.entities.OpportunityScan.list("-scan_date", 150);
      setItems(recs);
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

  useEffect(() => { load(); }, []);

  async function runScan() {
    setScanning(true);
    try {
      await base44.functions.invoke("scanOpportunities", {});
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

    const netOf = (o) => estimateNet(o, prefs).netPerHour;
    if (filters.sort === "net") list.sort((a, b) => netOf(b) - netOf(a));
    else if (filters.sort === "gross") list.sort((a, b) => (b.pay_amount || 0) - (a.pay_amount || 0));
    else list.sort((a, b) => (b.scan_date || "").localeCompare(a.scan_date || ""));
    return list;
  }, [items, filters, prefs]);

  const lastScan = items[0]?.scan_date || null;

  function openCompare() {
    setSheet({ open: true, mode: "compare", autoRecommend: false });
  }
  function openRecommend() {
    // recommend on the top of the filtered list (capped at 12 for cost)
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
            <p className="text-[11px] text-white/40 truncate">One trustworthy place to find & compare real work.</p>
          </div>
        </div>
        <button onClick={runScan} disabled={scanning}
          className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary glow-primary disabled:opacity-60 active:scale-95 transition-transform shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> {scanning ? "Scanning…" : "Run Scan"}
        </button>
      </div>

      {lastScan && (
        <div className="text-[11px] text-white/40 -mt-2">Last scan: <span className="text-primary font-semibold">{lastScan}</span> · {items.length} listings</div>
      )}

      <OpportunityAlerts prefs={prefs} onPrefsChange={setPrefs} />

      <OpportunityFilters filters={filters} setFilters={setFilters} />

      {/* action bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={openRecommend}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm font-bold text-accent glow-cyan active:scale-[0.98] transition-transform"
        >
          <Sparkles className="h-4 w-4" /> Recommend
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
        <div className="text-sm text-white/45 text-center py-10">No opportunities match your filters. Try "Run Scan" for the latest openings.</div>
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
          LOKIN distinguishes W-2 employment (taxes withheld) from 1099/gig contractor work. Pay is labeled advertised, estimated, or driver-reported — <span className="text-white/60">never guaranteed</span>. Each listing shows its source, verification date, vehicle needs, likely expenses, and the official application link.
        </p>
      </div>

      <div className="text-center text-[10px] tracking-[0.18em] text-white/30 pt-1">
        HAMPTON ROADS · WEEKLY SCAN · LOKIN AI
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