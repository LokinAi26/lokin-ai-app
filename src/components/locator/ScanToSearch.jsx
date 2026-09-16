import { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";

const DETECT_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

// Camera overlay that reads one barcode and hands it back for item search.
// Closes itself on the first detection.
export default function ScanToSearch({ onCode, onClose }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState("starting"); // starting | scanning | unsupported | error
  const [message, setMessage] = useState("");

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
            const value = codes?.[0]?.rawValue ? String(codes[0].rawValue).trim() : "";
            if (!stopped && value) {
              stopped = true;
              if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(20);
              onCode(value);
              return;
            }
          } catch {
            /* transient decode errors are non-fatal */
          }
        }
        timer = setTimeout(tick, 150);
      };
      tick();
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-[90] bg-black" role="dialog" aria-label="Scan barcode to search">
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/10 to-black/90" />

      {phase !== "scanning" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
          <div className="lokin-card max-w-sm p-5 text-center">
            <ScanLine className="mx-auto h-7 w-7 text-primary" />
            <div className="mt-2 text-sm font-bold text-white">
              {phase === "starting" ? "Starting camera…" : phase === "error" ? "Camera unavailable" : "Barcode detection unsupported"}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-white/45">
              {phase === "error"
                ? message
                : phase === "unsupported"
                  ? "This browser doesn't expose barcode detection (Android Chrome does). Type the code instead."
                  : "Allow camera access to scan."}
            </div>
          </div>
        </div>
      )}

      {phase === "scanning" && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-40 w-64 rounded-2xl border-2 border-primary/70 shadow-[0_0_24px_rgba(124,252,30,.35)]">
            <span className="absolute -left-[2px] -top-[2px] h-7 w-7 rounded-tl-2xl border-l-4 border-t-4 border-primary" />
            <span className="absolute -right-[2px] -top-[2px] h-7 w-7 rounded-tr-2xl border-r-4 border-t-4 border-primary" />
            <span className="absolute -bottom-[2px] -left-[2px] h-7 w-7 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
            <span className="absolute -bottom-[2px] -right-[2px] h-7 w-7 rounded-br-2xl border-b-4 border-r-4 border-primary" />
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="lokin-card px-3 py-2 backdrop-blur">
          <div className="lokin-kicker lokin-kicker-lime">SCAN TO SEARCH</div>
          <div className="mt-0.5 text-sm font-bold text-white">Point at any barcode</div>
        </div>
        <button type="button" aria-label="Close scanner" onClick={onClose} className="lk-icon-dismiss h-11 w-11">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="lokin-card p-4 backdrop-blur text-center">
          <div className="text-[11px] font-bold tracking-[0.14em] text-primary">LOKIN READS THE CODE AND FINDS THE SHELF</div>
          <div className="mt-1 text-[10px] leading-relaxed text-white/35">Hold steady inside the frame. The scan closes itself and runs the item search.</div>
        </div>
      </div>
    </div>
  );
}