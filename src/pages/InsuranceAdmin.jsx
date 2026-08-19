import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const STATUS = ["submitted", "under_review", "approved", "active", "declined", "renewed"];

function inp() { return "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30"; }
function Row({ label, children }) {
  return <label className="block"><div className="text-[10px] tracking-wide text-white/40 mb-1">{label}</div>{children}</label>;
}

export default function InsuranceAdmin() {
  const { toast } = useToast();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [u, list] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.InsuranceApplication.list("-created_date", 100),
      ]);
      setMe(u);
      setApps(list || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await base44.entities.InsuranceApplication.update(editing.id, {
        provider: editing.provider || null,
        monthly_premium: editing.monthly_premium ? Number(editing.monthly_premium) : null,
        policy_number: editing.policy_number || null,
        effective_date: editing.effective_date || null,
        expires_at: editing.expires_at || null,
        deductible: editing.deductible ? Number(editing.deductible) : null,
        liability_limit: editing.liability_limit ? Number(editing.liability_limit) : null,
        notes: editing.notes || null,
        status: editing.status,
        approved_at: ["active", "approved"].includes(editing.status) ? new Date().toISOString() : null,
      });
      toast({ title: "Application updated" });
      setEditing(null);
      load();
    } catch (e) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (me && me.role !== "admin") {
    return <div className="p-6 text-center text-sm text-white/50">Admins only.</div>;
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">LOKIN Cover — Admin</h1>
      </div>
      <p className="text-sm text-white/50">Review submitted applications, set pricing, and bind active policies.</p>

      {editing ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 space-y-3">
          <div className="text-xs text-white/55 capitalize">{editing.coverage_type?.replace(/_/g, " ")} · {editing.vehicle_year} {editing.vehicle_make} {editing.vehicle_model}</div>
          <div className="text-[10px] text-white/40">License {editing.license_number ? "••••" + String(editing.license_number).slice(-3) : "—"} · {editing.state} · DOB {editing.dob || "—"}</div>
          <Row label="Provider"><input className={inp()} value={editing.provider || ""} onChange={(e) => setEditing({ ...editing, provider: e.target.value })} placeholder="Carrier name" /></Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Monthly premium"><input type="number" className={inp()} value={editing.monthly_premium || ""} onChange={(e) => setEditing({ ...editing, monthly_premium: e.target.value })} placeholder="0.00" /></Row>
            <Row label="Policy #"><input className={inp()} value={editing.policy_number || ""} onChange={(e) => setEditing({ ...editing, policy_number: e.target.value })} placeholder="POL-123" /></Row>
            <Row label="Effective"><input type="date" className={inp()} value={editing.effective_date || ""} onChange={(e) => setEditing({ ...editing, effective_date: e.target.value })} /></Row>
            <Row label="Expires"><input type="date" className={inp()} value={editing.expires_at || ""} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })} /></Row>
            <Row label="Deductible"><input type="number" className={inp()} value={editing.deductible || ""} onChange={(e) => setEditing({ ...editing, deductible: e.target.value })} placeholder="500" /></Row>
            <Row label="Liability limit"><input type="number" className={inp()} value={editing.liability_limit || ""} onChange={(e) => setEditing({ ...editing, liability_limit: e.target.value })} placeholder="1000000" /></Row>
          </div>
          <Row label="Status">
            <select className={inp()} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
              {STATUS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </Row>
          <Row label="Notes"><textarea className={inp() + " min-h-16"} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Underwriter notes" /></Row>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-2xl bg-primary text-primary-foreground py-2.5 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Save & bind"}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.length === 0 && <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/40">No applications yet.</div>}
          {apps.map((a) => (
            <button key={a.id} onClick={() => setEditing({ ...a })} className="w-full text-left rounded-2xl border border-white/10 lokin-panel p-3 flex items-center justify-between gap-2 active:scale-[0.99]">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white capitalize">{a.coverage_type?.replace(/_/g, " ")}</div>
                <div className="text-[10px] text-white/45">{[a.vehicle_year, a.vehicle_make, a.vehicle_model].filter(Boolean).join(" ")} · {a.state || "—"}</div>
              </div>
              <div className="text-right">
                <div className={`text-[10px] font-bold ${["active", "approved"].includes(a.status) ? "text-primary" : a.status === "declined" ? "text-destructive" : "text-amber-300"}`}>{a.status.replace(/_/g, " ")}</div>
                <div className="text-[9px] text-white/35">{a.provider || "unpriced"}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}