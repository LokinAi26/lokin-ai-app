import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, Loader2, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { estimateNet } from "@/lib/opportunityEstimates";

export default function OpportunityCompare({ open, onClose, opps, prefs, autoRecommend }) {
  const [loading, setLoading] = useState(false);
  const [rec, setRec] = useState(null);

  const rows = opps.map((o) => ({ o, est: estimateNet(o, prefs) }));

  async function recommend() {
    setLoading(true);
    setRec(null);
    try {
      const goals = {
        min_per_hour: prefs.min_per_hour,
        weekly_goal: prefs.weekly_goal,
        vehicle_type: prefs.user_type === "trucker" ? "box_truck" : "personal_car",
        user_type: prefs.user_type,
        max_miles: prefs.max_miles,
      };
      const res = await base44.functions.invoke("opportunity-recommend", {
        opportunity_ids: opps.map((o) => o.id),
        goals,
      });
      setRec(res.data || res);
    } catch (e) {
      setRec({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  // auto-run when opened in recommend mode
  useEffect(() => {
    if (open && autoRecommend && !loading && !rec && opps.length) {
      recommend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoRecommend, opps.length]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl border-t border-primary/30 glass pb-[env(safe-area-inset-bottom)] max-h-[82dvh] flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold font-heading metal-text">{autoRecommend ? "AI Recommendation" : "Compare Opportunities"}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-white/50 active:scale-90 transition-transform"><X className="h-5 w-5" /></button>
      </div>

      <div className="overflow-y-auto px-4 py-3 space-y-3">
        {opps.length === 0 ? (
          <div className="text-sm text-white/45 text-center py-8">Select opportunities to compare, or run a recommendation on the filtered list.</div>
        ) : (
          <div className="space-y-2">
            {rows.map(({ o, est }, i) => (
              <div key={o.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{o.title}</div>
                    <div className="text-[10px] text-white/40 truncate">{o.platform || o.company}</div>
                  </div>
                  <span className="text-xs font-bold text-primary">${est.netPerHour}/hr net</span>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1 text-center text-[10px]">
                  <div><div className="text-white/35">Gross/wk</div><div className="text-white/80 font-semibold">${est.gross}</div></div>
                  <div><div className="text-white/35">Miles/wk</div><div className="text-white/80 font-semibold">{est.miles}</div></div>
                  <div><div className="text-white/35">Vehicle</div><div className="text-destructive/80 font-semibold">-${est.vehicleCost}</div></div>
                  <div><div className="text-white/35">Net/wk</div><div className="text-primary font-semibold">${est.net}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={recommend}
          disabled={loading || opps.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-bold glow-primary active:scale-[0.98] disabled:opacity-50 transition-transform"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : <><Sparkles className="h-4 w-4" />Get AI recommendation</>}
        </button>

        {rec && (
          <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3 space-y-2">
            {rec.error ? (
              <div className="text-xs text-destructive">{rec.error}</div>
            ) : (
              <>
                <div className="text-[10px] tracking-[0.18em] text-primary font-display">LOKIN ADVISOR</div>
                <p className="text-sm text-white/85 leading-relaxed">{rec.recommendation}</p>
                {Array.isArray(rec.alternatives) && rec.alternatives.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {rec.alternatives.map((a, i) => (
                      <div key={i} className="text-[11px] text-white/55">
                        <span className="text-primary font-semibold">#{a.index}</span> {a.reason}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-white/35 pt-1">Pay figures are advertised or estimated and never guaranteed.</p>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}