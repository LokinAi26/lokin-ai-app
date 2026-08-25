import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Image as ImageIcon, Palette, Package, Rocket, Sparkles, XCircle } from "lucide-react";

const STUDIES = [
  { key: "product_concept", label: "Product concept", icon: Sparkles },
  { key: "colorway", label: "Colorways", icon: Palette },
  { key: "packaging", label: "Packaging", icon: Package },
  { key: "campaign", label: "Campaign art", icon: Rocket },
];

const COLORWAYS = [
  "Vault Black + Neon Lime",
  "Carbon + AI Cyan",
  "Metal Silver + Vault Black",
  "Custom LOKIN direction",
];

export default function OasisDesignStudio({
  project,
  assets,
  generating,
  reviewingId,
  onGenerate,
  onReview,
}) {
  const [open, setOpen] = useState(Boolean(assets?.length));
  const [colorway, setColorway] = useState(COLORWAYS[0]);
  const sortedAssets = useMemo(
    () => [...(assets || [])].sort((a, b) => Number(b.version || 0) - Number(a.version || 0)),
    [assets],
  );

  if (!project.director_summary) return null;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-cyan-300/20 bg-cyan-300/[0.035]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between p-3 text-left">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/10">
            <ImageIcon className="h-4 w-4 text-cyan-300" />
          </span>
          <span>
            <span className="block font-display text-[9px] tracking-[0.16em] text-cyan-300">OASIS DESIGN STUDIO</span>
            <span className="mt-0.5 block text-xs font-bold text-white/80">{sortedAssets.length} versioned asset{sortedAssets.length === 1 ? "" : "s"}</span>
          </span>
        </span>
        <span className="text-lg text-cyan-300">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-white/10 p-3">
          <label className="block">
            <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">Colorway direction</span>
            <select value={colorway} onChange={(event) => setColorway(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-300/50">
              {COLORWAYS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {STUDIES.map((study) => {
              const Icon = study.icon;
              const active = generating === study.key;
              return (
                <button key={study.key} type="button" disabled={Boolean(generating)}
                  onClick={() => onGenerate(project, study.key, colorway)}
                  className="rounded-xl border border-white/10 bg-black/35 p-3 text-left disabled:opacity-45">
                  {active ? <Clock3 className="h-4 w-4 animate-spin text-cyan-300" /> : <Icon className="h-4 w-4 text-cyan-300" />}
                  <span className="mt-2 block text-[11px] font-bold text-white/75">{study.label}</span>
                  <span className="mt-0.5 block text-[9px] text-white/35">Uses image credits</span>
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[9px] leading-relaxed text-white/30">
            Every render is a review-stage concept. It remains unverified for rights and unsuitable for manufacturing until separately cleared.
          </p>

          {sortedAssets.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {sortedAssets.map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <a href={asset.file_url} target="_blank" rel="noreferrer" className="block aspect-square bg-black">
                    <img src={asset.file_url} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />
                  </a>
                  <div className="p-2">
                    <div className="truncate text-[10px] font-bold text-white/75">{asset.name}</div>
                    <div className="mt-0.5 flex items-center justify-between text-[8px] uppercase tracking-wider text-white/35">
                      <span>{asset.asset_type}</span>
                      <span className={asset.status === "approved" ? "text-primary" : asset.status === "rejected" ? "text-red-300" : "text-amber-300"}>{asset.status}</span>
                    </div>
                    {asset.status === "review" && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button type="button" disabled={reviewingId === asset.id} onClick={() => onReview(asset, "approved")}
                          className="flex items-center justify-center gap-1 rounded-lg bg-primary/15 py-1.5 text-[9px] font-bold text-primary disabled:opacity-45">
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </button>
                        <button type="button" disabled={reviewingId === asset.id} onClick={() => onReview(asset, "rejected")}
                          className="flex items-center justify-center gap-1 rounded-lg bg-red-400/10 py-1.5 text-[9px] font-bold text-red-300 disabled:opacity-45">
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
