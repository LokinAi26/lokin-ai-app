import { Search, SlidersHorizontal } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

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

function triggerCls() {
  return "min-h-11 h-11 rounded-full border border-white/10 bg-black/30 px-3 text-xs text-white/80 gap-2 hover:border-white/20";
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
        <SlidersHorizontal className="h-3.5 w-3.5 text-white/35 shrink-0" />
        <Select value={filters.vehicle} onValueChange={(v) => set("vehicle", v)}>
          <SelectTrigger className={`${triggerCls()} w-auto`}><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {VEHICLES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.schedule} onValueChange={(v) => set("schedule", v)}>
          <SelectTrigger className={`${triggerCls()} w-auto`}><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {SCHEDULES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.sort} onValueChange={(v) => set("sort", v)}>
          <SelectTrigger className={`${triggerCls()} w-auto`}><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}