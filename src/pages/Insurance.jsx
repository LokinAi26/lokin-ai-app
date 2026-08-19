import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2, Clock, FileText, Car } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const COVERAGE = [
  { id: "commercial_gig", label: "Commercial / Gig", desc: "On-demand delivery & 1099 use", icon: Car },
  { id: "auto_personal", label: "Auto (Personal)", desc: "Personal vehicle protection", icon: Car },
  { id: "cargo", label: "Cargo", desc: "Goods in transit coverage", icon: FileText },
  { id: "health_gap", label: "Health Gap", desc: "Out-of-pocket gap coverage", icon: ShieldCheck },
  { id: "roadside", label: "Roadside", desc: "Tow, jump, lockout", icon: ShieldCheck },
];

const STATUS_META = {
  submitted: { label: "Submitted", color: "text-amber-300", icon: Clock },
  under_review: { label: "Under review", color: "text-amber-300", icon: Clock },
  approved: { label: "Approved", color: "text-primary", icon: CheckCircle2 },
  active: { label: "Active", color: "text-primary", icon: CheckCircle2 },
  declined: { label: "Declined", color: "text-destructive", icon: FileText },
};

function Field({ label, value }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-2">
      <div className="text-[9px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="text-white/80 capitalize truncate">{value || "—"}</div>
    </div>
  );
}

export default function Insurance() {
  const { toast } = useToast();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ coverage_type: "commercial_gig", vehicle_year: "", vehicle_make: "", vehicle_model: "", vehicle_type: "personal_car", license_number: "", state: "", dob: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const list = await base44.entities.InsuranceApplication.list("-created_date", 10);
      setApp((list || [])[0] || null);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.license_number.trim() || !form.state.trim() || !form.dob) {
      toast({ title: "Please complete license, state & DOB", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let user = null;
      try { user = await base44.auth.me(); } catch {}
      await base44.entities.InsuranceApplication.create({
        user_id: user?.id || null,
        coverage_type: form.coverage_type,
        vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
        vehicle_make: form.vehicle_make.trim(),
        vehicle_model: form.vehicle_model.trim(),
        vehicle_type: form.vehicle_type,
        license_number: form.license_number.trim(),
        state: form.state.trim(),
        dob: form.dob,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      toast({ title: "Application submitted", description: "We'll review and confirm your coverage." });
      load();
    } catch (e) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">LOKIN Cover</h1>
      </div>
      <p className="text-sm text-white/50">Get correctly covered for the work you actually do — gig, commercial, cargo & more.</p>

      {app && (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 space-y-3">
          {(() => {
            const S = STATUS_META[app.status] || STATUS_META.submitted;
            const SIcon = S.icon;
            return (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><SIcon className={`h-4 w-4 ${S.color}`} /><span className={`text-sm font-bold ${S.color}`}>{S.label}</span></div>
                  <span className="text-[10px] text-white/40">{new Date(app.submitted_at || app.created_date).toLocaleDateString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Field label="Coverage" value={app.coverage_type.replace(/_/g, " ")} />
                  <Field label="Vehicle" value={[app.vehicle_year, app.vehicle_make, app.vehicle_model].filter(Boolean).join(" ") || "—"} />
                  <Field label="Provider" value={app.provider || "Pending"} />
                  <Field label="Monthly" value={app.monthly_premium ? `$${Number(app.monthly_premium).toFixed(2)}` : "—"} />
                  <Field label="Policy #" value={app.policy_number || "—"} />
                  <Field label="Liability" value={app.liability_limit ? `$${Number(app.liability_limit).toLocaleString()}` : "—"} />
                  <Field label="Effective" value={app.effective_date || "—"} />
                  <Field label="Expires" value={app.expires_at || "—"} />
                </div>
                {app.notes && <div className="text-[11px] text-white/50 border-l border-white/10 pl-2">{app.notes}</div>}
                {!["active", "approved"].includes(app.status) && <div className="text-[11px] text-white/40 text-center">Under review — we'll activate your coverage shortly.</div>}
              </>
            );
          })()}
        </div>
      )}

      {!app && (
        <div className="space-y-4">
          <div>
            <div className="text-[11px] tracking-[0.2em] text-white/40 font-display mb-2">COVERAGE TYPE</div>
            <div className="grid grid-cols-1 gap-2">
              {COVERAGE.map((c) => (
                <button key={c.id} onClick={() => set("coverage_type", c.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${form.coverage_type === c.id ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/[0.03]"}`}>
                  <c.icon className={`h-5 w-5 ${form.coverage_type === c.id ? "text-primary" : "text-white/50"}`} />
                  <div>
                    <div className="text-sm font-semibold text-white">{c.label}</div>
                    <div className="text-[11px] text-white/45">{c.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-3">
            <div className="text-[11px] tracking-[0.2em] text-white/40 font-display">VEHICLE</div>
            <div className="grid grid-cols-3 gap-2">
              <input value={form.vehicle_year} onChange={(e) => set("vehicle_year", e.target.value)} placeholder="Year" className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-sm text-white outline-none placeholder:text-white/30" />
              <input value={form.vehicle_make} onChange={(e) => set("vehicle_make", e.target.value)} placeholder="Make" className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-sm text-white outline-none placeholder:text-white/30" />
              <input value={form.vehicle_model} onChange={(e) => set("vehicle_model", e.target.value)} placeholder="Model" className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-sm text-white outline-none placeholder:text-white/30" />
            </div>
            <select value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none">
              <option value="personal_car">Personal car</option>
              <option value="cargo_van">Cargo van</option>
              <option value="box_truck">Box truck</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-3">
            <div className="text-[11px] tracking-[0.2em] text-white/40 font-display">LICENSE & IDENTITY</div>
            <input value={form.license_number} onChange={(e) => set("license_number", e.target.value)} placeholder="Driver license number" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="State (e.g. VA)" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30" />
              <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none" />
            </div>
          </div>

          <button onClick={submit} disabled={submitting} className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-bold glow-primary active:scale-[0.98] disabled:opacity-50">
            {submitting ? "Submitting…" : "Apply for coverage"}
          </button>
        </div>
      )}
    </div>
  );
}