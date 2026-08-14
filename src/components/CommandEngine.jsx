// LOKIN Interface Engine — unified command palette.
// Opened from the LOKIN logo. Searches every action in the registry and routes it.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LokinGlyph } from "@/components/Brand";
import { searchCommands, ALL_COMMANDS } from "@/lib/commandEngine";

export default function CommandEngine({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => searchCommands(query), [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === "Enter" && results[active]) { run(results[active]); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active]);

  function run(cmd) {
    onClose();
    cmd.run(navigate);
  }

  // Group results preserving registry order.
  const grouped = useMemo(() => {
    const map = new Map();
    results.forEach((c) => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group).push(c);
    });
    return Array.from(map.entries());
  }, [results]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[calc(env(safe-area-inset-top)+2.5rem)] px-3"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md rounded-3xl border border-primary/30 glass glow-primary overflow-hidden"
            initial={{ y: -16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header / search */}
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
              <LokinGlyph size={22} className="lokin-pulse" />
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/60 pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Run any command… (route, fuel, voice)"
                  className="w-full rounded-xl bg-white/[0.03] border border-white/10 pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-primary/50"
                />
              </div>
              <button onClick={() => { onClose(); navigate("/lokin"); }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/40 bg-accent/10 text-accent glow-cyan active:scale-95 transition-transform"
                aria-label="LOKIN voice">
                <Mic className="h-4 w-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto no-scrollbar p-2">
              {grouped.length === 0 && (
                <div className="text-center text-sm text-white/40 py-8">No commands match "{query}"</div>
              )}
              {grouped.map(([group, cmds]) => (
                <div key={group} className="mb-1">
                  <div className="px-2 pt-2 pb-1 text-[10px] tracking-[0.2em] text-white/35 font-display">{group.toUpperCase()}</div>
                  {cmds.map((c) => {
                    flatIndex += 1;
                    const isActive = flatIndex === active;
                    return (
                      <button
                        key={c.id}
                        onMouseEnter={() => setActive(flatIndex)}
                        onClick={() => run(c)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${isActive ? "bg-primary/15 border border-primary/40" : "border border-transparent"}`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-primary/20 text-primary" : "bg-white/[0.04] text-white/55"}`}>
                          <c.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold truncate ${isActive ? "text-white" : "text-white/85"}`}>{c.title}</div>
                          <div className="text-[11px] text-white/40 truncate">{c.subtitle}</div>
                        </div>
                        {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-primary/70" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] text-white/35">
              <span className="tracking-wide">↑↓ navigate · ⏎ run · esc close</span>
              <span className="text-primary/60">{results.length}/{ALL_COMMANDS.length} commands</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}