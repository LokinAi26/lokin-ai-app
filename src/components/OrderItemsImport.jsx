import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Minus, Plus, ReceiptText, X } from "lucide-react";
import {
  parseOrderItemsScreenshots,
  normalizeOrderItems,
  screenshotToDataUrl,
} from "@/lib/orderItemsOcr";

// Order-items screenshot import for the AI item locator.
// Driver snaps the Dasher/Instacart/Shipt shopping-list screen (up to 2 shots
// for long lists), the gateway reads every item + quantity, the driver reviews,
// then items merge into the Smart Shop trip list for aisle-ordered shopping.
export default function OrderItemsImport({ onImport, autoOpen = false }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { items, store, confidence, note }
  const [draft, setDraft] = useState([]);

  // Opened from the store-entry sheet (?import=1): pop the picker immediately.
  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
      const t = window.setTimeout(() => fileRef.current?.click(), 350);
      return () => window.clearTimeout(t);
    }
  }, [autoOpen]);

  function reset() {
    setBusy(false);
    setError("");
    setResult(null);
    setDraft([]);
  }

  async function handleFiles(files) {
    const picked = Array.from(files || []).slice(0, 2);
    if (!picked.length) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const urls = [];
      for (const f of picked) urls.push(await screenshotToDataUrl(f));
      const payload = await parseOrderItemsScreenshots(urls);
      const norm = normalizeOrderItems(payload.parsed);
      if (!norm.items.length) {
        setError("LOKIN couldn't find items in that screenshot. Try the order's item list screen — the one showing each product and quantity.");
        return;
      }
      setResult(norm);
      setDraft(norm.items.map((it, i) => ({ ...it, key: `${Date.now()}-${i}` })));
    } catch (e) {
      setError(e?.message || "Could not read that screenshot. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function bump(key, delta) {
    setDraft((xs) => xs.map((x) => (x.key === key ? { ...x, quantity: Math.min(99, Math.max(1, x.quantity + delta)) } : x)));
  }

  function remove(key) {
    setDraft((xs) => xs.filter((x) => x.key !== key));
  }

  function confirm() {
    const items = draft.map(({ name, quantity, unit }) => ({ name, quantity, unit }));
    try {
      onImport && onImport(items);
    } finally {
      setOpen(false);
      reset();
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Snap the order item list"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
      {!open ? (
        <button
          type="button"
          onClick={() => { reset(); setOpen(true); }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.08] px-5 text-sm font-extrabold text-primary active:scale-[0.98]"
        >
          <ReceiptText className="h-4 w-4" />
          IMPORT ORDER ITEMS
        </button>
      ) : (
        <div className="rounded-2xl border border-primary/25 bg-black/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <ReceiptText className="h-4 w-4" />
              <span className="text-[10px] font-bold tracking-[0.2em]">ORDER ITEMS</span>
            </div>
            <button
              type="button"
              aria-label="Close import"
              onClick={() => { setOpen(false); reset(); }}
              className="rounded-lg p-1.5 text-white/40 active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!result && (
            <>
              <p className="text-xs text-white/50">
                Snap the shopping list in your driver app — the screen showing each product and quantity. Two shots max for long lists.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground glow-primary disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {busy ? "READING ITEMS…" : "SNAP ORDER SCREEN"}
              </button>
            </>
          )}

          {error && <div className="text-xs text-destructive">{error}</div>}

          {result && (
            <>
              <div className="text-xs text-white/45">
                {result.store ? <span className="font-semibold text-white/70">{result.store} · </span> : null}
                {draft.length} item{draft.length === 1 ? "" : "s"} found — adjust quantities, then add them to your trip.
                {result.confidence === "low" && <span className="text-amber-300"> Double-check the list before adding.</span>}
              </div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {draft.map((it) => (
                  <div key={it.key} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">{it.name}</div>
                      {it.unit && <div className="text-[10px] text-white/35">{it.unit}</div>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" aria-label={`Fewer ${it.name}`} onClick={() => bump(it.key, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 active:scale-95">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-primary">{it.quantity}</span>
                      <button type="button" aria-label={`More ${it.name}`} onClick={() => bump(it.key, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 active:scale-95">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label={`Remove ${it.name}`} onClick={() => remove(it.key)} className="flex h-8 w-8 items-center justify-center text-white/35 active:scale-95">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!draft.length}
                  onClick={confirm}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground glow-primary disabled:opacity-60"
                >
                  ADD {draft.length > 0 ? `${draft.length} ` : ""}TO SMART SHOP
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-bold text-white/60 active:scale-95"
                >
                  <Camera className="h-4 w-4" />
                  RETAKE
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
