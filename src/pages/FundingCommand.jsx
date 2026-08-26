import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeDollarSign, CheckCircle2, CircleDot, ExternalLink, FileText, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_TONE = {
  verified: "text-emerald-300 border-emerald-400/20 bg-emerald-400/[0.05]",
  open: "text-emerald-300 border-emerald-400/20 bg-emerald-400/[0.05]",
  awarded: "text-emerald-300 border-emerald-400/20 bg-emerald-400/[0.05]",
  ready: "text-emerald-300 border-emerald-400/20 bg-emerald-400/[0.05]",
  preparing: "text-sky-300 border-sky-400/20 bg-sky-400/[0.05]",
  in_progress: "text-sky-300 border-sky-400/20 bg-sky-400/[0.05]",
  researching: "text-violet-300 border-violet-400/20 bg-violet-400/[0.05]",
  needs_user_action: "text-amber-300 border-amber-400/20 bg-amber-400/[0.05]",
  blocked: "text-red-300 border-red-400/20 bg-red-400/[0.05]",
  declined: "text-red-300 border-red-400/20 bg-red-400/[0.05]",
  closed: "text-white/45 border-white/10 bg-white/[0.03]",
  not_applicable: "text-white/45 border-white/10 bg-white/[0.03]",
};

function StatusPill({ status }) {
  const tone = STATUS_TONE[status] || "text-white/55 border-white/10 bg-white/[0.03]";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] uppercase ${tone}`}>{String(status || "unknown").replaceAll("_", " ")}</span>;
}

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function deadline(value) {
  if (!value) return "Rolling / none listed";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default function FundingCommand() {
  const [me, setMe] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [applications, setApplications] = useState([]);
  const [readiness, setReadiness] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const user = await base44.auth.me();
        if (!alive) return;
        setMe(user);
        if (user?.role !== "admin") return;
        const [p, a, r] = await Promise.all([
          base44.entities.FundingProgram.list("-fit_score", 100),
          base44.entities.FundingApplication.list("-last_updated_at", 100),
          base44.entities.VirginiaReadinessItem.list("category", 200),
        ]);
        if (!alive) return;
        setPrograms(p || []);
        setApplications(a || []);
        setReadiness(r || []);
      } catch (e) {
        if (alive) setError(e?.message || "Funding control data could not be loaded.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const summary = useMemo(() => {
    const verified = readiness.filter((x) => x.status === "verified").length;
    const blocked = readiness.filter((x) => x.status === "blocked").length;
    const action = readiness.filter((x) => x.status === "needs_user_action").length;
    const fundingBlockers = readiness.filter((x) => x.blocks_funding && !["verified", "not_applicable"].includes(x.status)).length;
    return { verified, blocked, action, fundingBlockers };
  }, [readiness]);

  const lead = useMemo(() => applications.find((x) => x.program_key === "nsf-mobility-2026"), [applications]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (me && me.role !== "admin") return <div className="p-6 text-center text-sm text-white/55">LOKIN Funding Command is restricted to administrators.</div>;

  return (
    <div className="p-4 pb-10 space-y-5">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.26em] text-primary/80"><ShieldCheck className="h-4 w-4" /> VIRGINIA FUNDING + READINESS</div>
        <h1 className="text-2xl font-bold font-heading metal-text">LOKIN Funding Command</h1>
        <p className="text-xs leading-relaxed text-white/50">Evidence-first campaign control for LOKIN AI and LOKIN Productions. A green app build never substitutes for a government filing, legal right, or physical-device validation.</p>
      </header>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-xs text-red-200">{error}</div>}

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><div className="text-[10px] text-white/40">VERIFIED GATES</div><div className="mt-1 text-2xl font-bold text-emerald-300">{summary.verified}</div></div>
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><div className="text-[10px] text-white/40">FUNDING BLOCKERS</div><div className="mt-1 text-2xl font-bold text-amber-300">{summary.fundingBlockers}</div></div>
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><div className="text-[10px] text-white/40">MANUAL ACTIONS</div><div className="mt-1 text-2xl font-bold text-sky-300">{summary.action}</div></div>
        <div className="rounded-2xl border border-white/10 lokin-panel p-3"><div className="text-[10px] text-white/40">TECH BLOCKED</div><div className="mt-1 text-2xl font-bold text-red-300">{summary.blocked}</div></div>
      </section>

      {lead && (
        <section className="rounded-3xl border border-primary/25 bg-primary/[0.04] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] tracking-[0.2em] text-primary/80">LEAD CAMPAIGN</div><h2 className="mt-1 text-lg font-bold text-white">NSF Mobility · LOKIN AI</h2></div><StatusPill status={lead.status} /></div>
          <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-white/35">Readiness</div><div className="mt-1 font-semibold text-white">{Math.round(Number(lead.readiness_score) || 0)}%</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-white/35">Target</div><div className="mt-1 font-semibold text-white">{money(lead.requested_amount_usd)}</div></div></div>
          <p className="text-xs leading-relaxed text-white/60">{lead.technical_narrative}</p>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] text-white/35">NEXT ACTION</div><p className="mt-1 text-xs text-white/70">{lead.next_action}</p></div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2"><BadgeDollarSign className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold text-white">Funding targets</h2></div>
        <div className="space-y-2">
          {programs.map((p) => (
            <article key={p.id} className="rounded-2xl border border-white/10 lokin-panel p-4 space-y-2">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-semibold text-white">{p.name}</h3><p className="mt-0.5 text-[10px] text-white/40">{p.sponsor} · {String(p.target_product || "").replaceAll("_", " ")}</p></div><div className="text-right shrink-0"><div className="text-lg font-bold text-primary">{Math.round(Number(p.fit_score) || 0)}</div><div className="text-[9px] text-white/35">FIT</div></div></div>
              <div className="flex flex-wrap items-center gap-2"><StatusPill status={p.status} /><span className="text-[10px] text-white/45">Up to {money(p.funding_max_usd)}</span><span className="text-[10px] text-white/45">{deadline(p.deadline)}</span></div>
              <p className="text-[11px] leading-relaxed text-white/55">{p.technical_fit}</p>
              <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5"><CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" /><p className="text-[10px] leading-relaxed text-white/55">{p.next_action}</p></div>
              {p.official_url && <a href={p.official_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 text-[10px] font-semibold text-primary">OFFICIAL SOURCE <ExternalLink className="h-3 w-3" /></a>}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-sky-300" /><h2 className="text-sm font-bold text-white">Applications</h2></div>
        {applications.map((a) => (
          <article key={a.id} className="rounded-2xl border border-white/10 lokin-panel p-4 space-y-2">
            <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-white">{a.program_key}</div><div className="mt-0.5 text-[10px] text-white/40">{String(a.application_stage || "").replaceAll("_", " ")} · {String(a.target_product || "").replaceAll("_", " ")}</div></div><StatusPill status={a.status} /></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, Number(a.readiness_score) || 0))}%` }} /></div>
            <div className="text-[10px] text-white/45">Internal evidence readiness {Math.round(Number(a.readiness_score) || 0)}%</div>
            {a.blockers?.length > 0 && <div className="space-y-1">{a.blockers.slice(0, 4).map((b, i) => <div key={`${a.id}-${i}`} className="flex gap-2 text-[10px] leading-relaxed text-amber-100/70"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />{b}</div>)}</div>}
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /><h2 className="text-sm font-bold text-white">Virginia readiness gates</h2></div>
        <div className="space-y-2">
          {readiness.map((r) => {
            const Icon = r.status === "verified" ? CheckCircle2 : r.status === "blocked" ? XCircle : AlertTriangle;
            return <article key={r.id} className="rounded-2xl border border-white/10 lokin-panel p-4 space-y-2"><div className="flex items-start gap-3"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${r.status === "verified" ? "text-emerald-300" : r.status === "blocked" ? "text-red-300" : "text-amber-300"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-semibold text-white">{r.requirement}</h3><StatusPill status={r.status} /></div><p className="mt-1 text-[10px] leading-relaxed text-white/45">{r.evidence}</p></div></div><div className="rounded-xl border border-white/10 bg-black/20 p-2.5"><div className="text-[9px] text-white/30">NEXT ACTION</div><p className="mt-1 text-[10px] leading-relaxed text-white/60">{r.next_action}</p></div></article>;
          })}
        </div>
      </section>
    </div>
  );
}
