import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";

export default function DriverReportModal({ open, onClose, item, onSubmit, currentCoords }) {
  const [aisle, setAisle] = useState("");
  const [shelf, setShelf] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setAisle("");
      setShelf("");
      setConfidence(3);
    }
  }, [open]);

  useEffect(() => {
    setAisle("");
    setShelf("");
    setConfidence(3);
  }, [item?.id]);

  if (!open || !item) return null;

  async function submit(event) {
    event.preventDefault();
    if (!Number.isFinite(Number(currentCoords?.latitude)) || !Number.isFinite(Number(currentCoords?.longitude))) {
      toast({ title: "GPS required", description: "Enable location before reporting item position." });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        item_id: item.id,
        aisle,
        shelf,
        confidence,
        driver_latitude: Number(currentCoords.latitude),
        driver_longitude: Number(currentCoords.longitude),
      });
      toast({ title: "Thanks!", description: "Item location report saved." });
      onClose();
      setAisle("");
      setShelf("");
      setConfidence(3);
    } catch (error) {
      toast({ title: "Couldn't save report", description: error?.message || "Try again in a moment." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0a0c0a] p-5">
        <div className="text-sm font-semibold text-primary">Found It!</div>
        <div className="mt-1 text-lg font-bold text-white">{item.name}</div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs text-white/60">Aisle</span>
            <input value={aisle} onChange={(e) => setAisle(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">Shelf</span>
            <input value={shelf} onChange={(e) => setShelf(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white" />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">Confidence: {confidence}</span>
            <input type="range" min="1" max="5" step="1" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="mt-2 w-full" />
          </label>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/12 py-2 text-sm text-white/70">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-primary py-2 text-sm font-bold text-black disabled:opacity-60">
            {saving ? "Saving..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
