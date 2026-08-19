import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2, Clock, FileText, Car, ChevronRight, ChevronLeft, Package, Truck, HeartPulse, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const COVERAGE = [
  { id: "commercial_gig", label: "Commercial / Gig", desc: "On-demand delivery & 1099 work", icon: Car, perks: ["Liability while on deliveries", "Uninsured motorist", "Medical payments"] },
  { id: "auto_personal", label: "Auto (Personal)", desc: "Everyday personal vehicle protection", icon: Car, perks: ["Collision & comprehensive", "Property damage", "Rideshare endorsement"] },
  { id: "cargo", label: "Cargo", desc: "Goods in transit coverage", icon: Package, perks: ["Theft & loss of cargo", "Loading/unloading", "Reefer breakdown"] },
  { id: "health_gap", label: "Health Gap", desc: "Out-of-pocket gap coverage", icon: HeartPulse, perks: ["ER & urgent care gap", "Accident medical", "Income protection"] },
  { id: "roadside", label: "Roadside", desc: "Tow, jump, lockout, fuel", icon: Wrench, perks: ["24/7 towing", "Flat tire & battery", "Lockout service"] },
];

const STATUS_META = {
  submitted: { label: "Submitted", color: "text-amber-300", icon: Clock },
  under_review: { label: "Under review", color: "text-amber-300", icon: Clock },
  approved: { label: "Approved", color: "text-primary", icon: CheckCircle2 },
  active: { label: "Active", color: "text-primary", icon: CheckCircle2 },
  declined: { label: "Declined", color: "text-destructive", icon: FileText },
};

const STEPS = ["Coverage", "Vehicle", "Identity", "Review"];

function Field({ label, value }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-2">
      <div className="text-[9px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="text-white/80 capitalize truncate">{value || "—"}</div>
    </div>
  );
}

function estimateQuote(form) {
  const base = { commercial_gig: 89, auto_personal: 72, cargo: 120, health_gap: 45, roadside: 19 }[form.coverage_type] || 80;
  const vehicleAdj = { personal_car: 1, cargo_van: 1.35, box_truck: 1.6, other: 1.2 }[form.vehicle_type] || 1;
  const yearAdj = form.vehicle_year && Number(form.vehicle_year) < 2015 ? 1.1 : 1;
  const mid = Math.round(base * vehicleAdj * yearAdj);
  return { low: Math.round(mid * 0.85), high: Math.round(mid * 1.2) };
}

function inputCls() {
  return "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/30";
}

