import { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  screenshotToDataUrl,
  parseEarningsScreenshot,
  normalizeParsedEarning,
  EARNING_PLATFORMS,
} from "@/lib/earningsOcr";

// Screenshot -> AI parse -> confirm -> Earning record.
// The driver snaps their gig-app earnings screen; the gateway vision model
// reads amount / platform / date / trips, the driver confirms, and it is
// saved as a normal Earning record (same as manual entry).
export default function EarningsScreenshotImport({ onSaved }) {
  const fileRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | reading | parsed | saving | done | error
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ amount: "", platform: "", date: "", trips: "", confidence: "low", note: "" });
  const [error, setError] = useState("");

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setPhase("reading");
    try {
      const dataUrl = await screenshotToDataUrl(file);
      setPreview(dataUrl);
      const result = await parseEarningsScreenshot(dataUrl);
      setForm(normalizeParsedEarning(result.parsed));
      setPhase("parsed");
    } catch (err) {
      setError(err?.message || "Could not read that screenshot. Try a clearer one, or enter it manually.");
      setPhase("error");
    }
  }

  async function save() {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter the earnings amount first.");
      return;
    }
    setError("");
    setPhase("saving");
    try {
      const today = new Date().toISOString().slice(0, 10);
      await base44.entities.Earning.create({
        date: form.date || today,
        amount: Math.round(amount * 100) / 100,
        trips: Number(form.trips) > 0 ? Math.round(Number(form.trips)) : 0,
        platform: form.platform || "Other",
      });
      setPhase("done");
      onSaved?.();
    } catch (err) {
      setError(err?.message || "Could not save that earning.");
      setPhase("parsed");
    }
  }

  function reset() {
    setPhase("idle");
    setPreview(null);
    setError("");
    setForm({ amount: "", platform: "", date: "", trips: "", confidence: "low", note: "" });
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/60";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-1">
        <ScanLine className="h-4 w-4 text-primary" />
        <div className="text-sm font-bold text-white">Scan earnings screenshot</div>
      </div>
      <div className="text-[11px] text-white/40 mb-3">
        Snap your gig app&apos;s earnings screen — LOKIN reads the numbers and logs them automatically.
      </div>

      {phase === "idle" && (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-primary/40 bg-primary/[0.06] py-5 flex flex-col items-center gap-2 active:scale-[0.99] transition-transform"
        >
          <Camera className="h-6 w-6 text-primary" />
          <span className="text-sm font-semibold text-primary">Choose screenshot</span>
          <span className="text-[11px] text-white/35">DoorDash, Uber, Instacart, Spark, Shipt…</span>
        </button>
      )}

      {(phase === "reading" || phase === "saving") && (
        <div className="flex items-center justify-center gap-2 py-8 text-white/60 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {phase === "reading" ? "Reading your screenshot…" : "Saving…"}
        </div>
      )}

      {(phase === "parsed" || (phase === "error" && preview)) && preview && (
        <div className="space-y-3">
          <img src={preview} alt="Earnings screenshot" className="w-full max-h-56 object-contain rounded-xl border border-white/10 bg-black/40" />
          {phase === "parsed" && (
            <>
              <div className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-white/55">
                  Read with {form.confidence} confidence{form.note ? ` — ${form.note}` : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-white/35 mb-1">Amount ($)</div>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <div className="text-[10px] text-white/35 mb-1">Trips</div>
                  <input type="number" inputMode="numeric" min="0" step="1" value={form.trips} onChange={(e) => set("trips", e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-white/35 mb-1">Platform</div>
                  <div className="flex flex-wrap gap-1.5">
                    {EARNING_PLATFORMS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => set("platform", p)}
                        aria-pressed={form.platform === p}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          form.platform === p
                            ? "border-lokin-neon/60 bg-lokin-neon/15 text-white"
                            : "border-white/10 bg-white/[0.03] text-white/55"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-white/35 mb-1">Date</div>
                  <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
                </div>
              </div>
              {!form.platform && (
                <div className="text-[11px] text-amber-300/80">Pick the platform so per-app totals stay accurate.</div>
              )}
              <div className="flex gap-2">
                <button onClick={save} className="lokin-cta flex-1">LOG EARNING</button>
                <button onClick={reset} className="rounded-2xl border border-white/10 px-4 text-sm text-white/60">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          <div className="text-sm font-bold text-white">Earning logged</div>
          <button onClick={reset} className="text-xs text-primary underline underline-offset-2">Scan another</button>
        </div>
      )}

      {phase === "error" && !preview && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <XCircle className="h-8 w-8 text-red-400/70" />
          <div className="text-xs text-white/55 max-w-[26ch]">{error}</div>
          <button onClick={reset} className="text-xs text-primary underline underline-offset-2">Try again</button>
        </div>
      )}
      {error && (phase === "parsed" || phase === "saving") && (
        <div className="text-[11px] text-red-300/80">{error}</div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
