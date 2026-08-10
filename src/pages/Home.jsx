import { useState } from "react";
import { Link } from "react-router-dom";
import { Route, SlidersHorizontal, ScanLine, Fuel, TrendingUp, Ban } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PartnerApps from "@/components/PartnerApps";
import EarningsDashboard from "@/components/EarningsDashboard";

const CARDS = [
  { to: "/route", icon: Route, title: "AI Route Optimizer", desc: "Sequenced by zip & address for max $/hr", color: "bg-blue-500/10 text-blue-500" },
  { to: "/categories", icon: SlidersHorizontal, title: "Category Taps", desc: "Choose delivery types & block customers", color: "bg-emerald-500/10 text-emerald-500" },
  { to: "/locator", icon: ScanLine, title: "Item Locator", desc: "Scan barcode — beep intensifies as you near", color: "bg-amber-500/10 text-amber-500" },
  { to: "/fuel", icon: Fuel, title: "Gas Discounts", desc: "Weekly codes & pay-at-pump cashback", color: "bg-rose-500/10 text-rose-500" },
];

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function runStrategy() {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("optimizeRoute", {});
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading">Driver Copilot</h1>
        <p className="text-sm text-muted-foreground">AI route planning to maximize time & earnings.</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-5">
        <div className="flex items-center gap-2 text-sm/none opacity-90 mb-1">
          <TrendingUp className="h-4 w-4" /> Today&apos;s AI Strategy
        </div>
        <p className="text-sm opacity-90 mb-3">
          Tap to generate your optimized delivery order, sequenced by zip code to cut drive time.
        </p>
        <button
          onClick={runStrategy}
          disabled={busy}
          className="w-full rounded-lg bg-primary-foreground text-primary text-sm font-semibold py-2.5 disabled:opacity-60"
        >
          {busy ? "Planning route…" : "Generate AI Strategy"}
        </button>
        {result?.stats && (
          <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
            <div><div className="font-bold">{result.stats.stops}</div><div className="opacity-70">stops</div></div>
            <div><div className="font-bold">{result.stats.miles}</div><div className="opacity-70">miles</div></div>
            <div><div className="font-bold">${result.stats.net}</div><div className="opacity-70">net</div></div>
            <div><div className="font-bold">${result.stats.perHour}/h</div><div className="opacity-70">rate</div></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-2xl border border-border bg-card p-4 active:scale-[0.98] transition-transform"
          >
            <div className={`inline-flex p-2 rounded-xl ${c.color} mb-2`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="font-semibold text-sm">{c.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
          </Link>
        ))}
      </div>

      <EarningsDashboard />

      <Link to="/categories" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Ban className="h-4 w-4" /> Manage blocked customers
      </Link>

      <PartnerApps />
    </div>
  );
}