import { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ScanLine, XCircle, SlidersHorizontal } from "lucide-react";
import {
  screenshotToDataUrl,
  parseOfferScreenshot,
  normalizeParsedOffer,
  evaluateOffer,
  loadOfferThresholds,
  saveOfferThresholds,
  VERDICT_META,
} from "@/lib/offerOcr";

// Screenshot -> AI parse -> offer evaluation.
// The driver snaps the delivery offer screen (Dasher, Uber Eats, etc.);
// the gateway vision model reads payout / miles / time, and LOKIN scores
// $/mile and $/hour against the driver's own thresholds with a verdict.
export default function OfferEvaluator() {
  const fileRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | reading | result | error
  const [preview, setPreview] = useState(null);
  const [offer, setOffer] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [thresholds, setThresholds] = useState(loadOfferThresholds());
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState("");

  function updateThresholds(t) {
    setThresholds(t);
    saveOfferThresholds(t);
    if (offer) setEvaluation(evaluateOffer(offer, t));
  }

  function setT(k, v) {
    const n = Number(v);
    const t = { ...thresholds, [k]: Number.isFinite(n) && n > 0 ? n : thresholds[k] };
    updateThresholds(t);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setOffer(null);
    setEvaluation(null);
    setPhase("reading");
    try {
      const dataUrl = await screenshotToDataUrl(file);
      setPreview(dataUrl);
      const result = await parseOfferScreenshot(dataUrl);
      const normalized = normalizeParsedOffer(result.parsed);
      setOffer(normalized);
      setEvaluation(evaluateOffer(normalized, loadOfferThresholds()));
      setPhase("result");
    } catch (err) {
      setError(err?.message || "Could not read that screenshot. Try a clearer one.");
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setPreview(null);
    setOffer(null);
    setEvaluation(null);
    setError("");
  }

  const meta = evaluation ? VERDICT_META[evaluation.verdict] || VERDICT_META.unknown : null;
  const toneCls =
    meta?.tone === "take"
      ? "border-lokin-neon/60 bg-lokin-neon/10"
      : meta?.tone === "skip"
        ? "border-red-400/40 bg-red-400/10"
        : "border-amber-300/40 bg-amber-300/10";
  const labelCls =
    meta?.tone === "take" ? "text-lokin-neon" : meta?.tone === "skip" ? "text-red-300" : "text-amber-200";

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/60";

  function detail(label, value) {
    if (!value) return null;
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{label}</span>
        <span className="text-white font-semibold">{value}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-primary" />
          <div className="text-sm font-bold text-white">Evaluate offer</div>
        </div>
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Offer evaluation thresholds"
          className="rounded-lg border border-white/10 p-1.5 text-white/50 active:scale-95"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="text-[11px] text-white/40 mb-3">
        Snap the offer screen — LOKIN reads the payout, miles, and time, then scores it.
      </div>

      {showSettings && (
        <div className="mb-3 rounded-xl border border-white/10 bg-black/30 p-3 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-white/35 mb-1">$/mi floor</div>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={thresholds.minPerMile} onChange={(e) => setT("minPerMile", e.target.value)} className={inputCls} />
          </div>
          <div>
            <div className="text-[10px] text-white/35 mb-1">$/mi target</div>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={thresholds.targetPerMile} onChange={(e) => setT("targetPerMile", e.target.value)} className={inputCls} />
          </div>
          <div>
            <div className="text-[10px] text-white/35 mb-1">$/hr floor</div>
            <input type="number" inputMode="decimal" min="0" step="1" value={thresholds.minPerHour} onChange={(e) => setT("minPerHour", e.target.value)} className={inputCls} />
          </div>
          <div>
            <div className="text-[10px] text-white/35 mb-1">$/hr target</div>
            <input type="number" inputMode="decimal" min="0" step="1" value={thresholds.targetPerHour} onChange={(e) => setT("targetPerHour", e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      {phase === "idle" && (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-primary/40 bg-primary/[0.06] py-5 flex flex-col items-center gap-2 active:scale-[0.99] transition-transform"
        >
          <Camera className="h-6 w-6 text-primary" />
          <span className="text-sm font-semibold text-primary">Snap offer screen</span>
          <span className="text-[11px] text-white/35">Dasher, Uber Eats, Instacart, Spark, Shipt…</span>
        </button>
      )}

      {phase === "reading" && (
        <div className="flex items-center justify-center gap-2 py-8 text-white/60 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Reading the offer…
        </div>
      )}

      {phase === "result" && offer && evaluation && (
        <div className="space-y-3">
          {preview && (
            <img src={preview} alt="Offer screenshot" className="w-full max-h-48 object-contain rounded-xl border border-white/10 bg-black/40" />
          )}
          <div className={`rounded-2xl border p-4 text-center ${toneCls}`}>
            <div className={`text-lg font-black tracking-wide ${labelCls}`}>{meta.label}</div>
            <div className="mt-1 flex items-center justify-center gap-4 text-sm">
              <span className="text-white/70">
                <b className="text-white">${offer.amount != null ? offer.amount.toFixed(2) : "—"}</b> offer
              </span>
              {evaluation.perMile !== null && (
                <span className="text-white/70">
                  <b className="text-white">${evaluation.perMile.toFixed(2)}</b>/mi{evaluation.estimatedMiles ? "*" : ""}
                </span>
              )}
              {evaluation.perHour !== null && (
                <span className="text-white/70">
                  <b className="text-white">${evaluation.perHour.toFixed(2)}</b>/hr
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-3">
            {detail("Platform", offer.platform)}
            {detail("Merchant", offer.merchant)}
            {detail("Dropoff", offer.destination)}
            {detail("Miles", offer.miles != null ? `${offer.miles} mi` : null)}
            {detail("Time", offer.minutes != null ? `${offer.minutes} min` : null)}
            {detail("Stops", offer.stops != null ? String(offer.stops) : null)}
            {offer.peak_pay && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Peak pay</span>
                <span className="text-lokin-neon font-semibold">Active</span>
              </div>
            )}
            {offer.confidence && offer.confidence !== "high" && (
              <div className="text-[11px] text-white/35 pt-1">
                Read with {offer.confidence} confidence{offer.note ? ` — ${offer.note}` : ""}
              </div>
            )}
          </div>
          <ul className="space-y-1">
            {evaluation.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-white/60">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-white/30" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <button onClick={reset} className="lokin-cta w-full">EVALUATE ANOTHER</button>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <XCircle className="h-8 w-8 text-red-400/70" />
          <div className="text-xs text-white/55 max-w-[26ch]">{error}</div>
          <button onClick={reset} className="text-xs text-primary underline underline-offset-2">Try again</button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
