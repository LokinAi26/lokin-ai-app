import { Boxes } from "lucide-react";
import { money } from "./format";

export default function InventoryHealth({ products, currency }) {
  const variants = [];
  products.forEach((p) =>
    (p.variants || []).forEach((v) =>
      variants.push({ ...v, product_title: p.title, image: p.thumbnail_url, status: p.status })
    )
  );
  const out = variants.filter((v) => v.available === 0);
  const low = variants.filter((v) => v.available != null && v.available > 0 && v.available <= 5);
  const live = variants.filter((v) => v.available == null || v.available > 5);

  return (
    <section className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-white/55 font-display">
        <Boxes className="h-3.5 w-3.5" /> INVENTORY HEALTH
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="IN STOCK" value={String(live.length)} tone="text-primary" />
        <Tile label="LOW STOCK" value={String(low.length)} tone="text-amber-300" />
        <Tile label="OUT OF STOCK" value={String(out.length)} tone="text-red-300" />
      </div>
      {out.length > 0 && (
        <Block title="OUT OF STOCK" tone="border-red-500/25" items={out.slice(0, 6)} render={(v) => (
          <>
            <span className="text-white/70 truncate">{v.product_title}</span>
            <span className="text-[9px] text-red-300">Sold out</span>
          </>
        )} />
      )}
      {low.length > 0 && (
        <Block title="LOW STOCK" tone="border-amber-500/25" items={low.slice(0, 6)} render={(v) => (
          <>
            <span className="text-white/70 truncate">{v.product_title}</span>
            <span className="text-[9px] text-amber-300">{v.available} left</span>
          </>
        )} />
      )}
      <div className="pt-1">
        <div className="text-[9px] tracking-widest text-white/35 mb-1.5">PRODUCTS</div>
        <div className="space-y-1">
          {products.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs gap-2">
              <span className="text-white/70 truncate">{p.title}</span>
              <span className="text-white/50">{p.min_price ? `${money(p.min_price, currency)} – ${money(p.max_price, currency)}` : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
      <div className={`text-lg font-black ${tone}`}>{value}</div>
      <div className="text-[8px] tracking-widest text-white/30 mt-0.5">{label}</div>
    </div>
  );
}

function Block({ title, tone, items, render }) {
  return (
    <div className={`rounded-2xl border ${tone} bg-black/30 p-3`}>
      <div className="text-[9px] tracking-widest text-white/35 mb-1.5">{title}</div>
      <div className="space-y-1">
        {items.map((v, i) => (
          <div key={i} className="flex items-center justify-between text-xs gap-2">{render(v)}</div>
        ))}
      </div>
    </div>
  );
}