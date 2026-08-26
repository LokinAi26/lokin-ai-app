import {
  BadgeCheck, CircleDollarSign, Factory, Link2, Loader2, LockKeyhole,
  PackageCheck, ShieldAlert, ShoppingBag, Truck
} from "lucide-react";

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
  if (!project.director_summary) return null;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-violet-300/20 bg-violet-300/[0.035] p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-300/25 bg-violet-300/10">
          <Factory className="h-4 w-4 text-violet-300" />
        </span>
        <span>
          <span className="block font-display text-[9px] tracking-[0.16em] text-violet-300">OASIS PRODUCTIZATION</span>
          <span className="mt-0.5 block text-xs font-bold text-white/80">
            {spec ? spec.sku + " · v" + spec.version : approvedAsset ? "Ready for draft specification" : "Waiting for approved design"}
          </span>
        </span>
      </div>

      {!approvedAsset ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-black/30 p-2.5">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
          <p className="text-[10px] leading-relaxed text-white/45">Approve a Design Studio concept before OASIS can create a product specification.</p>
        </div>
      ) : (
        <button type="button" disabled={building} onClick={() => onBuild(project)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300/25 bg-violet-300/10 py-2.5 text-xs font-black text-violet-200 disabled:opacity-45">
          <PackageCheck className={"h-4 w-4 " + (building ? "animate-pulse" : "")} />
          {building ? "Building controlled specification…" : spec ? "Create next specification version" : "Create draft product specification"}
        </button>
      )}

      {spec && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Retail" value={"$" + Number(spec.target_retail_price || 0).toFixed(2)} />
            <Metric label="Draft cost" value={"$" + Number(spec.estimated_unit_cost || 0).toFixed(2)} />
            <Metric label="Draft margin" value={Number(spec.estimated_margin_percent || 0).toFixed(1) + "%"} accent />
          </div>
          {[
            ["Materials", spec.materials],
            ["Dimensions", spec.dimensions],
            ["Decoration", spec.decoration_method],
            ["Packaging", spec.packaging],
            ["Quality gates", spec.quality_checks],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[8px] uppercase tracking-[0.14em] text-white/35">{label}</div>
              <p className="mt-1 text-[10px] leading-relaxed text-white/60">{value}</p>
            </div>
          ))}

          <button type="button" disabled={supplierAction === "matching"} onClick={() => onMatch(project)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] py-2.5 text-xs font-black text-cyan-200 disabled:opacity-45">
            {supplierAction === "matching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {supplierAction === "matching" ? "Reading live catalogs…" : "Match live Printful + Printify catalogs"}
          </button>

          <div>
            <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-white/35">Supplier control</div>
            <div className="space-y-2">
              {(candidates || []).map((candidate) => {
                const sample = (samples || []).find((item) => item.supplier_candidate_id === candidate.id);
                const ready = candidate.match_status === "verified" && candidate.cost_verified && candidate.inventory_verified;
                return (
                  <div key={candidate.id} className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-[10px] font-bold text-white/75">
                        <Truck className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                        <span className="truncate">{candidate.supplier}{candidate.product_title ? " · " + candidate.product_title : ""}</span>
                      </span>
                      <span className="shrink-0 text-[8px] uppercase tracking-wider text-amber-300">
                        {candidate.match_status?.replaceAll("_", " ")}
                      </span>
                    </div>
                    {candidate.supplier_product_id && (
                      <div className="mt-1 text-[9px] text-white/35">Provider product #{candidate.supplier_product_id} · match {Number(candidate.live_match_score || 0).toFixed(1)}%</div>
                    )}
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <Gate label="Catalog" passed={Boolean(candidate.supplier_product_id)} />
                      <Gate label="Available" passed={candidate.inventory_verified === true} />
                      <Gate label="Cost" passed={candidate.cost_verified === true} />
                    </div>
                    {candidate.cost_verified && (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <Metric label="Landed" value={"$" + Number(candidate.landed_cost || 0).toFixed(2)} />
                        <Metric label="Margin" value={Number(candidate.estimated_margin_percent || 0).toFixed(1) + "%"} accent />
                      </div>
                    )}
                    <p className="mt-2 text-[9px] leading-relaxed text-white/38">{candidate.notes}</p>

                    {candidate.supplier_product_id && !candidate.cost_verified && (
                      <button type="button" disabled={Boolean(supplierAction)} onClick={() => onVerifyCost(candidate)}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] py-2 text-[10px] font-black text-primary disabled:opacity-45">
                        <CircleDollarSign className="h-3.5 w-3.5" /> Confirm landed cost
                      </button>
                    )}
                    {ready && !sample && (
                      <button type="button" disabled={Boolean(supplierAction)} onClick={() => onRequestSample(candidate)}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300/25 bg-violet-300/[0.08] py-2 text-[10px] font-black text-violet-200 disabled:opacity-45">
                        <ShoppingBag className="h-3.5 w-3.5" /> Create sample approval request
                      </button>
                    )}
                    {sample && (
                      <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-white/65">Sample · {sample.status.replaceAll("_", " ")}</span>
                          <span className="text-[9px] text-white/35">{"$" + Number(sample.estimated_cost || 0).toFixed(2)}</span>
                        </div>
                        {sample.status === "awaiting_approval" && (
                          <button type="button" disabled={Boolean(supplierAction)} onClick={() => onApproveSample(sample)}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-[10px] font-black text-black disabled:opacity-45">
                            <BadgeCheck className="h-3.5 w-3.5" /> Approve—do not order
                          </button>
                        )}
                        {sample.status === "approved_not_ordered" && (
                          <p className="mt-1 text-[9px] font-bold text-primary">Approved—not ordered. No payment or provider order exists.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-[9px] leading-relaxed text-white/40">{spec.assumptions}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function Gate({ label, passed }) {
  return (
    <div className={"rounded-md border px-1.5 py-1 text-center text-[8px] font-bold " + (
      passed ? "border-primary/25 bg-primary/[0.07] text-primary" : "border-white/8 bg-white/[0.02] text-white/30"
    )}>
      {passed ? "✓ " : "○ "}{label}
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-black/35 p-2">
      <div className="text-[8px] text-white/35">{label.toUpperCase()}</div>
      <div className={"mt-0.5 text-xs font-bold " + (accent ? "text-primary" : "text-white")}>{value}</div>
    </div>
  );
}