import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Mail,
  Percent,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";

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

function editableItems(draft) {
  return (draft?.line_items || []).map((it) => ({
    id: it.id,
    variant_id: it.variant_id,
    title: it.title,
    variant_title: it.variant_title,
    quantity: Number(it.quantity || 1),
    price: it.price,
    sku: it.sku,
  }));
}

export default function ShopifyDraftOrders({ invokeShopify, products, currency, bridge, ready }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ variantId: "", quantity: 1, email: "", note: "" });
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [edit, setEdit] = useState(null);
  const [aiBusy, setAiBusy] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [draftKey, setDraftKey] = useState("");

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
    const key = draftKey || (crypto.randomUUID ? crypto.randomUUID() : `dk-${Date.now()}`);
    setDraftKey(key);
    try {
      await invokeShopify(
        "createDraft",
        {
          line_items: [{ variant_id: Number(form.variantId), quantity: Math.max(1, Number(form.quantity) || 1) }],
          email: form.email || undefined,
          note: form.note || undefined,
          idempotency_key: key,
        },
        true
      );
      bridge?.toast?.("Draft order created");
      setDraftKey("");
      setForm({ variantId: "", quantity: 1, email: "", note: "" });
      setShowForm(false);
      await loadDrafts();
    } catch (e) {
      bridge?.toast?.(e?.message || "Could not create draft", true);
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(id) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      setEdit(null);
      setAiResult(null);
      return;
    }
    setOpenId(id);
    setDetailLoading(true);
    setAiResult(null);
    try {
      const res = await invokeShopify("draft", { id }, true);
      const d = res.draft || null;
      setDetail(d);
      setEdit({
        email: d?.email || d?.customer?.email || "",
        note: d?.note || "",
        line_items: editableItems(d),
        discountType: d?.applied_discount?.value_type || "percentage",
        discountValue: d?.applied_discount?.value || "",
        discountTitle: d?.applied_discount?.title || "LOKIN discount",
        shippingTitle: d?.shipping_line?.title || "",
        shippingPrice: d?.shipping_line?.price || "",
        addVariantId: "",
      });
    } catch (e) {
      bridge?.toast?.(e?.message || "Could not load draft", true);
      setOpenId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!openId) return;
    const res = await invokeShopify("draft", { id: openId }, true);
    const d = res.draft || null;
    setDetail(d);
    setEdit((old) => ({
      ...(old || {}),
      email: d?.email || d?.customer?.email || "",
      note: d?.note || "",
      line_items: editableItems(d),
    }));
  }

  async function saveDraft() {
    if (!openId || !edit?.line_items?.length) return;
    setBusy(true);
    try {
      await invokeShopify(
        "updateDraft",
        {
          id: openId,
          email: edit.email,
          note: edit.note,
          line_items: edit.line_items,
          applied_discount: Number(edit.discountValue) > 0 ? {
            value_type: edit.discountType,
            value: Number(edit.discountValue),
            title: edit.discountTitle || "LOKIN discount",
          } : null,
          shipping_line: edit.shippingTitle ? {
            title: edit.shippingTitle,
            price: Math.max(0, Number(edit.shippingPrice) || 0),
          } : null,
        },
        true
      );
      bridge?.toast?.("Draft updated");
      await Promise.all([loadDrafts(), refreshDetail()]);
    } catch (e) {
      bridge?.toast?.(e?.message || "Could not update draft", true);
    } finally {
      setBusy(false);
    }
  }

  async function sendInvoice(id, email) {
    if (!email) {
      bridge?.toast?.("Add a customer email before sending an invoice", true);
      return;
    }
    setBusy(true);
    try {
      // Save the email currently entered in the editor before asking Shopify to send.
      // This fixes drafts created without a customer (for example older #D1–#D5 drafts).
      const normalizedEmail = String(email || "").trim();
      await invokeShopify("updateDraft", { id, email: normalizedEmail }, true);
      const sent = await invokeShopify("sendInvoice", { id }, true);
      bridge?.toast?.(`Invoice sent to ${sent?.email || normalizedEmail}`);
      await loadDrafts();
      if (openId === id) await refreshDetail();
    } catch (e) {
      bridge?.toast?.(e?.message || "Could not send invoice", true);
    } finally {
      setBusy(false);
    }
  }

  async function completeDraft(id) {
    if (!window.confirm("Complete this draft and convert it into a Shopify order?")) return;
    setBusy(true);
    try {
      await invokeShopify("completeDraft", { id }, true);
      bridge?.toast?.("Draft converted to order");
      setOpenId(null);
      setDetail(null);
      await loadDrafts();
    } catch (e) {
      bridge?.toast?.(e?.message || "Could not complete draft", true);
    } finally {
      setBusy(false);
    }
  }

  async function runAI(mode) {
    if (!openId) return;
    setAiBusy(mode);
    try {
      const res = await invokeShopify("draftAI", { id: openId, mode }, true);
      setAiResult({ mode, ...res });
      if (mode === "discount" && Number(res.percent) > 0) {
        setEdit((f) => ({ ...f, discountType: "percentage", discountValue: Number(res.percent), discountTitle: "LOKIN AI recommendation" }));
      }
    } catch (e) {
      bridge?.toast?.(e?.message || "Draft intelligence unavailable", true);
    } finally {
      setAiBusy("");
    }
  }

  const variantOptions = useMemo(() => {
    const out = [];
    products.forEach((p) => {
      (p.variants || []).forEach((v) => out.push({ id: v.id, title: p.title, variant: v.title || "Default", price: v.price }));
    });
    return out;
  }, [products]);

  function addVariantToEdit() {
    const id = edit?.addVariantId;
    if (!id) return;
    const option = variantOptions.find((o) => String(o.id) === String(id));
    if (!option) return;
    setEdit((f) => ({
      ...f,
      addVariantId: "",
      line_items: [...(f.line_items || []), { variant_id: Number(option.id), title: option.title, variant_title: option.variant, quantity: 1, price: option.price }],
    }));
  }

  function changeQty(index, next) {
    setEdit((f) => ({ ...f, line_items: f.line_items.map((it, i) => i === index ? { ...it, quantity: Math.max(1, Number(next) || 1) } : it) }));
  }

  function removeItem(index) {
    setEdit((f) => ({ ...f, line_items: f.line_items.filter((_, i) => i !== index) }));
  }

  const customerEmail = detail?.email || detail?.customer?.email || edit?.email || "";

  return (
    <section className="rounded-3xl border border-primary/20 lokin-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.24em] text-primary/80 font-display">
          <FileText className="h-3.5 w-3.5" /> DRAFT ORDERS
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">
          <Plus className="h-3 w-3 inline -mt-0.5" /> NEW
        </button>
      </div>

      {showForm && (
        <form onSubmit={createDraft} className="rounded-2xl border border-white/10 bg-black/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] tracking-widest text-white/40">NEW DRAFT ORDER</div>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <select value={form.variantId} onChange={(e) => setForm((f) => ({ ...f, variantId: e.target.value }))} className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white">
            <option value="">Select product…</option>
            {variantOptions.map((o) => <option key={o.id} value={o.id}>{o.title} — {o.variant} ({money(o.price, currency)})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="1" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="Qty" className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white" />
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Customer email" className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Note (optional)" className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white" />
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-primary text-black font-bold py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create draft
          </button>
        </form>
      )}

      {error ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/55">{error}</div>
      ) : loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <div key={d.id} className="rounded-2xl border border-white/10 bg-black/35 overflow-hidden">
              <button onClick={() => loadDetail(d.id)} className="w-full p-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">{d.name || `Draft ${d.id}`} {openId === d.id ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}</div>
                    <div className="text-[10px] text-white/35">{d.customer_email || "No customer"} · {d.items_count || 0} item{d.items_count === 1 ? "" : "s"}</div>
                  </div>
                  <div className="text-sm font-black text-primary">{money(d.total_price, d.currency || currency)}</div>
                </div>
                <div className="mt-2"><span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">{badge(d.status)}</span></div>
              </button>

              {openId === d.id && (
                <div className="border-t border-white/10 p-3 space-y-3">
                  {detailLoading || !detail || !edit ? (
                    <div className="py-5 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white/[0.03] p-2"><div className="text-[8px] text-white/30">SUBTOTAL</div><div className="text-xs font-bold">{money(detail.subtotal_price, detail.currency || currency)}</div></div>
                        <div className="rounded-xl bg-white/[0.03] p-2"><div className="text-[8px] text-white/30">TAX</div><div className="text-xs font-bold">{money(detail.total_tax, detail.currency || currency)}</div></div>
                        <div className="rounded-xl bg-primary/10 p-2"><div className="text-[8px] text-primary/60">TOTAL</div><div className="text-xs font-black text-primary">{money(detail.total_price, detail.currency || currency)}</div></div>
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-3 space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-primary"><Sparkles className="h-3.5 w-3.5" /> LOKIN AI INTELLIGENCE</div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[['summary','Summarize'],['discount','Discount'],['followup','Follow up']].map(([mode,label]) => (
                            <button key={mode} onClick={() => runAI(mode)} disabled={Boolean(aiBusy)} className="rounded-lg border border-primary/20 bg-black/30 px-2 py-2 text-[9px] font-bold text-white/70 disabled:opacity-40">
                              {aiBusy === mode ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : label}
                            </button>
                          ))}
                        </div>
                        {aiResult && (
                          <div className="rounded-xl bg-black/35 p-2.5 text-[10px] leading-relaxed text-white/65">
                            {aiResult.summary || aiResult.message || <><span className="font-bold text-primary">{aiResult.recommendation}</span> — {aiResult.reason}</>}
                            {aiResult.provider && <div className="mt-1 text-[8px] uppercase tracking-widest text-white/25">{aiResult.provider === 'openai' ? 'OpenAI powered' : 'LOKIN local intelligence'}</div>}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-[9px] tracking-widest text-white/35">CUSTOMER & NOTE</div>
                        <input type="email" value={edit.email} onChange={(e) => setEdit((f) => ({ ...f, email: e.target.value }))} placeholder="Customer email" className="w-full rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-xs text-white" />
                        <textarea value={edit.note} onChange={(e) => setEdit((f) => ({ ...f, note: e.target.value }))} placeholder="Merchant note" rows={2} className="w-full rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-xs text-white resize-none" />
                      </div>

                      <div className="space-y-2">
                        <div className="text-[9px] tracking-widest text-white/35">ITEMS</div>
                        {edit.line_items.map((it, i) => (
                          <div key={`${it.id || it.variant_id || i}-${i}`} className="rounded-xl bg-black/35 border border-white/10 p-2 flex items-center gap-2">
                            <div className="min-w-0 flex-1"><div className="text-xs font-semibold truncate">{it.title}</div><div className="text-[9px] text-white/30">{it.variant_title || it.sku || "Item"} · {money(it.price, detail.currency || currency)}</div></div>
                            <input type="number" min="1" value={it.quantity} onChange={(e) => changeQty(i, e.target.value)} className="w-14 rounded-lg bg-black/50 border border-white/10 px-2 py-1 text-xs text-center" />
                            <button onClick={() => removeItem(i)} disabled={edit.line_items.length <= 1} className="text-white/30 disabled:opacity-20"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <select value={edit.addVariantId} onChange={(e) => setEdit((f) => ({ ...f, addVariantId: e.target.value }))} className="min-w-0 flex-1 rounded-xl bg-black/50 border border-white/10 px-2 py-2 text-[10px] text-white">
                            <option value="">Add product…</option>
                            {variantOptions.map((o) => <option key={o.id} value={o.id}>{o.title} — {o.variant}</option>)}
                          </select>
                          <button onClick={addVariantToEdit} className="rounded-xl border border-white/10 px-3 text-white/60"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/10 bg-black/30 p-2 space-y-1.5">
                          <div className="flex items-center gap-1 text-[9px] tracking-widest text-white/35"><Percent className="h-3 w-3" /> DISCOUNT</div>
                          <select value={edit.discountType} onChange={(e) => setEdit((f) => ({ ...f, discountType: e.target.value }))} className="w-full rounded-lg bg-black/50 border border-white/10 px-2 py-1.5 text-[10px]">
                            <option value="percentage">Percentage</option><option value="fixed_amount">Fixed amount</option>
                          </select>
                          <input type="number" min="0" step="0.01" value={edit.discountValue} onChange={(e) => setEdit((f) => ({ ...f, discountValue: e.target.value }))} placeholder="0" className="w-full rounded-lg bg-black/50 border border-white/10 px-2 py-1.5 text-[10px]" />
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/30 p-2 space-y-1.5">
                          <div className="flex items-center gap-1 text-[9px] tracking-widest text-white/35"><Truck className="h-3 w-3" /> SHIPPING</div>
                          <input value={edit.shippingTitle} onChange={(e) => setEdit((f) => ({ ...f, shippingTitle: e.target.value }))} placeholder="Method" className="w-full rounded-lg bg-black/50 border border-white/10 px-2 py-1.5 text-[10px]" />
                          <input type="number" min="0" step="0.01" value={edit.shippingPrice} onChange={(e) => setEdit((f) => ({ ...f, shippingPrice: e.target.value }))} placeholder="0.00" className="w-full rounded-lg bg-black/50 border border-white/10 px-2 py-1.5 text-[10px]" />
                        </div>
                      </div>

                      <button onClick={saveDraft} disabled={busy || !edit.line_items.length} className="w-full rounded-xl border border-primary/25 bg-primary/10 py-2 text-xs font-bold text-primary flex items-center justify-center gap-2 disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Save changes</button>

                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => sendInvoice(d.id, edit.email || customerEmail)} disabled={busy || !(edit.email || customerEmail)} className="rounded-xl bg-primary py-2.5 text-[10px] font-bold text-black flex items-center justify-center gap-1.5 disabled:opacity-40"><Mail className="h-3.5 w-3.5" /> Send invoice</button>
                        <button onClick={() => completeDraft(d.id)} disabled={busy} className="rounded-xl border border-white/15 bg-white/[0.04] py-2.5 text-[10px] font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" /> Convert to order</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {drafts.length === 0 && <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-xs text-white/40">No draft orders.</div>}
        </div>
      )}
    </section>
  );
}