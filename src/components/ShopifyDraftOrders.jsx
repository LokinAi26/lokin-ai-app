import { useEffect, useState } from "react";
import { FileText, Plus, Send, X, Loader2 } from "lucide-react";

// LOKIN Commerce — Shopify Draft Orders panel for the embedded app.
// Lists, creates, and invoices draft orders via the session-gated
// shopify-embed backend actions (drafts / createDraft / sendInvoice).

function money(v, cur = "USD") {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function badge(s = "") {
  const t = String(s || "open").replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function ShopifyDraftOrders({ invokeShopify, products, currency, bridge, ready }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ variantId: "", quantity: 1, email: "", note: "" });

  async function loadDrafts() {
    setLoading(true);
    setError("");
    try {
      const d = await invokeShopify("drafts", { limit: 50 }, true);
      setDrafts(d.drafts || []);
    } catch (e) {
      setError(e?.message || "Drafts unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function createDraft(e) {
    e.preventDefault();
    if (!form.variantId) {
      bridge?.toast?.("Select a product variant first", true);
      return;
    }
    setBusy(true);
    try {
      await invokeShopify(
        "createDraft",
        {
          line_items: [{ variant_id: Number(form.variantId), quantity: Math.max(1, Number(form.quantity) || 1) }],
          email: form.email || undefined,
          note: form.note || undefined,
        },
        true
      );
      bridge?.toast?.("Draft order created");
      setForm({ variantId: "", quantity: 1, email: "", note: "" });
      setShowForm(false);
      await loadDrafts();
    } catch (e) {
      bridge?.toast?.(e?.message || "Could not create draft", true);
    } finally {
      setBusy(false);
    }
  }

  async function sendInvoice(id) {
    setBusy(true);
    try {
      await invokeShopify("sendInvoice", { id }, true);
      bridge?.toast?.("Invoice sent to customer");
      await loadDrafts();
    } catch (e) {
      bridge?.toast?.(e?.message || "Could not send invoice", true);
    } finally {
      setBusy(false);
    }
  }

  const variantOptions = [];
  products.forEach((p) => {
    (p.variants || []).forEach((v) => {
      variantOptions.push({
        id: v.id,
        label: `${p.title} — ${v.title || "Default"} (${money(v.price, currency)})`,
      });
    });
  });

  return (
    <section className="rounded-3xl border border-primary/20 lokin-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.24em] text-primary/80 font-display">
          <FileText className="h-3.5 w-3.5" /> DRAFT ORDERS
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary"
        >
          <Plus className="h-3 w-3 inline -mt-0.5" /> NEW
        </button>
      </div>

      {showForm && (
        <form onSubmit={createDraft} className="rounded-2xl border border-white/10 bg-black/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] tracking-widest text-white/40">NEW DRAFT ORDER</div>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <select
            value={form.variantId}
            onChange={(e) => setForm((f) => ({ ...f, variantId: e.target.value }))}
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
          >
            <option value="">Select product…</option>
            {variantOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="Qty"
              className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Customer email"
              className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
            />
          </div>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Note (optional)"
            className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary text-black font-bold py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create draft
          </button>
        </form>
      )}

      {error ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/55">{error}</div>
      ) : loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <div key={d.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">{d.name || `Draft ${d.id}`}</div>
                  <div className="text-[10px] text-white/35">
                    {d.customer_email || "No customer"} · {d.items_count || 0} item{d.items_count === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-sm font-black text-primary">{money(d.total_price, d.currency || currency)}</div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                  {badge(d.status)}
                </span>
                {d.status !== "completed" && (
                  <button
                    onClick={() => sendInvoice(d.id)}
                    disabled={busy}
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-black disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" /> Send invoice
                  </button>
                )}
              </div>
            </div>
          ))}
          {drafts.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-xs text-white/40">
              No draft orders.
            </div>
          )}
        </div>
      )}
    </section>
  );
}