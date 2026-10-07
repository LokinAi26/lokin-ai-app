import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Flame, Radar } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Daily-scan spotlight: surfaces the top verified, high-paying opportunities
// the morning auto-scan found, so a good run is never missed. Only LIVE
// records inside their freshness window are shown — nothing invented, nothing
// expired, and pay comes only from the published listing (VERIFIED source).
const TOP_COUNT = 3;
const CATEGORY_LABELS = {
  gig_app: "Gig app", w2_driver: "W-2 driver", courier_1099: "Courier",
  medical_courier: "Medical courier", package_courier: "Package courier",
  cannabis_delivery: "Cannabis delivery", alcohol_delivery: "Alcohol delivery",
  warehouse: "Warehouse", other: "Other",
  mystery_shop: "Mystery shop", food_review: "Food review",
  product_test: "Product test", paid_research: "Paid research", survey: "Survey",
};

function payLine(o) {
  const amount = Number(o.pay_amount) || 0;
  if (o.pay) return o.pay;
  if (amount > 0) return `$${amount}${o.pay_basis === "hourly" ? "/hr" : ""}`;
  return "Pay not listed";
}

export default function TopPaysSpotlight() {
  const [tops, setTops] = useState(null); // null = loading, [] = none fresh

  useEffect(() => {
    let alive = true;
    base44.entities.OpportunityScan.filter({ live_status: "live" }, "-created_date", 100)
      .then((recs) => {
        if (!alive) return;
        const now = Date.now();
        const fresh = recs
          .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
          .sort((a, b) => (Number(b.pay_amount) || 0) - (Number(a.pay_amount) || 0))
          .slice(0, TOP_COUNT);
        setTops(fresh);
      })
      .catch(() => { if (alive) setTops([]); });
    return () => { alive = false; };
  }, []);

  if (tops === null) {
    return (
      <div className="lokin-card p-4 relative z-10">
        <div className="h-3 w-28 rounded bg-white/10 animate-pulse" />
        <div className="mt-3 space-y-2">
          <div className="h-9 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-9 rounded-lg bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="lokin-card relative z-10 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          <Flame className="h-3.5 w-3.5" /> High-pay watch
        </span>
        <Link to="/opportunities" className="lk-link !text-[10px] !px-1">See all</Link>
      </div>

      {tops.length === 0 ? (
        <div className="px-4 pb-4">
          <div className="text-[11px] text-white/45 leading-snug">
            No verified high-pay runs in today&apos;s scan window. The next auto-scan fires at 7:00 AM — or browse the full hub anytime.
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3.5 space-y-1.5">
          {tops.map((o) => (
            <a
              key={o.id}
              href={o.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.05] px-3 py-2.5 active:scale-[0.99] transition-transform"
            >
              <div className="shrink-0 text-right">
                <div className="font-display text-lg font-black leading-none text-primary text-glow">{payLine(o)}</div>
                <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">Verified</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white/90 truncate">{o.title}</div>
                <div className="text-[10px] text-white/45 truncate">
                  {o.company}{o.location ? ` · ${o.location}` : ""}
                  {CATEGORY_LABELS[o.category] ? ` · ${CATEGORY_LABELS[o.category]}` : ""}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            </a>
          ))}
          <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/30">
            <Radar className="h-3 w-3" /> Auto-scan ran today · expired listings are hidden
          </div>
        </div>
      )}
    </div>
  );
}