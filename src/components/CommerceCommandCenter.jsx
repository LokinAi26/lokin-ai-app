import { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Activity, CheckCircle2, Clock3, DollarSign, PackageCheck, RefreshCw, ShieldCheck, Truck } from "lucide-react";

function money(value, currency = "USD") {
  const n = Number(value || 0);
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n); } catch { return `$${n.toFixed(2)}`; }
}

function badge(status = "") {
  const s = String(status || "unfulfilled").replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CommerceCommandCenter() {
  const [orders, setOrders] = useState([]);
  const [printfulOrders, setPrintfulOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [schemaAudit, setSchemaAudit] = useState(null);
  const [schemaBusy, setSchemaBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [shopifyRes, printfulRes] = await Promise.allSettled([
        base44.functions.invoke("shopify-catalog", { action: "orders", limit: 50, status: "any" }),
        base44.functions.invoke("printful-catalog", { action: "orders", limit: 50 }),
      ]);
      if (shopifyRes.status === "fulfilled") setOrders(shopifyRes.value?.data?.orders || []);
      if (printfulRes.status === "fulfilled") setPrintfulOrders(printfulRes.value?.data?.orders || []);
      if (shopifyRes.status === "rejected" && printfulRes.status === "rejected") throw shopifyRes.reason || printfulRes.reason;
    } catch (e) {
      const msg = e?.response?.data?.error || e?.data?.error || e?.message || "Unable to load orders";
      setError(String(msg));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSchemaAudit = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("commerce-schema-auditor", { action: "summary" });
      setSchemaAudit(res?.data || res);
    } catch {
      setSchemaAudit(null);
    }
  }, []);

  useEffect(() => { loadSchemaAudit(); }, [loadSchemaAudit]);

  async function scanNextSchemaBatch() {
    if (schemaBusy) return;
    setSchemaBusy(true);
    const requestedAt = new Date().toISOString();
    let command = null;
    try {
      command = await base44.entities.CommerceCommand.create({
        command: "schema_audit_scan_batch",
        status: "running",
        requested_at: requestedAt,
        result: `Starting at offset ${schemaAudit?.audited_count || 0}`,
      });
      const res = await base44.functions.invoke("commerce-schema-auditor", {
        action: "scanBatch",
        offset: schemaAudit?.audited_count || 0,
        limit: 20,
      });
      if (command?.id) await base44.entities.CommerceCommand.update(command.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        result: `Scanned ${res?.data?.scanned || 0} schemas; deletion remained disabled.`,
      });
      await loadSchemaAudit();
    } catch (e) {
      if (command?.id) await base44.entities.CommerceCommand.update(command.id, {
        status: "failed",
        completed_at: new Date().toISOString(),
        result: String(e?.message || "Schema audit failed"),
      }).catch(() => {});
    } finally {
      setSchemaBusy(false);
    }
  }

  const stats = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
    const paid = orders.filter((o) => ["paid", "partially_refunded"].includes(o.financial_status)).length;
    const moving = orders.filter((o) => ["fulfilled", "partial"].includes(o.fulfillment_status)).length;
    const tracked = printfulOrders.filter((o) => (o.tracking || []).some((t) => t.tracking_number || t.tracking_url)).length;
    return { revenue, paid, moving, tracked };
  }, [orders, printfulOrders]);

  return (
    <section className="rounded-3xl border border-accent/20 lokin-panel p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.24em] text-accent/80 font-display">POST-PURCHASE INTELLIGENCE</div>
          <div className="text-lg font-bold text-white flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /> Commerce Command Center</div>
          <div className="mt-1 text-xs text-white/45">Shopify payment signal → Printful fulfillment → tracking telemetry</div>
        </div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-bold text-accent disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/55">{error === "Admin only" ? "Order intelligence is protected and appears for LOKIN administrators only." : error}</div>}

      {!error && <>
        <div className="grid grid-cols-2 gap-2">
          <Metric icon={DollarSign} label="ORDER VALUE" value={money(stats.revenue, orders[0]?.currency || "USD")} />
          <Metric icon={PackageCheck} label="PAID" value={`${stats.paid}/${orders.length}`} />
          <Metric icon={Truck} label="FULFILLED" value={String(stats.moving)} />
          <Metric icon={Clock3} label="TRACKED" value={String(stats.tracked)} />
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] tracking-[.16em] text-primary font-display"><ShieldCheck className="h-3.5 w-3.5" /> SCHEMA GUARD</div>
              <div className="mt-1 text-xs text-white/55">
                {schemaAudit ? `${schemaAudit.audited_count}/${schemaAudit.manifest_count} commerce schemas audited · deletion disabled` : "Loading preserve-first schema audit…"}
              </div>
            </div>
            <button onClick={scanNextSchemaBatch} disabled={schemaBusy || !schemaAudit || schemaAudit.remaining_count === 0}
              className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] font-bold text-primary disabled:opacity-40">
              {schemaBusy ? "SCANNING…" : schemaAudit?.remaining_count === 0 ? "AUDITED" : "SCAN NEXT 20"}
            </button>
          </div>
          {schemaAudit && <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[9px]">
            <div className="rounded-lg bg-black/30 p-1.5"><div className="text-white/30">CORE</div><div className="font-bold text-white">{schemaAudit.counts?.core || 0}</div></div>
            <div className="rounded-lg bg-black/30 p-1.5"><div className="text-white/30">DEPEND</div><div className="font-bold text-accent">{schemaAudit.counts?.dependency || 0}</div></div>
            <div className="rounded-lg bg-black/30 p-1.5"><div className="text-white/30">DATA</div><div className="font-bold text-white">{schemaAudit.counts?.data || 0}</div></div>
            <div className="rounded-lg bg-black/30 p-1.5"><div className="text-white/30">CANDIDATE</div><div className="font-bold text-primary">{schemaAudit.counts?.candidate || 0}</div></div>
          </div>}
        </div>

        <div className="space-y-2">
          {orders.slice(0, 8).map((o) => (
            <div key={o.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-bold text-white">{o.name || `Order ${o.id}`}</div><div className="text-[10px] text-white/35">{o.created_at ? new Date(o.created_at).toLocaleString() : "Live order"} · {o.items_count || 0} item{o.items_count === 1 ? "" : "s"}</div></div>
                <div className="text-sm font-black text-primary">{money(o.total_price, o.currency)}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary"><CheckCircle2 className="mr-1 inline h-2.5 w-2.5" />{badge(o.financial_status)}</span>
                <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent"><Truck className="mr-1 inline h-2.5 w-2.5" />{badge(o.fulfillment_status)}</span>
              </div>
            </div>
          ))}
          {!loading && orders.length === 0 && <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center text-xs text-white/40">No Shopify orders yet. New purchases will surface here automatically.</div>}
          <div className="rounded-xl border border-white/8 bg-black/30 p-3 text-[11px] leading-relaxed text-white/45">
            <span className="font-semibold text-white/70">Fail-closed commerce rule:</span> checkout never counts as fulfillment. LOKIN only treats an order as shipped/tracked after a fulfillment-provider signal is present.
          </div>
        </div>
      </>}
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-white/10 bg-black/40 p-3"><Icon className="h-4 w-4 text-accent"/><div className="mt-2 text-[9px] tracking-[.14em] text-white/30">{label}</div><div className="mt-0.5 text-sm font-black text-white">{value}</div></div>;
}
