import { Factory, LockKeyhole, PackageCheck, ShieldAlert, Truck } from "lucide-react";

export default function OasisProductization({
  project,
  approvedAsset,
  spec,
  candidates,
  building,
  onBuild,
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
            <Metric label="Unit cost" value={"$" + Number(spec.estimated_unit_cost || 0).toFixed(2)} />
            <Metric label="Margin" value={Number(spec.estimated_margin_percent || 0).toFixed(1) + "%"} accent />
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

          <div>
            <div className="mb-1 text-[8px] uppercase tracking-[0.14em] text-white/35">Supplier candidates</div>
            <div className="space-y-1.5">
              {(candidates || []).map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                  <span className="flex items-center gap-2 text-[10px] font-bold text-white/70"><Truck className="h-3.5 w-3.5 text-violet-300" />{candidate.supplier}</span>
                  <span className="text-[8px] uppercase tracking-wider text-amber-300">{candidate.match_status?.replaceAll("_", " ")}</span>
                </div>
              ))}
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

function Metric({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-black/35 p-2">
      <div className="text-[8px] text-white/35">{label.toUpperCase()}</div>
      <div className={"mt-0.5 text-xs font-bold " + (accent ? "text-primary" : "text-white")}>{value}</div>
    </div>
  );
}
