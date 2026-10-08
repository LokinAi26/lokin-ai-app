import { useState } from "react";
import {
  BadgeCheck, ChevronDown, CircleDollarSign, Factory, Link2, Loader2, LockKeyhole,
  PackageCheck, ShieldAlert, ShoppingBag, Truck
} from "lucide-react";

const money = (value) => "$" + Number(value || 0).toFixed(2);
const percent = (value) => Number(value || 0).toFixed(1) + "%";
const label = (value) => String(value || "").replaceAll("_", " ");

export default function OasisProductization({
  project,
  approvedAsset,
  spec,
  candidates,
  samples,
  building,
  supplierAction,
  onBuild,
  onMatch,
  onVerifyCost,
  onRequestSample,
  onApproveSample,
}) {
  const [open, setOpen] = useState(Boolean(spec));
  if (!project.director_summary) return null;

  const list = candidates || [];
  const verifiedCount = list.filter(isSampleReady).length;
  const subtitle = spec
    ? `${spec.sku} · v${spec.version} · ${verifiedCount} of ${list.length} supplier${list.length === 1 ? "" : "s"} ready`
    : approvedAsset ? "Ready for draft specification" : "Waiting for approved design";

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-violet-300/20 bg-violet-300/[0.035]">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-2 p-3 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-300/25 bg-violet-300/10">
          <Factory className="h-4 w-4 text-violet-300" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[9px] tracking-[0.16em] text-violet-300">OASIS PRODUCTIZATION</span>
          <span className="mt-0.5 block truncate text-xs font-bold text-white/80">{subtitle}</span>
        </span>
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-violet-300 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/10 p-3">
          {!approvedAsset ? (
            <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/30 p-2.5">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
              <p className="text-[10px] leading-relaxed text-white/45">Approve a Design Studio concept before OASIS can create a product specification.</p>
            </div>
          ) : (
            <button type="button" disabled={building} onClick={() => onBuild(project)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-violet-300/25 bg-violet-300/10 py-2.5 text-xs font-black text-violet-200 disabled:opacity-45">
              <PackageCheck className={"h-4 w-4 " + (building ? "animate-pulse" : "")} />
              {building ? "Building controlled specification…" : spec ? "Create next specification version" : "Create draft product specification"}
            </button>
          )}

          {spec && (
            <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Retail" value={money(spec.target_retail_price)} />
                <Metric label="Draft cost" value={money(spec.estimated_unit_cost)} />
                <Metric label="Draft margin" value={percent(spec.estimated_margin_percent)} accent />
              </div>
              {[
                ["Materials", spec.materials],
                ["Dimensions", spec.dimensions],
                ["Decoration", spec.decoration_method],
                ["Packaging", spec.packaging],
                ["Quality gates", spec.quality_checks],
              ].filter(([, value]) => value).map(([name, value]) => (
                <div key={name}>
                  <div className="text-[8px] uppercase tracking-[0.14em] text-white/35">{name}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/60">{value}</p>
                </div>
              ))}

              <button type="button" disabled={Boolean(supplierAction)} onClick={() => onMatch(project)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] py-2.5 text-xs font-black text-cyan-200 disabled:opacity-45">
                {supplierAction === "matching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {supplierAction === "matching" ? "Reading live catalogs…" : list.length ? "Re-match live Printful + Printify catalogs" : "Match live Printful + Printify catalogs"}
              </button>

              <div>
                <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-white/35">Supplier control</div>
                {list.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-white/10 p-2.5 text-[10px] leading-relaxed text-white/40">
                    No supplier candidates yet. Match the live catalogs to find products that fit this specification.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((candidate) => (
                      <SupplierCandidate
                        key={candidate.id}
                        candidate={candidate}
                        sample={(samples || []).find((item) => item.supplier_candidate_id === candidate.id)}
                        retailPrice={Number(spec.target_retail_price || project.recommended_price || project.target_price || 0)}
                        targetMargin={Math.max(0, Number(project.target_margin || 0))}
                        supplierAction={supplierAction}
                        onVerifyCost={onVerifyCost}
                        onRequestSample={onRequestSample}
                        onApproveSample={onApproveSample}
                      />
                    ))}
                  </div>
                )}
              </div>

              {spec.assumptions && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-2.5">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <p className="text-[9px] leading-relaxed text-white/40">{spec.assumptions}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function isSampleReady(candidate) {
  return candidate.match_status === "verified" && candidate.cost_verified && candidate.margin_passed && candidate.inventory_verified;
}

function SupplierCandidate({ candidate, sample, retailPrice, targetMargin, supplierAction, onVerifyCost, onRequestSample, onApproveSample }) {
  const [costOpen, setCostOpen] = useState(false);
  const [baseCost, setBaseCost] = useState("");
  const [shipping, setShipping] = useState("0");
  const ready = isSampleReady(candidate);

  const base = Number(baseCost);
  const ship = Number(shipping);
  const valid = baseCost !== "" && Number.isFinite(base) && base > 0 && shipping !== "" && Number.isFinite(ship) && ship >= 0;
  const landed = valid ? base + ship : 0;
  const previewMargin = valid && retailPrice > 0 ? ((retailPrice - landed) / retailPrice) * 100 : null;

  async function submitCost(event) {
    event.preventDefault();
    if (!valid) return;
    const saved = await onVerifyCost(candidate, { baseCost: base, shipping: ship });
    if (saved) setCostOpen(false);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[10px] font-bold text-white/75">
          <Truck className="h-3.5 w-3.5 shrink-0 text-violet-300" />
          <span className="truncate">{candidate.supplier}{candidate.product_title ? " · " + candidate.product_title : ""}</span>
        </span>
        <span className={`shrink-0 text-[8px] uppercase tracking-wider ${ready ? "text-primary" : candidate.match_status === "rejected" || candidate.match_status === "unavailable" ? "text-red-300" : "text-amber-300"}`}>
          {label(candidate.match_status)}
        </span>
      </div>
      {candidate.supplier_product_id && (
        <div className="mt-1 text-[9px] text-white/35">Provider product #{candidate.supplier_product_id} · match {Number(candidate.live_match_score || 0).toFixed(1)}%</div>
      )}
      <div className="mt-2 grid grid-cols-4 gap-1">
        <Gate label="Catalog" passed={Boolean(candidate.supplier_product_id)} />
        <Gate label="Available" passed={candidate.inventory_verified === true} />
        <Gate label="Cost" passed={candidate.cost_verified === true} />
        <Gate label="Margin" passed={candidate.margin_passed === true} />
      </div>
      {candidate.cost_verified && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          <Metric label="Landed" value={money(candidate.landed_cost)} />
          <Metric label="Margin" value={percent(candidate.estimated_margin_percent)} accent />
        </div>
      )}
      {candidate.notes && <p className="mt-2 text-[9px] leading-relaxed text-white/40">{candidate.notes}</p>}

      {candidate.supplier_product_id && !candidate.cost_verified && !costOpen && (
        <button type="button" disabled={Boolean(supplierAction)} onClick={() => setCostOpen(true)}
          className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] py-2 text-[10px] font-black text-primary disabled:opacity-45">
          <CircleDollarSign className="h-3.5 w-3.5" /> Confirm landed cost
        </button>
      )}

      {costOpen && (
        <form onSubmit={submitCost} className="mt-2 space-y-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[8px] uppercase tracking-[0.14em] text-white/40">Base cost</span>
              <input type="number" inputMode="decimal" min="0.01" step="0.01" required autoFocus value={baseCost}
                onChange={(event) => setBaseCost(event.target.value)} placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black px-2.5 py-2 text-sm text-white outline-none focus:border-primary/60" />
            </label>
            <label className="block">
              <span className="text-[8px] uppercase tracking-[0.14em] text-white/40">Shipping / unit</span>
              <input type="number" inputMode="decimal" min="0" step="0.01" required value={shipping}
                onChange={(event) => setShipping(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black px-2.5 py-2 text-sm text-white outline-none focus:border-primary/60" />
            </label>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/45">Landed {valid ? money(landed) : "—"}</span>
            <span className={previewMargin === null ? "text-white/35" : previewMargin >= targetMargin ? "text-primary" : "text-red-300"}>
              {previewMargin === null ? "Margin preview —" : `Margin ${percent(previewMargin)} · target ${percent(targetMargin)}`}
            </span>
          </div>
          <p className="text-[9px] leading-relaxed text-white/35">You are confirming these figures yourself. They are not a supplier quote.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCostOpen(false)} className="min-h-[40px] rounded-lg border border-white/10 text-[10px] font-bold text-white/60">Cancel</button>
            <button type="submit" disabled={!valid || Boolean(supplierAction)}
              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-primary text-[10px] font-black text-black disabled:opacity-45">
              {supplierAction === "cost" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleDollarSign className="h-3.5 w-3.5" />}
              Save landed cost
            </button>
          </div>
        </form>
      )}

      {ready && !sample && (
        <button type="button" disabled={Boolean(supplierAction)} onClick={() => onRequestSample(candidate)}
          className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-violet-300/25 bg-violet-300/[0.08] py-2 text-[10px] font-black text-violet-200 disabled:opacity-45">
          {supplierAction === "sample" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />} Create sample approval request
        </button>
      )}
      {sample && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-bold text-white/65">Sample · {label(sample.status) || "status unknown"}</span>
            <span className="text-[9px] text-white/35">{money(sample.estimated_cost)}</span>
          </div>
          {sample.status === "awaiting_approval" && (
            <button type="button" disabled={Boolean(supplierAction)} onClick={() => onApproveSample(sample)}
              className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-[10px] font-black text-black disabled:opacity-45">
              {supplierAction === "approval" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />} Approve, do not order
            </button>
          )}
          {sample.status === "approved_not_ordered" && (
            <p className="mt-1 text-[9px] font-bold text-primary">Approved, not ordered. No payment or provider order exists.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Gate({ label: name, passed }) {
  return (
    <div className={"rounded-md border px-1.5 py-1 text-center text-[8px] font-bold " + (
      passed ? "border-primary/25 bg-primary/[0.07] text-primary" : "border-white/10 bg-white/[0.02] text-white/30"
    )}>
      {passed ? "✓ " : "○ "}{name}
    </div>
  );
}

function Metric({ label: name, value, accent }) {
  return (
    <div className="rounded-lg bg-black/35 p-2">
      <div className="text-[8px] text-white/35">{name.toUpperCase()}</div>
      <div className={"mt-0.5 text-xs font-bold " + (accent ? "text-primary" : "text-white")}>{value}</div>
    </div>
  );
}
