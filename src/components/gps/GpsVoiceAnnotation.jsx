// GPS voice annotation (SPEC-002 section 6, Phase 4) — scoped to the GPS map
// surface only. A mic button on the map HUD captures speech through the
// EXISTING voice pipeline (MediaRecorder → transcription via voice-pipeline),
// parses it with simple keyword matching, and creates a PROVISIONAL
// DRIVER_REPORTED annotation at the driver's current GPS position (50m radius)
// after a confirmation chip shows the transcript verbatim.
//
// Lifecycle: tap the annotation to confirm (solid outline). A dismiss control
// or 5 minutes unconfirmed removes it. An annotation without a GPS position
// is never created — geometry is never invented.

import { useEffect, useRef, useState } from "react";
import { Check, Mic, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  canRecordVoice,
  startVoiceRecording,
  transcribeVoiceBlob,
  unlockVoiceAudio,
} from "@/lib/lokinVoicePipeline";
import {
  ANNOTATION_CHOICES,
  annotationTypeLabel,
  parseAnnotationTranscript,
} from "@/lib/gpsAnnotationParser";
import {
  ANNO_LINE_CONFIRMED,
  ANNO_LINE_PROVISIONAL,
  ANNO_CONFIRM_PROMPT,
  mapAnnotationLabel,
  syncAnnotations,
} from "@/lib/gpsAnnotationMap";

const ENTITY_FOR_KIND = { HAZARD: "Hazard", DELIVERY_ZONE: "DeliveryZone" };
const CONFIRM_TTL_MS = 5 * 60 * 1000;

