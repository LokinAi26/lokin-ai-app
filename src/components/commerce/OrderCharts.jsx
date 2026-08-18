import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Package, Truck } from "lucide-react";
import { money } from "./format";

export default function OrderCharts({ orders, currency }) {
  const byDay = {};
  orders.forEach((o) => {
    const d = String(o.created_at || "").slice(0, 10);
    if (d) byDay[d] = (byDay[d] || 0) + Number(o.total_price || 0);
  });
  const today = new Date();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(today.getTime() - i * 86400000);
    const k = dt.toISOString().slice(0, 10);
    days.push({ date: k, label: k.slice(5), revenue: Number((byDay[k] || 0).toFixed(2)) });
  }
  const total = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);
  const aov = orders.length ? total / orders.length : 0;
  const ff = {
    fulfilled: orders.filter((o) => o.fulfillment_status === "fulfilled").length,
    partial: orders.filter((o) => o.fulfillment_status === "partial").length,
    unfulfilled: orders.filter((o) => !o.fulfillment_status || o.fulfillment_status === "null").length,
  };
  const pie = [
    { name: "Fulfilled", value: ff.fulfilled, color: "hsl(80 100% 50%)" },
    { name: "Partial", value: ff.partial, color: "hsl(43 74% 66%)" },
    { name: "Unfulfilled", value: ff.unfulfilled, color: "hsl(0 84% 60%)" },
  ].filter((d) => d.value > 0);

  return (
    <section className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-white/55 font-display">
        <TrendingUp className="h-3.5 w-3.5" /> REVENUE & FULFILLMENT · CONFIRMED
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="ORDER VALUE" value={money(total, currency)} icon={TrendingUp} />
        <Stat label="ORDERS" value={String(orders.length)} icon={Package} />
        <Stat label="AOV" value={money(aov, currency)} icon={Truck} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="text-[9px] tracking-widest text-white/35 mb-2">REVENUE · LAST 14 DAYS</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(0 0% 100% / 0.4)" }} interval={1} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(0 0% 100% / 0.4)" }} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "hsl(240 6% 5%)", border: "1px solid hsl(80 100% 50% / 0.3)", borderRadius: 12, fontSize: 11 }}
                  formatter={(v) => money(v, currency)}
                />
                <Bar dataKey="revenue" fill="hsl(80 100% 50%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="text-[9px] tracking-widest text-white/35 mb-2">FULFILLMENT</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={36} outerRadius={56} paddingAngle={2}>
                  {pie.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(240 6% 5%)", border: "1px solid hsl(80 100% 50% / 0.3)", borderRadius: 12, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {pie.map((d, i) => (
              <span key={i} className="text-[9px] text-white/50 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
      <Icon className="h-4 w-4 text-accent" />
      <div className="mt-2 text-[9px] tracking-[.14em] text-white/30">{label}</div>
      <div className="mt-0.5 text-sm font-black text-white">{value}</div>
    </div>
  );
}