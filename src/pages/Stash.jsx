import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Leaf, ShoppingCart, ShieldCheck, Plus, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import GreenOrderTracker from "@/components/GreenOrderTracker";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "flower", label: "Flower" },
  { id: "preroll", label: "Pre-Rolls" },
  { id: "edible", label: "Edibles" },
  { id: "concentrate", label: "Concentrates" },
  { id: "vape", label: "Vapes" },
  { id: "topical", label: "Topicals" },
  { id: "tincture", label: "Tinctures" },
];

const AGE_KEY = "lokin_green_age_ok";

function readCart() {
  try { return JSON.parse(localStorage.getItem("lokin_green_cart") || "[]"); } catch { return []; }
}
function saveCart(c) {
  localStorage.setItem("lokin_green_cart", JSON.stringify(c));
  window.dispatchEvent(new Event("lokin_green_cart"));
}

export default function Stash() {
  const [ageOk, setAgeOk] = useState(() => localStorage.getItem(AGE_KEY) === "1");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => { if (ageOk) load(); }, [ageOk]);
  useEffect(() => {
    const upd = () => setCartCount(readCart().reduce((n, i) => n + i.qty, 0));
    upd();
    window.addEventListener("lokin_green_cart", upd);
    return () => window.removeEventListener("lokin_green_cart", upd);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const list = await base44.entities.CannabisProduct.list("-created_date", 200);
      setProducts((list || []).filter((p) => p.active !== false));
    } catch (e) { setProducts([]); }
    setLoading(false);
  }

  function add(p) {
    const c = readCart();
    const ex = c.find((i) => i.id === p.id);
    if (ex) ex.qty += 1;
    else c.push({ id: p.id, name: p.name, price: p.price, unit: p.unit, dispensary: p.dispensary, qty: 1 });
    saveCart(c);
  }

  if (!ageOk) {
    return (
      <div className="p-6 min-h-[80dvh] flex flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-black glow-primary mb-4">
          <Leaf className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-heading metal-text">LOKIN Green</h1>
        <p className="text-sm text-white/55 mt-2 max-w-xs">A discreet cannabis marketplace for licensed, adult-use markets. You must be 21 or older to continue.</p>
        <button onClick={() => { localStorage.setItem(AGE_KEY, "1"); setAgeOk(true); }} className="mt-6 rounded-2xl bg-primary text-primary-foreground px-6 py-3 text-sm font-bold glow-primary active:scale-95 transition-transform">
          I am 21 or older
        </button>
        <p className="mt-4 text-[10px] text-white/30 max-w-xs">For use only in jurisdictions where cannabis delivery is legal. LOKIN verifies compliance per market.</p>
      </div>
    );
  }

  const filtered = products.filter((p) => (cat === "all" || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold font-heading metal-text">LOKIN Green</h1>
        </div>
        <Link to="/stash/cart" className="relative flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary active:scale-95 transition-transform">
          <ShoppingCart className="h-4 w-4" /> Cart
          {cartCount > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">{cartCount}</span>}
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 lokin-panel px-3 py-2">
        <Search className="h-4 w-4 text-white/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search strains & products" className="bg-transparent text-sm text-white outline-none flex-1 placeholder:text-white/30" />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${cat === c.id ? "bg-primary text-primary-foreground" : "border border-white/10 bg-white/5 text-white/60"}`}>{c.label}</button>
        ))}
      </div>

      <GreenOrderTracker />

      {loading ? (
        <div className="py-10 text-center text-sm text-white/40">Loading menu…</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-white/40">No products yet. Check back soon.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/10 lokin-panel overflow-hidden flex flex-col">
              <div className="aspect-square bg-black/40 flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Leaf className="h-8 w-8 text-primary/40" />}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <div className="text-xs font-bold text-white leading-tight">{p.name}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{p.dispensary}</div>
                <div className="flex items-center gap-1 mt-1 text-[9px]">
                  <span className="rounded bg-primary/15 text-primary px-1.5 py-0.5">THC {p.thc_pct}%</span>
                  <span className="rounded bg-accent/15 text-accent px-1.5 py-0.5">CBD {p.cbd_pct}%</span>
                </div>
                <div className="flex items-end justify-between mt-auto pt-2">
                  <div className="text-sm font-display font-bold text-primary">${Number(p.price).toFixed(2)}<span className="text-[9px] text-white/40 font-body">/{p.unit}</span></div>
                  <button onClick={() => add(p)} className="rounded-lg bg-primary text-primary-foreground p-1.5 active:scale-90 transition-transform"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-white/35 justify-center pt-2">
        <ShieldCheck className="h-3 w-3" /> Discreet packaging · Licensed markets only · 21+
      </div>
    </div>
  );
}