export default function GpsVoiceAnnotation({ mapRef, coordinate }) {
  const [annotations, setAnnotations] = useState([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  // chip: { mode: "confirm"|"ask"|"pending"|"error", transcript, kind, subtype, localId, message, busy }
  const [chip, setChip] = useState(null);
  const coordinateRef = useRef(coordinate);
  coordinateRef.current = coordinate;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const recRef = useRef(null);
  const localIdRef = useRef(0);

  // ---- Map rendering ----
  useEffect(() => {
    const map = mapRef?.current;
    if (!map) return undefined;
    const apply = () => {
      try {
        syncAnnotations(map, annotationsRef.current);
      } catch {
        // Style mid-swap; the next sync re-applies.
      }
    };
    if (typeof map.isStyleLoaded === "function" && map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
    // Route/stop layers rebuild with the default top slot on route changes —
    // the idle re-sync keeps the annotation chrome pinned above them.
    map.on("idle", apply);
    return () => map.off("idle", apply);
  }, [annotations, mapRef]);

  function removeAnnotation(localId) {
    const anno = annotationsRef.current.find((a) => a.localId === localId);
    if (!anno) return;
    setAnnotations((list) => list.filter((a) => a.localId !== localId));
    setChip((c) => (c?.mode === "pending" && c.localId === localId ? null : c));
    base44.entities[ENTITY_FOR_KIND[anno.kind]].delete(anno.recordId).catch(() => {});
  }

  function confirmAnnotation(localId) {
    const anno = annotationsRef.current.find((a) => a.localId === localId);
    if (!anno || anno.status !== "provisional") return;
    setAnnotations((list) =>
      list.map((a) =>
        a.localId === localId
          ? { ...a, status: "confirmed", label: mapAnnotationLabel(a.kind, a.subtype, "confirmed") }
          : a
      )
    );
    setChip((c) => (c?.mode === "pending" && c.localId === localId ? null : c));
    base44.entities[ENTITY_FOR_KIND[anno.kind]].update(anno.recordId, { status: "confirmed" }).catch(() => {});
  }

  // Tap an annotation on the map to confirm it.
  useEffect(() => {
    const map = mapRef?.current;
    if (!map) return undefined;
    const onClick = (event) => {
      const props = event?.features?.[0]?.properties || {};
      if (props.status === "provisional" && props.localId) confirmAnnotation(Number(props.localId));
    };
    for (const layerId of [ANNO_LINE_PROVISIONAL, ANNO_LINE_CONFIRMED]) {
      map.on("click", layerId, onClick);
    }
    return () => {
      for (const layerId of [ANNO_LINE_PROVISIONAL, ANNO_LINE_CONFIRMED]) {
        try { map.off("click", layerId, onClick); } catch { /* map gone */ }
      }
    };
  }, [mapRef]);

  // 5 minutes unconfirmed removes the annotation (and its record).
  useEffect(() => {
    const timers = annotations
      .filter((a) => a.status === "provisional")
      .map((a) => window.setTimeout(() => removeAnnotation(a.localId), Math.max(0, a.createdAt + CONFIRM_TTL_MS - Date.now())));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [annotations]);

  async function createAnnotation(kind, subtype, transcript) {
    const coordinate = coordinateRef.current;
    if (!coordinate) {
      setChip({ mode: "error", message: "No GPS position yet — annotation can't be created." });
      return;
    }
    setChip((c) => ({ ...c, busy: true }));
    const localId = ++localIdRef.current;
    const typeText = annotationTypeLabel(kind, subtype) || "ANNOTATION";
    try {
      const record = await base44.entities[ENTITY_FOR_KIND[kind]].create({
        label: `${typeText} — at current position`,
        latitude: coordinate[1],
        longitude: coordinate[0],
        radius_m: 50,
        status: "provisional",
        provenance: "DRIVER_REPORTED",
        transcript,
        observed_at: new Date().toISOString(),
      });
      setAnnotations((list) => [
        ...list,
        { localId, recordId: record.id, kind, subtype, coordinate, status: "provisional", createdAt: Date.now() },
      ]);
      setChip({ mode: "pending", localId });
    } catch {
      setChip({ mode: "error", message: "Couldn't save the annotation. Tap the mic to try again." });
    }
  }

  async function onMicTap() {
    if (recording) {
      try { recRef.current?.stop(); } catch { /* already stopped */ }
      return;
    }
    if (busy) return;
    unlockVoiceAudio();
    if (!canRecordVoice()) {
      setChip({ mode: "error", message: "Voice input isn't available on this device." });
      return;
    }
    setRecording(true);
    setChip(null);
    try {
      const rec = await startVoiceRecording({ maxMs: 8000 });
      recRef.current = rec;
      const blob = await rec.done;
      recRef.current = null;
      setRecording(false);
      if (!blob || blob.size < 800) {
        setChip({ mode: "error", message: "Didn't catch that. Tap the mic and try again." });
        return;
      }
      setBusy(true);
      const text = await transcribeVoiceBlob(blob, 8000);
      setBusy(false);
      const transcript = String(text || "").trim();
      if (!transcript) {
        setChip({ mode: "error", message: "No speech detected. Tap the mic and try again." });
        return;
      }
      const parsed = parseAnnotationTranscript(transcript);
      if (parsed.kind === "HAZARD" || (parsed.kind === "DELIVERY_ZONE" && parsed.subtype)) {
        setChip({ mode: "confirm", transcript, kind: parsed.kind, subtype: parsed.subtype });
      } else {
        // No keyword match (or "delivery zone" without a sub-type): ask — never guess.
        setChip({ mode: "ask", transcript });
      }
    } catch {
      recRef.current = null;
      setRecording(false);
      setBusy(false);
      setChip({ mode: "error", message: "Voice capture failed. Tap the mic to retry." });
    }
  }

  const hasPosition = Boolean(coordinate);

  return (
    <>
      {/* Confirmation chip — transcript verbatim + parsed type, or the ask-type grid */}
      {chip && (
        <div className="pointer-events-auto absolute left-3 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-30 w-[min(78vw,320px)] rounded-2xl border border-[#FFB020]/50 bg-black/90 p-3 shadow-2xl backdrop-blur-xl">
          {chip.mode === "confirm" && (
            <>
              <div className="lokin-kicker text-[#FFB020]">NEW ANNOTATION</div>
              <div className="mt-1 text-[11px] leading-snug text-white/85">&ldquo;{chip.transcript}&rdquo;</div>
              <div className="mt-1.5 text-[11px] font-extrabold tracking-[0.12em] text-[#FFB020]">
                {annotationTypeLabel(chip.kind, chip.subtype)}
                {!hasPosition && <span className="ml-1 font-bold text-white/50">· NO GPS FIX</span>}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  disabled={chip.busy}
                  onClick={() => createAnnotation(chip.kind, chip.subtype, chip.transcript)}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-[#FFB020] bg-[#FFB020]/15 text-xs font-extrabold tracking-[0.1em] text-[#FFB020] active:scale-95 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> {chip.busy ? "SAVING…" : "CONFIRM"}
                </button>
                <button
                  type="button"
                  aria-label="Cancel annotation"
                  onClick={() => setChip(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/60 active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          {chip.mode === "ask" && (
            <>
              <div className="lokin-kicker text-[#FFB020]">WHICH TYPE?</div>
              <div className="mt-1 text-[11px] leading-snug text-white/85">&ldquo;{chip.transcript}&rdquo;</div>
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                {ANNOTATION_CHOICES.map((choice) => (
                  <button
                    key={choice.label}
                    type="button"
                    disabled={chip.busy}
                    onClick={() => createAnnotation(choice.kind, choice.subtype, chip.transcript)}
                    className="flex h-9 items-center justify-center rounded-full border border-[#FFB020]/50 text-[11px] font-extrabold tracking-[0.1em] text-[#FFB020] active:scale-95 disabled:opacity-50"
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setChip(null)}
                className="mt-2 w-full text-center text-[10px] font-semibold text-white/40"
              >
                Cancel
              </button>
            </>
          )}
          {chip.mode === "pending" && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold tracking-[0.08em] text-[#FFB020]">
                {ANNO_CONFIRM_PROMPT}
              </span>
              <button
                type="button"
                aria-label="Dismiss annotation"
                onClick={() => removeAnnotation(chip.localId)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/60 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {chip.mode === "error" && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] leading-snug text-amber-200">{chip.message}</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setChip(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/60 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mic button — large touch target, thumb-reachable */}
      <button
        type="button"
        aria-label={recording ? "Stop annotation speech" : "Speak a GPS annotation"}
        onClick={onMicTap}
        className={`absolute right-3 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full border ${
          recording
            ? "border-[#FFB020] bg-[#FFB020]/20 lokin-mic-pulse"
            : "border-accent/50 bg-black/85"
        } text-accent shadow-lg backdrop-blur active:scale-95`}
      >
        <Mic className="h-6 w-6" style={recording ? { color: "#FFB020" } : undefined} />
      </button>
    </>
  );
}