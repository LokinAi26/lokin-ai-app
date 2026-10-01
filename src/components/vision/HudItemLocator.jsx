import { useCallback, useEffect, useRef, useState } from "react";
import { PackageSearch, Volume2, VolumeX, X } from "lucide-react";
import { createBeepSeeker } from "@/lib/locatorBeep";
import { speakLokin } from "@/lib/lokinVoicePipeline";

// HUD Item Locator — camera homing mode for the Vision HUD.
// Phase 1 (arming): point the camera at the RIGHT package's barcode once to
// set the target. Phase 2 (homing): LOKIN beeps — and the beeps quicken — as
// that same barcode grows in the frame (a real camera-proximity signal, never
// simulated distance). Wrong codes stay silent; the target lock gets a spoken
// confirmation. Engine: createBeepSeeker (same as the Locator page).
const DETECT_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];
const FAR_FRACTION = 0.045;
const NEAR_FRACTION = 0.55;
const LOCK_FRACTION = 0.5;

function normalizeCode(value) {
  return String(value || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export default function HudItemLocator({ onClose }) {
  const videoRef = useRef(null);
  const seekerRef = useRef(null);
  const phaseRef = useRef("idle"); // idle | arming | homing
  const targetRef = useRef("");
  const wasLockedRef = useRef(false);
  const [phase, setPhase] = useState("starting"); // starting | idle | arming | homing | unsupported | error
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("");
  const [proximity, setProximity] = useState(0);
  const [seenCode, setSeenCode] = useState("");
  const [audioOn, setAudioOn] = useState(true);

  // Beep engine. The AudioContext starts suspended until a user gesture
  // (the tap that opened this mode) resumes it.
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

  const onDetections = useCallback((codes) => {
    const video = videoRef.current;
    const frameHeight = video?.videoHeight || 1;
    let best = null;
    for (const code of codes) {
      const value = normalizeCode(code.rawValue);
      if (!value) continue;
      const fraction = Math.max(0, Math.min(1, (code.boundingBox?.height || 0) / frameHeight));
      if (!best || fraction > best.fraction) best = { value, fraction };
    }

    // Arming: the first code read after the tap becomes the target.
    if (phaseRef.current === "arming" && best) {
      phaseRef.current = "homing";
      targetRef.current = best.value;
      wasLockedRef.current = false;
      setTarget(best.value);
      setSeenCode(best.value);
      setPhase("homing");
      seekerRef.current?.setProximity({ proximity: best.fraction >= LOCK_FRACTION ? 1 : 0, onTarget: true });
      speakLokin("Target locked. Homing now.", { rate: 1.05 });
      return;
    }

    if (phaseRef.current === "homing") {
      const value = best?.value || "";
      setSeenCode(value);
      const onTarget = Boolean(value) && value === targetRef.current;
      if (onTarget) {
        const prox = Math.max(0, Math.min(1, (best.fraction - FAR_FRACTION) / (NEAR_FRACTION - FAR_FRACTION)));
        setProximity(prox);
        seekerRef.current?.setProximity({ proximity: prox, onTarget: true });
        if (best.fraction >= LOCK_FRACTION && !wasLockedRef.current) {
          wasLockedRef.current = true;
          speakLokin("You're on it.", { rate: 1.05 });
        } else if (best.fraction < LOCK_FRACTION) {
          wasLockedRef.current = false;
        }
      } else {
        setProximity(0);
        seekerRef.current?.setProximity({ proximity: 0, onTarget: false });
      }
    }
  }, []);

  function armTarget() {
    if (phase !== "idle" && phase !== "homing") return;
    phaseRef.current = "arming";
    setProximity(0);
    setTarget("");
    setPhase("arming");
    seekerRef.current?.setProximity({ proximity: 0, onTarget: false });
  }

  // Hands-free voice close ("Hey LOKIN, stop scanning") — no screen touch
  // needed to end the camera session.
  useEffect(() => {
    const onVoiceClose = () => onClose?.();
    window.addEventListener("lokin:close-item-locator", onVoiceClose);
    return () => window.removeEventListener("lokin:close-item-locator", onVoiceClose);
  }, [onClose]);

  // Camera + detection loop (continuous, ~7 reads/sec).
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
      setPhase("idle");
      phaseRef.current = "idle";
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            if (!stopped) onDetections(codes);
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
  }, [onDetections]);

  const statusLabel =
    phase === "arming"
      ? "SWEEPING — TAP TARGET TO LOCK IT"
      : phase === "homing"
        ? !seenCode
          ? "NO CODE IN VIEW"
          : seenCode === target
            ? proximity >= LOCK_FRACTION ? "TARGET LOCKED — GRAB IT" : "ON TARGET — CLOSING IN"
            : "WRONG CODE — KEEP SWEEPING"
        : "READY — SCAN THE RIGHT PACKAGE FIRST";

  return (
    <div className="fixed inset-0 z-[90] bg-black" role="dialog" aria-label="HUD item locator camera homing">
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/5 to-black/90" />

      {["starting", "unsupported", "error"].includes(phase) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
          <div className="lokin-card max-w-sm p-5 text-center">
            <PackageSearch className="mx-auto h-7 w-7 text-primary" />
            <div className="mt-2 text-sm font-bold text-white">
              {phase === "starting" ? "Starting camera…" : phase === "error" ? "Camera unavailable" : "Barcode detection unsupported"}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-white/45">
              {phase === "error"
                ? message
                : phase === "unsupported"
                  ? "This browser doesn't expose barcode detection (Android Chrome does). Use the aisle and shelf guidance instead."
                  : "Allow camera access to start camera homing."}
            </div>
          </div>
        </div>
      )}

      {["idle", "arming", "homing"].includes(phase) && (
        <>
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <div className="lokin-card min-w-0 max-w-[70%] px-3 py-2 backdrop-blur">
              <div className="lokin-kicker lokin-kicker-lime">HUD ITEM LOCATOR</div>
              <div className="mt-0.5 truncate text-sm font-bold text-white">{target ? `Target ${target}` : "No target set"}</div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button type="button" aria-label={audioOn ? "Mute beeps" : "Unmute beeps"} onClick={() => setAudioOn((v) => !v)} className="lk-icon-btn h-11 w-11">
                {audioOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>
              <button type="button" aria-label="Close item locator" onClick={onClose} className="lk-icon-dismiss h-11 w-11">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className={`relative h-40 w-64 rounded-2xl border-2 ${phase === "homing" && seenCode === target ? "border-primary shadow-[0_0_24px_rgba(124,252,30,.45)]" : "border-white/40"}`}>
              <span className="absolute -left-[2px] -top-[2px] h-7 w-7 rounded-tl-2xl border-l-4 border-t-4 border-primary" />
              <span className="absolute -right-[2px] -top-[2px] h-7 w-7 rounded-tr-2xl border-r-4 border-t-4 border-primary" />
              <span className="absolute -bottom-[2px] -left-[2px] h-7 w-7 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
              <span className="absolute -bottom-[2px] -right-[2px] h-7 w-7 rounded-br-2xl border-b-4 border-r-4 border-primary" />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="lokin-card p-4 backdrop-blur">
              <div className="text-[11px] font-bold tracking-[0.14em] text-primary">{statusLabel}</div>
              <div className="lokin-progress-track mt-2 h-2.5">
                <div className={`lokin-progress-fill ${proximity >= LOCK_FRACTION ? "glow-primary" : ""}`} style={{ width: `${Math.round(proximity * 100)}%`, transition: "width 180ms linear" }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-white/45">
                <span className="min-w-0 truncate">{seenCode ? `SEEING ${seenCode}` : "NO CODE IN VIEW"}</span>
                <span className="shrink-0 font-bold text-primary/80">{Math.round(proximity * 100)}%</span>
              </div>
              {phase === "homing" ? (
                <button type="button" onClick={armTarget} className="mt-3 w-full rounded-xl border border-white/15 bg-white/[0.05] py-2.5 text-xs font-bold text-white/80 active:scale-[0.98]">
                  CHANGE TARGET
                </button>
              ) : (
                <button type="button" onClick={armTarget} disabled={phase === "arming"} className="mt-3 w-full rounded-xl border border-primary/25 bg-primary/[0.06] py-2.5 text-xs font-bold text-primary disabled:opacity-40">
                  {phase === "arming" ? "SWEEPING FOR TARGET…" : "SCAN TARGET — TAP, THEN POINT AT THE PACKAGE"}
                </button>
              )}
              <div className="mt-2 text-[10px] leading-relaxed text-white/35">Step 1: tap the target button and point at the right package's barcode. Step 2: sweep the shelf — the beeps quicken as that code fills the frame, a continuous chirp means you're on it.</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}