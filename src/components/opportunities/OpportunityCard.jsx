import { ExternalLink, MapPin, Car, Briefcase, Clock, BadgeCheck, ShieldAlert, CheckCircle2 } from "lucide-react";
import { estimateNet, PAY_SOURCE_LABEL, SCHEDULE_LABEL, ROLE_LABEL } from "@/lib/opportunityEstimates";

export default function OpportunityCard({ opp, prefs, selected, onToggleSelect }) {
  const est = estimateNet(opp, prefs);
  const isW2 = (opp.employment_type || "").toUpperCase().includes("W-2") || (opp.employment_type || "").toUpperCase().includes("W2");
  const paySource = PAY_SOURCE_LABEL[opp.pay_source] || "Advertised";

  return (
    <div className={`rounded-2xl border p-3.5 transition-colors ${selected ? "border-primary/60 bg-primary/[0.06] glow-primary" : "border-white/10 lokin-panel"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={() => onToggleSelect(opp)}
            aria-label={selected ? "Deselect for compare" : "Select for compare"}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-white/25 bg-white/5"}`}
          >
            {selected && <CheckCircle2 className="h-4 w-4" />}
          </button>
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm leading-tight truncate">{opp.title}</div>
            <div className="text-xs text-white/45 truncate">{opp.platform || opp.company || opp.source}</div>
          </div>
        </div>
        {opp.pay && <div className="text-sm font-bold text-primary shrink-0 text-right">{opp.pay}</div>}
      </div>

      {/* transparency badges */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${isW2 ? "border-accent/40 text-accent bg-accent/10" : "border-primary/30 text-primary bg-primary/10"}`}>
          {opp.employment_type || "—"}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] text-white/55 border border-white/10 bg-white/5">
          {paySource}
        </span>
        {opp.pay_basis && opp.pay_basis !== "hourly" && (
          <span className="rounded-full px-2 py-0.5 text-[10px] text-white/55 border border-white/10 bg-white/5 capitalize">
            {opp.pay_basis.replace(/_/g, " ")}
          </span>
        )}
        {opp.schedule && (
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-white/55 border border-white/10 bg-white/5">
            <Clock className="h-2.5 w-2.5" />{SCHEDULE_LABEL[opp.schedule] || opp.schedule}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/55">
        {opp.role_type && opp.role_type !== "any" && (
          <span className="flex items-center gap-1"><Car className="h-3 w-3 text-primary" />{ROLE_LABEL[opp.role_type] || opp.role_type}</span>
        )}
        {opp.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{opp.location}</span>}
        <span className="flex items-center gap-1"><Briefcase className="h-3 w-3 text-primary" />{opp.category.replace(/_/g, " ")}</span>
      </div>

      {/* estimated economics */}
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg border border-white/8 bg-black/20 py-1.5">
          <div className="text-[9px] uppercase text-white/35">Gross/wk</div>
          <div className="text-xs font-bold text-white/85">${est.gross}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/20 py-1.5">
          <div className="text-[9px] uppercase text-white/35">Est. vehicle</div>
          <div className="text-xs font-bold text-destructive/80">-${est.vehicleCost}</div>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/[0.06] py-1.5">
          <div className="text-[9px] uppercase text-white/40">Net/hr</div>
          <div className="text-xs font-bold text-primary">${est.netPerHour}</div>
        </div>
      </div>

      {(opp.vehicle_requirements || opp.qualifications) && (
        <div className="mt-2 text-[11px] text-white/50 space-y-0.5">
          {opp.vehicle_requirements && <div><span className="text-white/35">Vehicle:</span> {opp.vehicle_requirements}</div>}
          {opp.qualifications && <div><span className="text-white/35">Quals:</span> {opp.qualifications}</div>}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-white/35">
          <BadgeCheck className="h-3 w-3" />{opp.verified_at ? `Verified ${opp.verified_at}` : opp.source || "Public listing"}
        </span>
        {opp.apply_url ? (
          <a href={opp.apply_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:scale-95 transition-transform">
            Apply <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-white/30"><ShieldAlert className="h-3 w-3" />No direct link</span>
        )}
      </div>
    </div>
  );
}