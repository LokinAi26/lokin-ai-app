import { Brain, TrendingUp, Users, AlertTriangle, Boxes, Sparkles, Lightbulb } from "lucide-react";
import { money } from "./format";

export default function AIPredictions({ predictions, currency }) {
  if (!predictions) return null;
  const p = predictions;
  const ai = p.provider === "openai";

  return (
    <section className="rounded-3xl border border-primary/20 lokin-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.24em] text-primary/80 font-display">
          <Brain className="h-3.5 w-3.5" /> PREDICTIVE INTELLIGENCE · AI
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${ai ? "bg-primary/15 text-primary" : "bg-white/10 text-white/40"}`}>
          {ai ? "OPENAI POWERED" : "LOCAL HEURISTIC"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Card icon={TrendingUp} label="REVENUE · NEXT 7 DAYS" value={money(p.revenue_forecast?.next_7_days, currency)} sub={`confidence: ${p.revenue_forecast?.confidence || "low"}`} />
        <Card icon={TrendingUp} label="REVENUE · NEXT 30 DAYS" value={money(p.revenue_forecast?.next_30_days, currency)} sub={`trend: ${p.revenue_forecast?.trend || "—"}`} />
        <Card icon={Users} label="AVG CUSTOMER LTV" value={money(p.customer_lifetime_value?.average_ltv, currency)} sub={`repeat rate: ${Math.round((p.customer_lifetime_value?.repeat_rate || 0) * 100)}%`} />
      </div>

      <Row title="REPEAT-PURCHASE INSIGHT · AI" icon={Users}>
        <p className="text-xs text-white/65">{p.repeat_purchase_insights}</p>
      </Row>

      {p.demand_forecast?.length > 0 && (
        <Row title="DEMAND FORECAST · AI" icon={Boxes}>
          <div className="space-y-1">
            {p.demand_forecast.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-white/70 truncate">{d.product}</span>
                <span className="text-white/50">{d.predicted_units} units · {d.trend}</span>
              </div>
            ))}
          </div>
        </Row>
      )}

      {p.order_risk_anomalies?.length > 0 && (
        <Row title="ORDER RISK / ANOMALIES · AI" icon={AlertTriangle}>
          <div className="space-y-1.5">
            {p.order_risk_anomalies.map((r, i) => (
              <div key={i} className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-2">
                <div className="text-xs font-bold text-red-300">{r.order} · {r.risk_type}</div>
                <div className="text-[10px] text-white/55">{r.detail}</div>
              </div>
            ))}
          </div>
        </Row>
      )}

      {p.inventory_demand_predictions?.length > 0 && (
        <Row title="INVENTORY DEMAND · AI" icon={Boxes}>
          <div className="space-y-1">
            {p.inventory_demand_predictions.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs gap-2">
                <span className="text-white/70 truncate">{d.product}</span>
                <span className="text-[10px] text-white/50 text-right">{d.status} — {d.recommendation}</span>
              </div>
            ))}
          </div>
        </Row>
      )}

      {p.recommended_actions?.length > 0 && (
        <Row title="RECOMMENDED ACTIONS · AI" icon={Lightbulb}>
          <div className="space-y-1.5">
            {p.recommended_actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-2">
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${a.priority === "high" ? "bg-red-500/20 text-red-300" : a.priority === "medium" ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/50"}`}>
                  {a.priority}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-white">{a.action}</div>
                  <div className="text-[9px] text-white/40">{a.expected_impact}</div>
                </div>
              </div>
            ))}
          </div>
        </Row>
      )}

      {p.insights?.length > 0 && (
        <Row title="INSIGHTS · AI" icon={Sparkles}>
          <div className="space-y-1.5">
            {p.insights.map((it, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-2">
                <div className="text-xs font-bold text-white">{it.title}</div>
                <div className="text-[10px] text-white/55">{it.detail}</div>
              </div>
            ))}
          </div>
        </Row>
      )}
    </section>
  );
}

function Card({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-[8px] tracking-widest text-white/30">{label}</div>
      <div className="text-sm font-black text-white">{value}</div>
      <div className="text-[8px] text-white/35">{sub}</div>
    </div>
  );
}

function Row({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[9px] tracking-widest text-white/40">
        <Icon className="h-3 w-3" /> {title}
      </div>
      {children}
    </div>
  );
}