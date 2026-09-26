import { X } from "lucide-react";

export default function GeofenceBanner({ geofenceResult, onDismiss }) {
  if (!geofenceResult?.triggered) return null;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.08] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-primary">🔔 Found a store! Searching for items...</div>
          <div className="mt-1 text-xs text-white/65">
            {geofenceResult.store_name || "Nearby store"} · {Number(geofenceResult.item_count || 0)} item{Number(geofenceResult.item_count || 0) === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss geofence alert"
          className="rounded-lg border border-white/10 p-1 text-white/55 active:scale-95"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
