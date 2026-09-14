import { useEffect, useState } from "react";
import { Receipt as ReceiptIcon, Check, Clock, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Receipts() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Base44Purchase.filter({}, "-created_date", 50)
      .then(setPurchases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = purchases
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="lokin-kicker lokin-kicker-lime">RECEIPTS</div>
      <div className="flex items-center gap-2">
        <ReceiptIcon className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Receipts</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">Your purchase history &amp; invoices.</p>

      <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
        <div className="text-[11px] uppercase tracking-wider text-white/45">Total Spent</div>
        <div className="text-3xl font-bold font-display text-primary text-glow leading-none mt-1">
          ${total.toFixed(2)}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40 text-sm">Loading…</div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-sm">No purchases yet.</div>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/10 lokin-panel lokin-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">
                    {p.productName || p.productId}
                  </div>
                  <div className="text-xs text-white/45 mt-0.5">
                    {new Date(p.created_date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-white">
                    ${p.amount}
                    {p.currency && (
                      <span className="text-[10px] text-white/40 ml-0.5">{p.currency}</span>
                    )}
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </div>
              {p.orderId && (
                <div className="mt-2 text-[11px] text-white/35 truncate">Order: {p.orderId}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    paid: { icon: Check, label: "Paid", color: "text-primary" },
    pending: { icon: Clock, label: "Pending", color: "text-white/50" },
    canceled: { icon: X, label: "Canceled", color: "text-destructive" },
  };
  const m = map[status] || map.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${m.color}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}