import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

// Promise-based in-app replacement for window.confirm. Resolves true on confirm, false on dismiss.
export function useOasisConfirm() {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setRequest(options);
  }), []);

  const settle = useCallback((value) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  useEffect(() => () => resolverRef.current?.(false), []);

  const sheet = request ? <OasisConfirmSheet {...request} onSettle={settle} /> : null;
  return { confirm, sheet };
}

function OasisConfirmSheet({ title, body, confirmLabel = "Confirm", tone = "primary", onSettle }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onSettle(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSettle]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/75 backdrop-blur-sm" onClick={() => onSettle(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="oasis-confirm-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full rounded-t-3xl border-t border-primary/25 bg-[#080a0c] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </span>
              <h2 id="oasis-confirm-title" className="text-base font-bold leading-snug text-white">{title}</h2>
            </div>
            <button type="button" aria-label="Close" onClick={() => onSettle(false)} className="min-h-[44px] min-w-[44px] rounded-full p-2 text-white/55">
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
          {body && <p className="mt-3 text-xs leading-relaxed text-white/55">{body}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onSettle(false)} className="min-h-[44px] rounded-xl border border-white/10 py-3 text-sm font-bold text-white/70">
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={() => onSettle(true)}
              className={`min-h-[44px] rounded-xl py-3 text-sm font-black ${tone === "danger" ? "bg-red-500 text-white" : "bg-primary text-black"}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