export default function Insurance() {
  const { toast } = useToast();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    coverage_type: "commercial_gig",
    vehicle_year: "", vehicle_make: "", vehicle_model: "", vehicle_type: "personal_car",
    license_number: "", state: "", dob: "",
  });

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

  function canAdvance() {
    if (step === 0) return Boolean(form.coverage_type);
    if (step === 1) return Boolean(form.vehicle_make.trim() && form.vehicle_model.trim() && form.vehicle_year);
    if (step === 2) return Boolean(form.license_number.trim() && form.state.trim() && form.dob);
    return true;
  }

  async function submit() {
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
      toast({ title: "Application submitted", description: "Your application is ready for review. This submission does not create insurance coverage." });
      load();
    } catch (e) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const activeCoverage = COVERAGE.find((c) => c.id === form.coverage_type);
  const est = estimateQuote(form);

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">LOKIN Cover</h1>
      </div>
      <p className="text-sm text-white/50">Apply for driver-focused coverage and track carrier review in one place. Coverage starts only after an authorized carrier confirms the policy is active.</p>

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
                {!["active", "approved"].includes(app.status) && (
                  <div className="text-[11px] text-white/40 text-center pt-1">Under review — no coverage is active until a carrier-confirmed policy appears here.</div>
                )}
                {app.status === "active" && app.effective_date && (
                  <div className="text-[11px] text-primary text-center pt-1">You're covered. Keep this page for your records.</div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {!app && (
        <div className="space-y-4">
          {/* progress */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={`h-1 rounded-full ${i <= step ? "bg-primary" : "bg-white/10"}`} />
                <div className={`mt-1 text-[9px] tracking-wide ${i === step ? "text-primary font-bold" : "text-white/35"}`}>{i + 1}. {s}</div>
              </div>
            ))}
          </div>

          {/* step 1 — coverage */}
          {step === 0 && (
            <div className="space-y-2">
              {COVERAGE.map((c) => (
                <button key={c.id} onClick={() => set("coverage_type", c.id)} className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition ${form.coverage_type === c.id ? "border-primary/50 bg-primary/10 glow-primary" : "border-white/10 bg-white/[0.03]"}`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${form.coverage_type === c.id ? "bg-primary/15 text-primary" : "bg-white/5 text-white/50"}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{c.label}</div>
                    <div className="text-[11px] text-white/45">{c.desc}</div>
                  </div>
                  {form.coverage_type === c.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
              {activeCoverage && (
                <div className="rounded-2xl border border-white/10 lokin-panel p-3">
                  <div className="text-[10px] tracking-[0.18em] text-white/40 font-display mb-2">WHAT'S INCLUDED</div>
                  <ul className="space-y-1.5">
                    {activeCoverage.perks.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-xs text-white/70"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" /> {p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* step 2 — vehicle */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-3">
                <div className="text-[11px] tracking-[0.2em] text-white/40 font-display">VEHICLE</div>
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.vehicle_year} onChange={(e) => set("vehicle_year", e.target.value)} inputMode="numeric" placeholder="Year" className={inputCls()} />
                  <input value={form.vehicle_make} onChange={(e) => set("vehicle_make", e.target.value)} placeholder="Make" className={inputCls()} />
                  <input value={form.vehicle_model} onChange={(e) => set("vehicle_model", e.target.value)} placeholder="Model" className={inputCls()} />
                </div>
                <select value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} className={inputCls()}>
                  <option value="personal_car">Personal car</option>
                  <option value="cargo_van">Cargo van</option>
                  <option value="box_truck">Box truck</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* step 3 — identity */}
          {step === 2 && (
            <div className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-3">
              <div className="text-[11px] tracking-[0.2em] text-white/40 font-display">LICENSE & IDENTITY</div>
              <input value={form.license_number} onChange={(e) => set("license_number", e.target.value)} placeholder="Driver license number" className={inputCls()} />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="State (e.g. VA)" className={inputCls()} />
                <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} className={inputCls()} />
              </div>
              <div className="text-[10px] text-white/35">Your details are stored securely and reviewed to bind your policy.</div>
            </div>
          )}

          {/* step 4 — review */}
          {step === 3 && (
            <div className="rounded-2xl border border-white/10 lokin-panel p-3 space-y-2">
              <div className="text-[11px] tracking-[0.2em] text-white/40 font-display mb-1">REVIEW & SUBMIT</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Field label="Coverage" value={activeCoverage?.label || form.coverage_type.replace(/_/g, " ")} />
                <Field label="Vehicle type" value={form.vehicle_type.replace(/_/g, " ")} />
                <Field label="Vehicle" value={[form.vehicle_year, form.vehicle_make, form.vehicle_model].filter(Boolean).join(" ") || "—"} />
                <Field label="License state" value={form.state || "—"} />
                <Field label="DOB" value={form.dob || "—"} />
                <Field label="License #" value={form.license_number ? "••••" + form.license_number.slice(-3) : "—"} />
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-2.5 text-center">
                <div className="text-[9px] uppercase tracking-wide text-white/40">Estimated monthly premium</div>
                <div className="text-lg font-display font-bold text-primary">${est.low}–${est.high}</div>
                <div className="text-[9px] text-white/35">Final rate set after underwriter review</div>
              </div>
              <p className="text-[10px] text-white/35 pt-1">By submitting you authorize LOKIN Cover to verify your details and quote your policy. No charge until you approve the quote.</p>
            </div>
          )}

          {/* nav buttons */}
          <div className="flex gap-2 pt-1">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 active:scale-95 transition-transform">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={() => canAdvance() && setStep((s) => s + 1)} disabled={!canAdvance()} className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-bold glow-primary active:scale-[0.98] disabled:opacity-40 transition-transform">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-bold glow-primary active:scale-[0.98] disabled:opacity-50 transition-transform">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><ShieldCheck className="h-4 w-4" /> Submit application</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}