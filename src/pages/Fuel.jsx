import { useEffect, useState } from "react";
import { Fuel as FuelIcon, Tag, Percent, MapPin, Plus, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Fuel() {
  const [deals, setDeals] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [copied, setCopied] = useState("");
  const [newGallons, setNewGallons] = useState("");
  const [newTotal, setNewTotal] = useState("");
  const [newStation, setNewStation] = useState("");

  async function load() {
    const [d, p] = await Promise.all([
      base44.entities.FuelDeal.filter({}, "price_per_gallon"),
      base44.entities.FuelPurchase.filter({}, "-purchased_on"),
    ]);
    setDeals(d);
    setPurchases(p);
  }
  useEffect(() => { load(); }, []);

  function copy(code) {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1500);
  }

  async function logPurchase() {
    if (!newGallons || !newTotal || !newStation) return;
    const g = parseFloat(newGallons);
    const t = parseFloat(newTotal);
    const cashback = Math.round(t * 0.03 * 100) / 100; // 3% pay-at-pump cashback demo
    const created = await base44.entities.FuelPurchase.create({
      station: newStation,
      gallons: g,
      total_paid: t,
      cashback_earned: cashback,
      purchased_on: new Date().toISOString().slice(0, 10),
    });
    setPurchases([created, ...purchases]);
    setNewGallons(""); setNewTotal(""); setNewStation("");
  }

  const totalCashback = purchases.reduce((s, p) => s + (p.cashback_earned || 0), 0);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-2">
        <FuelIcon className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading">Gas Discounts</h1>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground p-5 glow-primary">
        <div className="text-sm opacity-90">Total cashback earned</div>
        <div className="text-3xl font-bold">${totalCashback.toFixed(2)}</div>
        <div className="text-xs opacity-80 mt-1">Pay at the pump · 3% back on every fill-up</div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Weekly Discount Codes</div>
        <div className="space-y-2">
          {deals.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">No active deals.</div>}
          {deals.map((d) => {
            const net = (d.price_per_gallon - (d.discount_per_gallon || 0)).toFixed(2);
            return (
              <div key={d.id} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">{d.station}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{d.address} · {d.distance_miles ?? "?"}mi</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary">${net}/gal</div>
                    <div className="text-xs line-through text-muted-foreground">${d.price_per_gallon.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {d.promo_code && (
                    <button
                      onClick={() => copy(d.promo_code)}
                      className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-mono font-semibold"
                    >
                      {copied === d.promo_code ? <Check className="h-3 w-3 text-primary" /> : <Tag className="h-3 w-3" />}
                      {d.promo_code}
                    </button>
                  )}
                  {(d.cashback_percent || 0) > 0 && (
                    <span className="flex items-center gap-1 text-xs text-primary font-medium">
                      <Percent className="h-3 w-3" />{d.cashback_percent}% cashback
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Log a Fill-up</div>
        <div className="grid grid-cols-3 gap-2">
          <input value={newStation} onChange={(e) => setNewStation(e.target.value)} placeholder="Station" className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm" />
          <input value={newGallons} onChange={(e) => setNewGallons(e.target.value)} type="number" placeholder="Gallons" className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm" />
          <input value={newTotal} onChange={(e) => setNewTotal(e.target.value)} type="number" placeholder="Total $" className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm" />
        </div>
        <button onClick={logPurchase} disabled={!newStation || !newGallons || !newTotal} className="mt-2 w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1">
          <Plus className="h-4 w-4" /> Log & earn 3% cashback
        </button>
      </div>

      {purchases.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Recent Fill-ups</div>
          <div className="space-y-2">
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <div>
                  <div className="font-medium">{p.station}</div>
                  <div className="text-xs text-muted-foreground">{p.purchased_on} · {p.gallons} gal · ${p.total_paid}</div>
                </div>
                <div className="text-primary font-semibold text-sm">+${(p.cashback_earned || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}