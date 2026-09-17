import { useEffect, useState } from "react";
import { Fuel as FuelIcon, ChevronDown, ChevronUp, Copy, Check, Percent, Tag, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Small floating overlay for the navigation map: highlights the best fuel
// prices nearby (saved FuelDeal records) and a quick button that reveals
// each station's cashback % and promo codes for the route.
const NEARBY_MI = 15;
const TOP_N = 3;

function netPrice(d) {
  return Number(d.price_per_gallon || 0) - Number(d.discount_per_gallon || 0);
}

export default function FuelDealsOverlay({ fullscreen = false }) {
  const [deals, setDeals] = useState(null);
  const [open, setOpen] = useState(false);
  const [showPerks, setShowPerks] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let on = true;
    base44.entities.FuelDeal.filter({}, "price_per_gallon")
      .then((rows) => {
        if (!on) return;
        const today = new Date().toISOString().slice(0, 10);
        setDeals(
          rows
            .filter((d) => !d.expires_on || d.expires_on >= today)
            .filter((d) => d.distance_miles == null || d.distance_miles <= NEARBY_MI)
            .sort((a, b) => netPrice(a) - netPrice(b))
            .slice(0, TOP_N)
        );
      })
      .catch(() => {
        if (on) setDeals([]);
      });
    return () => {
      on = false;
    };
  }, []);

  if (!deals || deals.length === 0) return null;

  const bestNet = netPrice(deals[0]);
  const hasPerks = deals.some((d) => d.promo_code || (d.cashback_percent || 0) > 0);

  function copy(code) {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div
      className={`absolute left-3 z-30 w-[min(17rem,62vw)] ${fullscreen ? "bottom-[calc(4.7rem+env(safe-area-inset-bottom))]" : "bottom-20"}`}
    >
      {open && (
        <div className="lokin-card mb-2 overflow-hidden p-2.5 backdrop-blur">
          <div className="lokin-kicker lokin-kicker-lime mb-1.5">BEST FUEL PRICES NEARBY</div>
          <div className="space-y-1.5">
            {deals.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-white">{d.station}</div>
                    <div className="text-[9px] text-white/40">
                      {d.distance_miles != null ? `${d.distance_miles} mi` : "nearby"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-bold text-primary text-glow">${netPrice(d).toFixed(2)}/gal</div>
                    {(d.discount_per_gallon || 0) > 0 && (
                      <div className="text-[9px] text-white/35 line-through">${Number(d.price_per_gallon).toFixed(2)}</div>
                    )}
                  </div>
                </div>
                {showPerks && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-1.5">
                    {(d.cashback_percent || 0) > 0 && (
                      <span className="flex items-center gap-1 text-[9px] font-semibold text-primary">
                        <Percent className="h-2.5 w-2.5" />{d.cashback_percent}% cashback
                      </span>
                    )}
                    {d.promo_code && (
                      <button
                        onClick={() => copy(d.promo_code)}
                        className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[9px] font-mono font-semibold text-white active:scale-95"
                      >
                        {copied === d.promo_code ? <Check className="h-2.5 w-2.5 text-primary" /> : <Tag className="h-2.5 w-2.5 text-primary" />}
                        {d.promo_code}
                        <Copy className="h-2.5 w-2.5 text-white/35" />
                      </button>
                    )}
                    {!d.promo_code && !(d.cashback_percent > 0) && (
                      <span className="text-[9px] text-white/35">No cashback or code on record</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowPerks((v) => !v)}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-2 py-2 text-[9px] font-bold tracking-[0.1em] text-primary active:scale-[0.98]"
          >
            <Zap className="h-3 w-3" />
            {showPerks ? "HIDE" : "SHOW"} CASHBACK &amp; CODES FOR MY ROUTE
          </button>
          {showPerks && !hasPerks && (
            <div className="mt-1 text-center text-[8px] text-white/30">No cashback or promo codes saved on these deals yet.</div>
          )}
          <div className="mt-1.5 text-center text-[8px] text-white/30">
            Saved deal prices — verify with the station before purchase.
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/40 bg-black/85 px-3 py-2 text-[10px] font-bold tracking-[0.08em] text-primary shadow-lg backdrop-blur active:scale-95"
      >
        <FuelIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">${bestNet.toFixed(2)}/GAL · BEST FUEL NEARBY</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronUp className="h-3.5 w-3.5 shrink-0" />}
      </button>
    </div>
  );
}