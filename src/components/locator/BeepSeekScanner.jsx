import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { createBeepSeeker } from "@/lib/locatorBeep";

const DETECT_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];
// Fraction of the camera frame the target barcode's bounding box fills, from
// "spotted across the aisle" to "phone nearly touching it". This is a real
// physical-proximity signal — no simulated distance.
const FAR_FRACTION = 0.045;
const NEAR_FRACTION = 0.55;
const LOCK_FRACTION = 0.5;

function normalizeCode(value) {
  return String(value || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

const STATUS_META = {
  searching: { label: "SWEEPING FOR TARGET CODE", tone: "text-white/55" },
  wrong: { label: "WRONG ITEM — KEEP SWEEPING", tone: "text-amber-300" },
  target: { label: "ON TARGET — BEEPS QUICKEN AS YOU CLOSE IN", tone: "text-primary" },
  locked: { label: "TARGET LOCKED — GRAB IT", tone: "text-primary" },
};

// Camera-based audio homing for the item locator. Beeps (and buzzes, where
// supported) accelerate as the target barcode grows in the camera frame.
export default function BeepSeekScanner({ target, onClose }) {
  const videoRef = useRef(null);
  const seekerRef = useRef(null);
  const [phase, setPhase] = useState("starting"); // starting | scanning | unsupported | error
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("searching");
  const [proximity, setProximity] = useState(0);
  const [seenCode, setSeenCode] = useState("");
  const [audioOn, setAudioOn] = useState(true);

  // Keyed on the joined code string so a re-rendered target array (new
  // identity, same codes) does not restart the camera effect.
  const codeKey = (target?.codes || []).join("|");
  const targetCodes = useMemo(
    () => new Set(codeKey.split("|").map(normalizeCode).filter(Boolean)),
    [codeKey],
  );

  // Audio + vibration engine. The AudioContext starts suspended until the
  // first user gesture resumes it (browser autoplay policy).
  useEffect(() => {
    const seeker = createBeepSeeker();
    seekerRef.current = seeker;
    seeker.start();
    const resume = () => seeker.resume();
    window.addEventListener("pointerdown", resume);
    return () => {
      window.removeEventListener("pointerdown", resume);
      seeker.stop();
      seekerRef.current = null;
    };
  }, []);

  useEffect(() => {
    seekerRef.current?.setMuted(!audioOn);
  }, [audioOn]);

  const handleDetections = useCallback(
    (codes) => {
      const frameHeight = videoRef.current?.videoHeight || 1;
      let bestMatch = null;
      let bestOther = null;
      for (const code of codes) {
        const value = normalizeCode(code.rawValue);
        if (!value) continue;
        const fraction = Math.max(0, Math.min(1, (code.boundingBox?.height || 0) / frameHeight));
        if (targetCodes.has(value)) {
          if (!bestMatch || fraction > bestMatch.fraction) bestMatch = { value, fraction };
        } else if (!bestOther || fraction > bestOther.fraction) {
          bestOther = { value, fraction };
        }
      }
      if (bestMatch) {
        const prox = Math.max(0, Math.min(1, (bestMatch.fraction - FAR_FRACTION) / (NEAR_FRACTION - FAR_FRACTION)));
        setProximity(prox);
        setSeenCode(bestMatch.value);
        setStatus(bestMatch.fraction >= LOCK_FRACTION ? "locked" : "target");
        seekerRef.current?.setProximity({ proximity: prox, onTarget: true });
        return;
      }
      setProximity(0);
      seekerRef.current?.setProximity({ proximity: 0, onTarget: false });
      if (bestOther) {
        setSeenCode(bestOther.value);
        setStatus("wrong");
      } else {
        setSeenCode("");
        setStatus("searching");
      }
    },
    [targetCodes],
  );

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let timer = null;
    (async () => {
      if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
        setPhase("unsupported");
        return;
      }
      let media;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e) {
        setPhase("error");
        setMessage(e?.message || "Camera access was denied.");
        return;
      }
      if (stopped) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = media;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* surfaces once visible */
      }
      let detector = null;
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        detector = new window.BarcodeDetector({ formats: DETECT_FORMATS.filter((f) => supported.includes(f)) });
      } catch {
        try {
          detector = new window.BarcodeDetector();
        } catch {
          setPhase("unsupported");
          return;
        }
      }
      setPhase("scanning");
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            if (!stopped) handleDetections(codes);
          } catch {
            /* transient decode errors are non-fatal */
          }
        }
        timer = setTimeout(tick, 130);
      };
      tick();
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [handleDetections]);

  const meta = STATUS_META[status];

  return (
    <div className="fixed inset-0 z-[90] bg-black" role="dialog" aria-label="Beep Seek audio homing">
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/5 to-black/90" />

      {phase !== "scanning" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
          <div className="lokin-card max-w-sm p-5 text-center">
            <Volume2 className="mx-auto h-7 w-7 text-primary" />
            <div className="mt-2 text-sm font-bold text-white">
              {phase === "starting" ? "Starting camera…" : phase === "error" ? "Camera unavailable" : "Barcode detection unsupported"}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-white/45">
              {phase === "error"
                ? message
                : phase === "unsupported"
                  ? "This browser doesn't expose barcode detection (Android Chrome does). Use the aisle and store map to reach the item."
                  : "Allow camera access to start audio homing."}
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="lokin-card min-w-0 max-w-[70%] px-3 py-2 backdrop-blur">
          <div className="lokin-kicker lokin-kicker-lime">BEEP SEEK · TARGET</div>
          <div className="mt-0.5 truncate text-sm font-bold text-white">{target?.name || "Target item"}</div>
          <div className="truncate text-[10px] text-white/45">{target?.codes?.filter(Boolean).join(" · ") || "no target code"}</div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button type="button" aria-label={audioOn ? "Mute beeps" : "Unmute beeps"} onClick={() => setAudioOn((v) => !v)} className="lk-icon-btn h-11 w-11">
            {audioOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button type="button" aria-label="Close Beep Seek" onClick={onClose} className="lk-icon-dismiss h-11 w-11">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="lokin-card p-4 backdrop-blur">
          <div className={`text-[11px] font-bold tracking-[0.14em] ${meta.tone}`}>{meta.label}</div>
          <div className="lokin-progress-track mt-2 h-2.5">
            <div className={`lokin-progress-fill ${status === "locked" ? "glow-primary" : ""}`} style={{ width: `${Math.round(proximity * 100)}%`, transition: "width 180ms linear" }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-white/45">
            <span className="min-w-0 truncate">{seenCode ? `SEEING ${seenCode}` : "NO CODE IN VIEW"}</span>
            <span className="shrink-0 font-bold text-primary/80">{Math.round(proximity * 100)}%</span>
          </div>
          <div className="mt-2 text-[10px] leading-relaxed text-white/35">Sweep the shelf with your camera. The beep quickens as the target barcode fills the frame; a continuous chirp means you're on it. Wrong codes stay silent.</div>
        </div>
      </div>
    </div>
  );
}