import { Search, SlidersHorizontal } from "lucide-react";

const CATS = [
  { value: "all", label: "All" },
  { value: "gig_app", label: "Food & Grocery" },
  { value: "package_courier", label: "Package & Retail" },
  { value: "courier_1099", label: "Courier Routes" },
  { value: "medical_courier", label: "Medical & Specialty" },
  { value: "warehouse", label: "Warehouse & Dock" },
  { value: "w2_driver", label: "W-2 Employment" },
  { value: "cannabis_delivery", label: "Cannabis" },
  { value: "alcohol_delivery", label: "Alcohol" },
];

const VEHICLES = [
  { value: "any", label: "Any vehicle" },
  { value: "personal_car", label: "Personal car" },
  { value: "cargo_van", label: "Cargo van" },
  { value: "box_truck", label: "Box truck" },
];

const SCHEDULES = [
  { value: "any", label: "Any schedule" },
  { value: "flexible", label: "Flexible" },
  { value: "on_demand", label: "On-demand" },
  { value: "fixed_shifts", label: "Fixed shifts" },
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
];

const SORTS = [
  { value: "net", label: "Best net/hr" },
  { value: "gross", label: "Highest gross" },
  { value: "newest", label: "Newest" },
];

function selectCls() {
  return "rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/80 outline-none";
}

export default function OpportunityFilters({ filters, setFilters }) {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
        <Search className="h-4 w-4 text-white/40 shrink-0" />
        <input
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search title, company, or city…"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {CATS.map((c) => (
          <button
            key={c.value}
            onClick={() => set("category", c.value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              filters.category === c.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-white/10 bg-white/[0.03] text-white/50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <SlidersHorizontal className="h-3.5 w-3.5 text-white/35" />
        <select value={filters.vehicle} onChange={(e) => set("vehicle", e.target.value)} className={selectCls()}>
          {VEHICLES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
        <select value={filters.schedule} onChange={(e) => set("schedule", e.target.value)} className={selectCls()}>
          {SCHEDULES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filters.sort} onChange={(e) => set("sort", e.target.value)} className={selectCls()}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}