import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, BrainCircuit, Calculator, CheckCircle2, ChevronRight, CircleOff, ClipboardCheck, LockKeyhole, Save, ShieldCheck, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LESSONS, PLAYBOOK_VERSION, SAMPLE_CANDLES, calculatePositionSize, evaluateSetup } from "@/lib/traderPlaybookEngine";

const TABS = [
  { id: "learn", label: "Learn", icon: BookOpen },
  { id: "analyze", label: "Analyze", icon: BarChart3 },
  { id: "practice", label: "Practice", icon: Calculator },
  { id: "journal", label: "Journal", icon: ClipboardCheck },
];

const INITIAL_PLAN = {
  symbol: "DEMO", direction: "long", setup_name: "Breakout & retest", timeframe: "15m",
  entry: "100", stop: "98", target: "104", thesis: "", invalidation: "",
  trendAligned: true, atLevel: true, triggerConfirmed: false, volumeConfirmed: false, newsClear: true,
};

export default function TradersPlaybook() {
  const [tab, setTab] = useState("learn");
  const [profile, setProfile] = useState(null);
  const [progress, setProgress] = useState([]);
  const [trades, setTrades] = useState([]);
  const [plan, setPlan] = useState(INITIAL_PLAN);
  const [accountSize, setAccountSize] = useState("10000");
  const [riskPct, setRiskPct] = useState("0.5");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [journal, setJournal] = useState({ emotion_before: "calm", followed_plan: true, discipline_grade: "A", what_worked: "", what_failed: "", next_adjustment: "" });

  async function load() {
    try {
      const [profiles, lessonRows, paperRows] = await Promise.all([
        base44.entities.TraderProfile.filter({}),
        base44.entities.TraderLessonProgress.list("-created_date", 100),
        base44.entities.PaperTrade.list("-created_date", 50),
      ]);
      const current = profiles[0] || null;
      setProfile(current);
      setProgress(lessonRows);
      setTrades(paperRows);
      if (current) {
        setAccountSize(String(current.paper_account_size || 10000));
        setRiskPct(String(current.risk_per_trade_pct || 0.5));
      }
    } catch (error) {
      setMessage(error?.message || "Could not load the playbook.");
    }
  }

  useEffect(() => { load(); }, []);

  const evaluation = useMemo(() => evaluateSetup(plan), [plan]);
  const sizing = useMemo(() => calculatePositionSize({ accountSize, riskPct, entry: plan.entry, stop: plan.stop }), [accountSize, riskPct, plan.entry, plan.stop]);
  const completedIds = new Set(progress.filter((item) => item.status === "completed").map((item) => item.lesson_id));
  const completedCount = completedIds.size;

  async function acknowledge() {
    setSaving(true);
    setMessage("");
    const payload = {
      experience_level: profile?.experience_level || "beginner",
      paper_account_size: Number(accountSize),
      risk_per_trade_pct: Number(riskPct),
      daily_loss_limit_pct: profile?.daily_loss_limit_pct || 2,
      education_acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    };
    try {
      const next = profile ? await base44.entities.TraderProfile.update(profile.id, payload) : await base44.entities.TraderProfile.create(payload);
      setProfile(next);
      setMessage("Education and simulation mode activated.");
    } catch (error) {
      setMessage(error?.message || "Could not activate the playbook.");
    } finally {
      setSaving(false);
    }
  }

  async function completeLesson(lessonId) {
    const existing = progress.find((item) => item.lesson_id === lessonId);
    const payload = { lesson_id: lessonId, status: "completed", quiz_score: 100, attempts: (existing?.attempts || 0) + 1, completed_at: new Date().toISOString() };
    try {
      const saved = existing ? await base44.entities.TraderLessonProgress.update(existing.id, payload) : await base44.entities.TraderLessonProgress.create(payload);
      setProgress((rows) => existing ? rows.map((row) => row.id === existing.id ? saved : row) : [saved, ...rows]);
    } catch (error) {
      setMessage(error?.message || "Could not save lesson progress.");
    }
  }

  async function savePaperTrade() {
    if (!profile?.education_acknowledged) {
      setMessage("Activate education and simulation mode first.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        symbol: plan.symbol.trim().toUpperCase() || "DEMO",
        asset_class: "stock",
        direction: plan.direction,
        setup_name: plan.setup_name,
        timeframe: plan.timeframe,
        entry_price: Number(plan.entry),
        stop_price: Number(plan.stop),
        target_price: Number(plan.target),
        quantity: sizing.valid ? sizing.quantity : 0,
        risk_amount: sizing.valid ? sizing.riskAmount : 0,
        reward_risk_ratio: evaluation.ratio,
        thesis: plan.thesis,
        invalidation: plan.invalidation || `Price reaches ${plan.stop}`,
        checklist_score: evaluation.score,
        decision: evaluation.decision,
        status: "planned",
      };
      const created = await base44.entities.PaperTrade.create(payload);
      setTrades((rows) => [created, ...rows]);
      setMessage(evaluation.decision === "PAPER_TRADE" ? "Paper plan saved. No live order was sent." : "NO TRADE decision saved for review.");
      setTab("journal");
    } catch (error) {
      setMessage(error?.message || "Could not save the paper plan.");
    } finally {
      setSaving(false);
    }
  }

  async function saveJournal() {
    setSaving(true);
    try {
      await base44.entities.TradeJournalEntry.create({
        ...journal,
        paper_trade_id: trades[0]?.id || "",
        setup_name: trades[0]?.setup_name || plan.setup_name,
        reviewed_at: new Date().toISOString(),
      });
      setJournal({ emotion_before: "calm", followed_plan: true, discipline_grade: "A", what_worked: "", what_failed: "", next_adjustment: "" });
      setMessage("Journal review saved.");
    } catch (error) {
      setMessage(error?.message || "Could not save the journal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-4 pb-10">
      <div className="lokin-kicker lokin-kicker-lime">PLAYBOOK</div>
      <header>
        <div className="flex items-center gap-2 text-[10px] font-display tracking-[0.2em] text-primary"><BrainCircuit className="h-4 w-4" /> LOKIN INTELLIGENCE</div>
        <h1 className="mt-1 text-2xl font-black font-heading metal-text">Trader&apos;s Playbook</h1>
        <p className="mt-1 text-xs leading-relaxed text-white/50">Learn the market. Explain the setup. Practice the process. Protect the downside.</p>
      </header>

      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.055] p-3">
        <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p className="text-[10px] leading-relaxed text-white/60"><b className="text-amber-200">Education and simulation only.</b> LOKIN does not provide personalized investment advice, guarantee outcomes, connect to a brokerage, or place trades in this release. Market data on this screen is simulated.</p></div>
      </div>

      {!profile?.education_acknowledged && (
        <div className="rounded-3xl border border-primary/25 bg-primary/[0.05] p-4">
          <div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-primary" /><div><div className="text-sm font-black">Activate learning mode</div><div className="text-[10px] text-white/45">Paper practice stays separated from real money.</div></div></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><Field label="Paper account" value={accountSize} onChange={setAccountSize} type="number" /><Field label="Risk per trade %" value={riskPct} onChange={setRiskPct} type="number" /></div>
          <button onClick={acknowledge} disabled={saving} className="mt-3 w-full rounded-2xl bg-primary py-3 text-xs font-black text-black disabled:opacity-50">I UNDERSTAND — START LEARNING</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Lessons" value={`${completedCount}/${LESSONS.length}`} />
        <Metric label="Paper plans" value={trades.length} />
        <Metric label="Max risk" value={`${riskPct}%`} accent />
      </div>

      <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/[0.025] p-1">
        {TABS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`rounded-xl py-2 text-[9px] font-bold transition-colors ${tab === id ? "bg-primary text-black" : "text-white/50"}`}><Icon className="mx-auto mb-1 h-4 w-4" />{label}</button>)}
      </nav>

      {message && <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3 text-xs text-white/70">{message}</div>}

      {tab === "learn" && <LearnPanel completedIds={completedIds} onComplete={completeLesson} />}
      {tab === "analyze" && <AnalyzePanel plan={plan} setPlan={setPlan} evaluation={evaluation} />}
      {tab === "practice" && <PracticePanel plan={plan} setPlan={setPlan} accountSize={accountSize} setAccountSize={setAccountSize} riskPct={riskPct} setRiskPct={setRiskPct} sizing={sizing} evaluation={evaluation} onSave={savePaperTrade} saving={saving} />}
      {tab === "journal" && <JournalPanel trades={trades} journal={journal} setJournal={setJournal} onSave={saveJournal} saving={saving} />}

      <div className="text-center text-[9px] uppercase tracking-[0.18em] text-white/25">{PLAYBOOK_VERSION} · LIVE EXECUTION DISABLED</div>
    </div>
  );
}

function LearnPanel({ completedIds, onComplete }) {
  return <div className="space-y-2">{LESSONS.map((lesson, index) => {
    const done = completedIds.has(lesson.id);
    return <div key={lesson.id} className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
      <div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${done ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-white/45"}`}>{done ? <CheckCircle2 className="h-5 w-5" /> : index + 1}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="text-sm font-black">{lesson.title}</h3><span className="ml-auto text-[9px] text-white/35">{lesson.minutes} MIN</span></div><div className="text-[9px] uppercase tracking-wider text-primary/70">{lesson.level}</div><p className="mt-2 text-xs leading-relaxed text-white/55">{lesson.summary}</p><div className="mt-2 rounded-xl border border-white/8 bg-black/25 p-2 text-[10px] text-white/65"><b className="text-primary">PLAYBOOK RULE:</b> {lesson.rule}</div><button onClick={() => onComplete(lesson.id)} disabled={done} className="mt-3 flex items-center gap-1 text-[10px] font-black text-primary disabled:text-white/30">{done ? "COMPLETED" : "MARK LESSON COMPLETE"} <ChevronRight className="h-3 w-3" /></button></div></div>
    </div>;
  })}</div>;
}

function AnalyzePanel({ plan, setPlan, evaluation }) {
  return <div className="space-y-3">
    <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
      <div className="flex items-center justify-between"><div><div className="text-sm font-black">Simulated chart lab</div><div className="text-[10px] text-white/40">Practice reading context without financial exposure</div></div><span className="rounded-full border border-white/10 px-2 py-1 text-[8px] text-white/40">DEMO DATA</span></div>
      <CandleChart />
      <div className="grid grid-cols-2 gap-2"><Select label="Direction" value={plan.direction} onChange={(v) => setPlan({ ...plan, direction: v })} options={[["long","Long"],["short","Short"]]} /><Select label="Timeframe" value={plan.timeframe} onChange={(v) => setPlan({ ...plan, timeframe: v })} options={[["5m","5 minute"],["15m","15 minute"],["1h","1 hour"],["4h","4 hour"]]} /></div>
    </div>
    <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
      <div className="flex items-center justify-between"><div className="text-sm font-black">Setup validation</div><DecisionBadge evaluation={evaluation} /></div>
      <div className="mt-3 space-y-2">{[
        ["trendAligned","Higher-timeframe trend agrees"],
        ["atLevel","At defined support/resistance"],
        ["triggerConfirmed","Entry trigger confirmed"],
        ["volumeConfirmed","Volume/participation confirms"],
        ["newsClear","Scheduled-news risk checked"],
      ].map(([key,label]) => <ToggleRow key={key} label={label} checked={plan[key]} onChange={() => setPlan({ ...plan, [key]: !plan[key] })} />)}</div>
      <div className="mt-3 grid grid-cols-3 gap-2"><Field label="Entry" value={plan.entry} onChange={(v) => setPlan({ ...plan, entry: v })} type="number" /><Field label="Stop" value={plan.stop} onChange={(v) => setPlan({ ...plan, stop: v })} type="number" /><Field label="Target" value={plan.target} onChange={(v) => setPlan({ ...plan, target: v })} type="number" /></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Checklist" value={`${evaluation.score}/100`} accent={evaluation.score >= 75} /><Metric label="Reward / risk" value={evaluation.ratio ? `${evaluation.ratio.toFixed(2)}R` : "—"} accent={evaluation.ratio >= 2} /></div>
      {evaluation.blockers.length > 0 && <div className="mt-3 rounded-2xl border border-red-400/25 bg-red-400/[0.055] p-3"><div className="flex items-center gap-2 text-[10px] font-black text-red-200"><CircleOff className="h-4 w-4" /> WHY THIS IS NO TRADE</div><ul className="mt-2 space-y-1">{evaluation.blockers.map((item) => <li key={item} className="text-[10px] text-white/55">› {item}</li>)}</ul></div>}
    </div>
  </div>;
}

function PracticePanel({ plan, setPlan, accountSize, setAccountSize, riskPct, setRiskPct, sizing, evaluation, onSave, saving }) {
  return <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
    <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /><div><div className="text-sm font-black">Paper trade planner</div><div className="text-[10px] text-white/40">Risk determines size. This never routes an order.</div></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><Field label="Symbol / label" value={plan.symbol} onChange={(v) => setPlan({ ...plan, symbol: v })} /><Field label="Setup" value={plan.setup_name} onChange={(v) => setPlan({ ...plan, setup_name: v })} /></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><Field label="Paper account $" value={accountSize} onChange={setAccountSize} type="number" /><Field label="Risk %" value={riskPct} onChange={setRiskPct} type="number" /></div>
    <div className="mt-2 grid grid-cols-3 gap-2"><Field label="Entry" value={plan.entry} onChange={(v) => setPlan({ ...plan, entry: v })} type="number" /><Field label="Stop" value={plan.stop} onChange={(v) => setPlan({ ...plan, stop: v })} type="number" /><Field label="Target" value={plan.target} onChange={(v) => setPlan({ ...plan, target: v })} type="number" /></div>
    <label className="mt-3 block text-[9px] uppercase tracking-wider text-white/35">Trade thesis<textarea value={plan.thesis} onChange={(e) => setPlan({ ...plan, thesis: e.target.value })} className="mt-1 min-h-20 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white outline-none focus:border-primary/50" placeholder="What is the setup, location, trigger, and context?" /></label>
    <label className="mt-2 block text-[9px] uppercase tracking-wider text-white/35">Invalidation<textarea value={plan.invalidation} onChange={(e) => setPlan({ ...plan, invalidation: e.target.value })} className="mt-1 min-h-16 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white outline-none focus:border-primary/50" placeholder="What proves the idea wrong?" /></label>
    <div className="mt-3 grid grid-cols-3 gap-2"><Metric label="Risk $" value={sizing.valid ? `$${sizing.riskAmount.toFixed(2)}` : "—"} /><Metric label="Units" value={sizing.valid ? sizing.quantity : "—"} /><Metric label="Decision" value={evaluation.decision === "PAPER_TRADE" ? "READY" : "NO TRADE"} accent={evaluation.decision === "PAPER_TRADE"} /></div>
    <button onClick={onSave} disabled={saving} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black disabled:opacity-50 ${evaluation.decision === "PAPER_TRADE" ? "bg-primary text-black" : "border border-red-400/30 bg-red-400/[0.06] text-red-200"}`}><Save className="h-4 w-4" /> SAVE {evaluation.decision} PLAN</button>
  </div>;
}

function JournalPanel({ trades, journal, setJournal, onSave, saving }) {
  return <div className="space-y-3">
    <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
      <div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /><div><div className="text-sm font-black">Discipline journal</div><div className="text-[10px] text-white/40">Grade the process, not only the outcome.</div></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2"><Select label="Emotion before" value={journal.emotion_before} onChange={(v) => setJournal({ ...journal, emotion_before: v })} options={["calm","focused","uncertain","fearful","excited","frustrated","revenge"].map((v) => [v,v])} /><Select label="Discipline grade" value={journal.discipline_grade} onChange={(v) => setJournal({ ...journal, discipline_grade: v })} options={["A","B","C","D","F"].map((v) => [v,v])} /></div>
      <ToggleRow label="I followed the written plan" checked={journal.followed_plan} onChange={() => setJournal({ ...journal, followed_plan: !journal.followed_plan })} />
      {[["what_worked","What worked?"],["what_failed","What failed?"],["next_adjustment","One adjustment for next time"]].map(([key,label]) => <label key={key} className="mt-2 block text-[9px] uppercase tracking-wider text-white/35">{label}<textarea value={journal[key]} onChange={(e) => setJournal({ ...journal, [key]: e.target.value })} className="mt-1 min-h-16 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white outline-none focus:border-primary/50" /></label>)}
      <button onClick={onSave} disabled={saving} className="mt-3 w-full rounded-2xl bg-primary py-3 text-xs font-black text-black disabled:opacity-50">SAVE REVIEW</button>
    </div>
    <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4"><div className="text-sm font-black">Recent paper decisions</div><div className="mt-3 space-y-2">{trades.slice(0, 8).map((trade) => <div key={trade.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${trade.decision === "PAPER_TRADE" ? "bg-primary/10 text-primary" : "bg-red-400/10 text-red-300"}`}>{trade.decision === "PAPER_TRADE" ? <TrendingUp className="h-4 w-4" /> : <CircleOff className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="text-xs font-black">{trade.symbol} · {trade.direction?.toUpperCase()}</div><div className="truncate text-[9px] text-white/40">{trade.setup_name} · {Number(trade.reward_risk_ratio || 0).toFixed(2)}R</div></div><span className="text-[9px] font-bold text-white/50">{trade.decision === "PAPER_TRADE" ? "PAPER" : "PASS"}</span></div>)}{trades.length === 0 && <div className="py-6 text-center text-xs text-white/35">No paper decisions saved yet.</div>}</div></div>
  </div>;
}

function CandleChart() {
  const max = 100, min = 35, height = 150, width = 330;
  const y = (value) => height - ((value - min) / (max - min)) * height;
  return <svg viewBox={`0 0 ${width} ${height}`} className="my-4 h-40 w-full rounded-2xl border border-white/8 bg-black/30 p-2" role="img" aria-label="Simulated candlestick chart">{[30,60,90,120].map((gy) => <line key={gy} x1="0" x2={width} y1={gy} y2={gy} stroke="rgba(255,255,255,.06)" />)}{SAMPLE_CANDLES.map(([open,high,low,close], index) => { const x = 12 + index * 21; const up = close >= open; const color = up ? "#b6ff00" : "#fb7185"; return <g key={index}><line x1={x} x2={x} y1={y(high)} y2={y(low)} stroke={color} strokeWidth="1.5" /><rect x={x-4} y={Math.min(y(open),y(close))} width="8" height={Math.max(2,Math.abs(y(open)-y(close)))} fill={color} rx="1" /></g>; })}</svg>;
}

function ToggleRow({ label, checked, onChange }) {
  return <button type="button" onClick={onChange} className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 text-left"><div className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "border-primary bg-primary text-black" : "border-white/20"}`}>{checked && <CheckCircle2 className="h-3.5 w-3.5" />}</div><span className="text-[11px] text-white/65">{label}</span></button>;
}

function DecisionBadge({ evaluation }) {
  const ready = evaluation.decision === "PAPER_TRADE";
  return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${ready ? "border-primary/40 bg-primary/10 text-primary" : "border-red-400/35 bg-red-400/[0.07] text-red-200"}`}>{ready ? "PAPER READY" : "NO TRADE"}</span>;
}

function Field({ label, value, onChange, type = "text" }) {
  return <label className="block text-[9px] uppercase tracking-wider text-white/35">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} step={type === "number" ? "any" : undefined} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none focus:border-primary/50" /></label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="block text-[9px] uppercase tracking-wider text-white/35">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none focus:border-primary/50">{options.map(([key,text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function Metric({ label, value, accent = false }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3 text-center"><div className={`text-sm font-black ${accent ? "text-primary" : "text-white"}`}>{value}</div><div className="mt-1 text-[8px] uppercase tracking-wider text-white/35">{label}</div></div>;
}
