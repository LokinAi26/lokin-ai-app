import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, Leaf, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

function readCart() { try { return JSON.parse(localStorage.getItem("lokin_green_cart") || "[]"); } catch { return []; } }
function saveCart(c) { localStorage.setItem("lokin_green_cart", JSON.stringify(c)); window.dispatchEvent(new Event("lokin_green_cart")); }

export default function StashCart() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState(readCart());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [apt, setApt] = useState("");
  const [discreet, setDiscreet] = useState(true);
  const [placing, setPlacing] = useState(false);

  useEffect(() => setItems(readCart()), []);

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  function setQty(id, qty) {
    const c = readCart().map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i));
    saveCart(c); setItems(c);
  }
  function remove(id) {
    const c = readCart().filter((i) => i.id !== id);
    saveCart(c); setItems(c);
  }

  async function placeOrder() {
    if (!items.length) return;
    if (!address.trim()) { toast({ title: "Delivery address required", variant: "destructive" }); return; }
    setPlacing(true);
    try {
      let user = null;
      try { user = await base44.auth.me(); } catch {}
      const dispensary = [...new Set(items.map((i) => i.dispensary).filter(Boolean))][0] || "LOKIN Green";
      await base44.entities.CannabisOrder.create({
        buyer_user_id: user?.id || null,
        items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, unit: i.unit, qty: i.qty })),
        total: Number(total.toFixed(2)),
        dispensary,
        delivery_address: address.trim(),
        apt: apt.trim(),
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        discreet,
        age_verified: true,
        status: "placed",
      });
      saveCart([]);
      toast({ title: "Order placed", description: "Discreet delivery on the way." });
      navigate("/stash");
    } catch (e) {
      toast({ title: "Order failed", description: e.message, variant: "destructive" });
    } finally { setPlacing(false); }
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <Link to="/stash" className="flex items-center gap-1.5 text-sm text-white/60"><Leaf className="h-4 w-4 text-primary" /> Back to menu</Link>
      <h1 className="text-xl font-bold font-heading metal-text">Your Stash</h1>

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <ShoppingBag className="h-8 w-8 text-white/30 mx-auto mb-2" />
          <p className="text-sm text-white/40">Your cart is empty.</p>
          <Link to="/stash" className="mt-4 inline-block rounded-2xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold">Browse menu</Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-2xl border border-white/10 lokin-panel p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{i.name}</div>
                  <div className="text-[10px] text-white/40">${Number(i.price).toFixed(2)}/{i.unit}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(i.id, i.qty - 1)} className="rounded-lg border border-white/10 bg-white/5 p-1.5 active:scale-90"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="text-sm font-bold w-5 text-center">{i.qty}</span>
                  <button onClick={() => setQty(i.id, i.qty + 1)} className="rounded-lg border border-white/10 bg-white/5 p-1.5 active:scale-90"><Plus className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(i.id)} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-destructive active:scale-90"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-3">
            <div className="text-[11px] tracking-[0.2em] text-white/40 font-display">DELIVERY DETAILS</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional, for discretion)" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30" />
            <input value={apt} onChange={(e) => setApt(e.target.value)} placeholder="Apt / unit (optional)" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30" />
            <button onClick={() => setDiscreet((d) => !d)} className={`w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${discreet ? "border-primary/30 bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-white/60"}`}>
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Discreet packaging</span>
              <span className="text-xs font-bold">{discreet ? "ON" : "OFF"}</span>
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-white/50">Total</span>
            <span className="text-2xl font-display font-bold text-primary">${total.toFixed(2)}</span>
          </div>
          <button onClick={placeOrder} disabled={placing} className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-bold glow-primary active:scale-[0.98] disabled:opacity-50">
            {placing ? "Placing order…" : "Place discreet order"}
          </button>
          <p className="text-[10px] text-white/30 text-center">21+ only · ID checked on delivery · Licensed markets</p>
        </>
      )}
    </div>
  );
}