import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Clock3,
  Database,
  Gauge,
  MapPinned,
  RefreshCcw,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import LocalOfferCapture from "@/components/LocalOfferCapture";
import PullToRefresh from "@/components/PullToRefresh";

const ACTION_STYLE = {
  TAKE: "border-primary/45 bg-primary/[0.09] text-primary",
  CONSIDER: "border-amber-400/40 bg-amber-400/[0.08] text-amber-300",
  PASS: "border-red-400/40 bg-red-400/[0.08] text-red-300",
};

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : "—";
}

function timeToGoal(minutes) {
  if (minutes === null || minutes === undefined || minutes === "") return "Waiting for a qualifying offer";
  const value = Number(minutes);
  if (!Number.isFinite(value)) return "Waiting for a qualifying offer";
  if (value <= 0) return "Goal reached";
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (!hours) return `~${mins} min`;
  return `~${hours}h ${mins}m`;
}

export default function EarningsIntelligence() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("earnings-intelligence", { persist: true });
      setData(response.data);
    } catch (nextError) {
      setError(nextError?.response?.data?.error || nextError?.message || "Could not load Earnings Intelligence");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mission = data?.mission || {};
  const decisions = data?.decisions || [];
  const top = mission.top_decision || decisions[0] || null;
  const takeCount = useMemo(() => decisions.filter((item) => item.action === "TAKE").length, [decisions]);
  const considerCount = useMemo(() => decisions.filter((item) => item.action === "CONSIDER").length, [decisions]);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-4 p-4 pb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="lokin-kicker lokin-kicker-lime flex items-center gap-2">
              <BrainCircuit className="h-4 w-4" /> LOKIN DRIVER
            </div>
            <h1 className="lokin-wordmark mt-1 text-2xl font-black font-heading">Earnings Intelligence</h1>
            <p className="mt-1 text-xs leading-relaxed text-white/45">Optimize earnings velocity, not just individual order price.</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-primary disabled:opacity-50"
            aria-label="Refresh Earnings Intelligence"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="lokin-card p-5 radial-fade">
          <div className="flex items-center justify-between gap-3">
            <div className="lokin-kicker lokin-kicker-lime">EARNINGS MISSION</div>
            <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-black/30 px-2.5 py-1 text-[9px] font-bold text-primary">
              <Activity className="h-3 w-3" /> LIVE DECISION LOOP
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="lokin-kicker">Daily goal</div>
              <div className="lokin-hero-number text-4xl font-black font-display">{money(mission.goal)}</div>
            </div>
            <div className="text-right">
              <div className="lokin-kicker">Remaining</div>
              <div className="lokin-hero-number text-2xl font-black font-display">{money(mission.remaining)}</div>
            </div>
          </div>

          <div className="lokin-progress-track mt-4 h-2.5">
            <div
              className="lokin-progress-fill transition-all"
              style={{ width: `${Math.max(0, Math.min(100, Number(mission.goal_progress_pct || 0)))}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-white/40">
            <span>{money(mission.earned)} earned</span>
            <span>{Number(mission.goal_progress_pct || 0)}%</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <MissionMetric icon={TrendingUp} label="Earnings velocity" value={`${money(mission.current_earnings_velocity)}/hr`} accent />
            <MissionMetric icon={Clock3} label="Projected goal time" value={timeToGoal(mission.projected_minutes_to_goal)} />
          </div>

        </div>

        <div className="lokin-card p-5 glow-primary">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="lokin-kicker lokin-kicker-lime">Next best action</div>
              <div className="mt-1 text-base font-bold leading-relaxed text-white">{mission.next_action || "Waiting for current verified offers."}</div>
            </div>
          </div>
        </div>

        {loading && !data && (
          <div className="space-y-2 rounded-3xl border border-white/10 lokin-panel p-4">
            <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/[0.06]" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/[0.06]" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {top && (
          <div className="lokin-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <Gauge className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="lokin-kicker">Top current decision</div>
                <div className="truncate text-base font-black text-white">{top.merchant}</div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-black ${ACTION_STYLE[top.action] || ACTION_STYLE.CONSIDER}`}>{top.action}</div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
              <DecisionMetric label="LOKIN" value={`${top.score}/100`} />
              <DecisionMetric label="Net/hr" value={money(top.economics?.projected_net_per_hour)} accent />
              <DecisionMetric label="Net/mi" value={money(top.economics?.projected_net_per_mile)} accent />
              <DecisionMetric label="Next 60" value={money(top.velocity?.earnings_velocity)} accent />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <SmallScore icon={MapPinned} label="Destination" value={top.destination?.score} />
              <SmallScore icon={Route} label="Sequence" value={top.sequence?.score} />
              <SmallScore icon={Gauge} label="Low friction" value={top.friction?.score} />
            </div>

            <div className="mt-3 rounded-2xl border border-white/8 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Why LOKIN ranked it here</div>
              <ul className="mt-2 space-y-1.5">
                {(top.explain?.reasons || []).map((reason, index) => (
                  <li key={`${reason}-${index}`} className="flex gap-2 text-xs leading-relaxed text-white/65">
                    <span className="text-primary">›</span><span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {top.sequence?.next_offer_merchant && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 text-xs text-white/65">
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                Follow-on signal near destination: <span className="font-bold text-white">{top.sequence.next_offer_merchant}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link to="/route" className="lokin-cta lokin-cta-sm flex items-center justify-center gap-2 text-xs font-black">
            <Route className="h-4 w-4" /> ROUTE OPTIMIZER
          </Link>
          <Link to="/driver-platforms" className="lokin-ghost flex w-full items-center justify-center gap-2 px-3 py-3 text-xs font-black">
            <Database className="h-4 w-4" /> DATA SOURCES
          </Link>
        </div>

        <LocalOfferCapture onSaved={load} />

        <div className="lokin-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-white">Current verified opportunities</div>
              <div className="mt-0.5 text-[10px] text-white/40">Ranked by projected earnings velocity</div>
            </div>
            <div className="text-right text-[10px] text-white/45">
              <div><span className="font-bold text-primary">{takeCount}</span> take</div>
              <div><span className="font-bold text-amber-300">{considerCount}</span> consider</div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {decisions.map((decision, index) => (
              <div key={decision.offer_id || index} className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black text-xs font-black text-primary">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-bold text-white">{decision.merchant}</div>
                      <span className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${ACTION_STYLE[decision.action] || ACTION_STYLE.CONSIDER}`}>{decision.action}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/45">
                      <span>score <b className="text-white">{decision.score}</b></span>
                      <span>net/hr <b className="text-primary">{money(decision.economics?.projected_net_per_hour)}</b></span>
                      <span>velocity <b className="text-primary">{money(decision.velocity?.earnings_velocity)}</b></span>
                      <span>follow-on <b className="text-white">{decision.destination?.follow_on_count || 0}</b></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!loading && decisions.length === 0 && (
              <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-center text-xs leading-relaxed text-white/45">
                No current verified offers are available. Add an offer you can currently see in a delivery app, or connect an authorized data source when available.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-[10px] leading-relaxed text-white/50">
              <span className="font-bold text-primary">Driver control stays mandatory.</span> LOKIN scores and recommends only. It does not auto-accept, auto-decline, intercept, scrape, spoof GPS, manipulate matching, or bypass third-party platform controls.
            </div>
          </div>
        </div>

        <div className="text-center text-[9px] uppercase tracking-[0.18em] text-white/25">
          {data?.engine_version || "LOKIN EARNINGS INTELLIGENCE"} · {data?.source?.market || "VIRGINIA-FIRST"}
        </div>
      </div>
    </PullToRefresh>
  );
}

function MissionMetric({ icon: Icon, label, value, accent = false }) {
  return (
    <div className="lokin-stat-tile">
      <div className="flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-wider text-white/35"><Icon className="h-3 w-3 text-primary" />{label}</div>
      <div className={`lokin-stat-value mt-1 text-sm ${accent ? "" : "text-white"}`}>{value}</div>
    </div>
  );
}

function DecisionMetric({ label, value, accent = false }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/25 px-1 py-2.5">
      <div className={`truncate text-xs font-black ${accent ? "text-primary" : "text-white"}`}>{value}</div>
      <div className="mt-0.5 text-[8px] uppercase tracking-wide text-white/30">{label}</div>
    </div>
  );
}

function SmallScore({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-2">
      <Icon className="mx-auto h-3.5 w-3.5 text-primary" />
      <div className="mt-1 text-sm font-black text-white">{Number(value || 0)}</div>
      <div className="text-[8px] uppercase tracking-wide text-white/30">{label}</div>
    </div>
  );
}
