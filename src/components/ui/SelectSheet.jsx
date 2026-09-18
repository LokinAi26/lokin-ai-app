import { useEffect, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Mobile-native replacement for HTML <select>: a tappable field that opens a
// bottom sheet with large 52px rows. Options: [{ value, label }] or strings.
export default function SelectSheet({ value, onChange, options, placeholder = "Select…", label, className = "" }) {
  const [open, setOpen] = useState(false);
  const opts = (options || []).map((o) => (typeof o === "object" ? o : { value: o, label: String(o) }));
  const current = opts.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function pick(v) {
    setOpen(false);
    if (String(v) !== String(value)) onChange(v);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("w-full min-h-11 flex items-center justify-between gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2.5 text-sm text-left text-white", className)}
      >
        <span className={current ? "" : "text-white/40"}>{current ? current.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/55" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-3xl border-t border-primary/30 bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[76vh] overflow-y-auto no-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-white">{label || placeholder}</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-white/10">
                <X className="h-4 w-4 text-white/60" />
              </button>
            </div>
            <div className="space-y-1.5">
              {opts.map((o) => {
                const on = String(o.value) === String(value);
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={`w-full min-h-[52px] flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm ${on ? "border-primary bg-primary/15 text-primary font-semibold" : "border-white/10 bg-white/[0.03] text-white/80"}`}
                  >
                    <span className="min-w-0 flex-1">{o.label}</span>
                    {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}