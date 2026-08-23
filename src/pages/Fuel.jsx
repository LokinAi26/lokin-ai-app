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
    const payload = {
      station: newStation,
      gallons: g,
      total_paid: t,
      cashback_earned: 0,
      purchased_on: new Date().toISOString().slice(0, 10),
    };
    const tempId = `tmp_${Date.now()}`;
    // optimistic insert
    setPurchases([{ ...payload, id: tempId }, ...purchases]);
    setNewGallons(""); setNewTotal(""); setNewStation("");
    try {
      const created = await base44.entities.FuelPurchase.create(payload);
      setPurchases((cur) => cur.map((p) => (p.id === tempId ? created : p)));
    } catch (e) {
      // revert
      setPurchases((cur) => cur.filter((p) => p.id !== tempId));
    }
  }

  const totalFuelSpend = purchases.reduce((s, p) => s + Number(p.total_paid || 0), 0);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-2">
        <FuelIcon className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Fuel Tracker & Deals</h1>
      </div>

      <div className="rounded-3xl border border-primary/40 bg-primary/[0.08] p-5 glow-border radial-fade">
        <div className="text-[11px] uppercase tracking-[0.18em] text-primary/80">Fuel spend tracked</div>
        <div className="text-4xl font-bold font-display text-primary text-glow mt-1">${totalFuelSpend.toFixed(2)}</div>
        <div className="text-xs text-white/55 mt-1.5">Based on fill-ups you log in LOKIN · no automatic cashback is issued</div>
      </div>

      <div>
        <div className="text-sm font-semibold text-white/80 mb-2">Saved Fuel Deals</div>
        <div className="space-y-2">
          {deals.length === 0 && <div className="text-xs text-white/45 text-center py-3">No active deals.</div>}
          {deals.map((d) => {
            const net = (d.price_per_gallon - (d.discount_per_gallon || 0)).toFixed(2);
            return (
              <div key={d.id} className="rounded-2xl border border-white/10 lokin-panel p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-white">{d.station}</div>
                    <div className="text-xs text-white/45 flex items-center gap-1"><MapPin className="h-3 w-3" />{d.address} · {d.distance_miles ?? "?"}mi</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary text-glow">${net}/gal</div>
                    <div className="text-xs line-through text-white/35">${d.price_per_gallon.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {d.promo_code && (
                    <button
                      onClick={() => copy(d.promo_code)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-mono font-semibold text-white"
                    >
                      {copied === d.promo_code ? <Check className="h-3 w-3 text-primary" /> : <Tag className="h-3 w-3 text-primary" />}
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
        <div className="text-sm font-semibold text-white/80 mb-2">Log a Fill-up</div>
        <div className="grid grid-cols-3 gap-2">
          <input value={newStation} onChange={(e) => setNewStation(e.target.value)} placeholder="Station" className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-white placeholder:text-white/30" />
          <input value={newGallons} onChange={(e) => setNewGallons(e.target.value)} type="number" placeholder="Gallons" className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-white placeholder:text-white/30" />
          <input value={newTotal} onChange={(e) => setNewTotal(e.target.value)} type="number" placeholder="Total $" className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-white placeholder:text-white/30" />
        </div>
        <button onClick={logPurchase} disabled={!newStation || !newGallons || !newTotal} className="mt-2 w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-1.5 glow-primary">
          <Plus className="h-4 w-4" /> Log fill-up
        </button>
      </div>

      <div className="text-[10px] text-white/35 text-center">Fuel prices, promo codes, and cashback shown in saved deal records must be verified with the provider or station before purchase. LOKIN does not issue fuel rewards in this build.</div>

      {purchases.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-white/80 mb-2">Recent Fill-ups</div>
          <div className="space-y-2">
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-white/10 lokin-panel p-3 text-sm">
                <div>
                  <div className="font-medium text-white">{p.station}</div>
                  <div className="text-xs text-white/45">{p.purchased_on} · {p.gallons} gal · ${p.total_paid}</div>
                </div>
                <div className="text-primary font-semibold text-sm">${Number(p.total_paid || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}