import { useEffect, useState } from "react";
import { Radar, RefreshCw, ExternalLink, MapPin, BadgeDollarSign, Car, Briefcase, Filter } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "gig_app", label: "Gig Apps" },
  { value: "w2_driver", label: "W-2 Driver" },
  { value: "courier_1099", label: "1099 Courier" },
  { value: "medical_courier", label: "Medical" },
  { value: "package_courier", label: "Package" },
  { value: "cannabis_delivery", label: "Cannabis" },
  { value: "alcohol_delivery", label: "Alcohol" },
];

const ROLE_LABELS = { personal_car: "Personal Car", cargo_van: "Cargo Van", box_truck: "Box Truck", any: "Any Vehicle" };

export default function Opportunities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [cat, setCat] = useState("all");
  const [lastScan, setLastScan] = useState(null);

  async function load() {
    setLoading(true);
    const recs = await base44.entities.OpportunityScan.filter({}, "-scan_date", 100);
    setItems(recs);
    setLastScan(recs[0]?.scan_date || null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function runScan() {
    setScanning(true);
    try {
      await guardedInvoke(base44, "scanOpportunities", {}, { force: true, userInitiated: true });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  }

  const filtered = cat === "all" ? items : items.filter((i) => i.category === cat);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold font-heading metal-text">Opportunity Scan</h1>
        </div>
        <button onClick={runScan} disabled={scanning}
          className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary glow-primary disabled:opacity-60 active:scale-95 transition-transform">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} /> {scanning ? "Scanning…" : "Run Scan"}
        </button>
      </div>

      <p className="text-sm text-white/45 -mt-2">
        Weekly Monday scan of Hampton Roads delivery & courier work — gig apps, W-2, 1099 routes, medical, package, legal cannabis & alcohol delivery.
      </p>

      {lastScan && (
        <div className="text-[11px] text-white/40">Last scan: <span className="text-primary font-semibold">{lastScan}</span> · {items.length} opportunities</div>
      )}

      {/* Category filter chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <Filter className="h-3.5 w-3.5 text-white/35 shrink-0" />
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCat(c.value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${cat === c.value ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-white/50 text-center py-10">Loading opportunities…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-white/45 text-center py-10">No opportunities yet. Tap "Run Scan" to pull the latest Hampton Roads openings.</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o) => (
            <div key={o.id} className="rounded-2xl border border-white/10 lokin-panel p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{o.title}</div>
                  <div className="text-xs text-white/45 truncate">{o.company || o.source}</div>
                </div>
                {o.pay && <div className="text-sm font-bold text-primary shrink-0">{o.pay}</div>}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/55">
                <span className="flex items-center gap-1"><Briefcase className="h-3 w-3 text-primary" />{CATEGORIES.find((c) => c.value === o.category)?.label || o.category}</span>
                {o.role_type && o.role_type !== "any" && <span className="flex items-center gap-1"><Car className="h-3 w-3 text-primary" />{ROLE_LABELS[o.role_type] || o.role_type}</span>}
                {o.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{o.location}</span>}
                {o.employment_type && <span className="text-white/40">{o.employment_type}</span>}
              </div>
              {(o.vehicle_requirements || o.qualifications) && (
                <div className="mt-2 text-[11px] text-white/50 space-y-0.5">
                  {o.vehicle_requirements && <div><span className="text-white/35">Vehicle:</span> {o.vehicle_requirements}</div>}
                  {o.qualifications && <div><span className="text-white/35">Quals:</span> {o.qualifications}</div>}
                </div>
              )}
              {o.notes && <div className="mt-1.5 text-[11px] text-accent/80">{o.notes}</div>}
              {o.apply_url && (
                <a href={o.apply_url} target="_blank" rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:scale-95 transition-transform">
                  Apply <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-center text-[10px] tracking-[0.18em] text-white/30 pt-2">
        SCANS EVERY MONDAY · HAMPTON ROADS · LOKIN AI
      </div>
    </div>
  );
}