import { useState } from "react";
import { MapPin, Navigation, Search, ExternalLink, Star, Truck, ParkingCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = [
  { value: "all", label: "All Stops", icon: MapPin },
  { value: "truck_stop", label: "Truck Stops", icon: Truck },
  { value: "weigh_station", label: "Weigh Stations", icon: Navigation },
  { value: "rest_area", label: "Rest Areas", icon: ParkingCircle },
  { value: "rv_park", label: "RV Parks", icon: MapPin },
];

const TYPE_BADGE = {
  truck_stop: { label: "Truck Stop", cls: "text-primary border-primary/30 bg-primary/10" },
  weigh_station: { label: "Weigh Station", cls: "text-accent border-accent/30 bg-accent/10" },
  rest_area: { label: "Rest Area", cls: "text-primary border-primary/30 bg-primary/10" },
  rv_park: { label: "RV Park", cls: "text-accent border-accent/30 bg-accent/10" },
};

export default function OnTheRoad() {
  const { toast } = useToast();
  const [mode, setMode] = useState("near"); // near | route
  const [location, setLocation] = useState("");
  const [route, setRoute] = useState("");
  const [category, setCategory] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    if (mode === "near" && !location.trim()) {
      toast({ title: "Enter a location", variant: "destructive" });
      return;
    }
    if (mode === "route" && !route.trim()) {
      toast({ title: "Enter a route", description: "e.g. Chicago, IL to Dallas, TX", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await base44.functions.invoke("findRoadStops", {
        location: mode === "near" ? location : "",
        route: mode === "route" ? route : "",
        category,
      });
      setResults(res.data?.results || []);
    } catch (e) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">On The Road</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">
        Truck stops, weigh stations, rest areas &amp; RV parks — for truckers and travelers alike.
      </p>

      {/* Mode toggle */}
      <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <button
          onClick={() => setMode("near")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            mode === "near" ? "bg-primary text-primary-foreground glow-primary" : "text-white/55"
          }`}
        >
          Near a place
        </button>
        <button
          onClick={() => setMode("route")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            mode === "route" ? "bg-primary text-primary-foreground glow-primary" : "text-white/55"
          }`}
        >
          Along a route
        </button>
      </div>

      {/* Search input */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
        {mode === "near" ? (
          <div>
            <div className="text-xs text-white/45 mb-1">Location</div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, state or address"
                className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-white/30"
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-white/45 mb-1">Route</div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3">
              <Navigation className="h-4 w-4 text-primary shrink-0" />
              <input
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="Chicago, IL to Dallas, TX"
                className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-white/30"
              />
            </div>
          </div>
        )}

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const on = category === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  on ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"
                }`}
              >
                <Icon className="h-3 w-3" /> {c.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={search}
          disabled={loading}
          className="w-full rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-bold glow-primary active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Search className="h-4 w-4" /> {loading ? "Searching…" : "Find Stops"}
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-white/40 text-sm">Scouting the road…</div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-sm">No stops found. Try a broader search.</div>
      ) : (
        <div className="space-y-3">
          {results.map((r, i) => {
            const badge = TYPE_BADGE[r.type] || TYPE_BADGE.truck_stop;
            return (
              <div key={i} className="rounded-3xl border border-white/10 lokin-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{r.name}</div>
                    <span className={`inline-block mt-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  {r.rating > 0 && (
                    <div className="flex items-center gap-1 text-xs text-white/60 shrink-0">
                      <Star className="h-3.5 w-3.5 text-primary fill-primary" /> {r.rating.toFixed(1)}
                    </div>
                  )}
                </div>
                {r.address && (
                  <div className="text-xs text-white/55 mt-2 flex items-start gap-1">
                    <MapPin className="h-3.5 w-3.5 text-white/40 mt-0.5 shrink-0" /> {r.address}
                  </div>
                )}
                {r.amenities && (
                  <div className="text-xs text-white/45 mt-1.5">{r.amenities}</div>
                )}
                {r.maps_url && (
                  <a
                    href={r.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:scale-[0.98] transition-transform"
                  >
                    <ExternalLink className="h-3 w-3" /> Directions
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}