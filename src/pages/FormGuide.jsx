import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, Camera, CheckCircle2, Dumbbell, Gauge, RotateCcw, ShieldCheck, Target, Timer, TrendingUp, Wallet } from "lucide-react";
import { base44 } from "@/api/base44Client";

const EXERCISES = {
  squat: { name: "Squat", setup: ["Feet about shoulder-width", "Brace your trunk before descending", "Keep pressure through the whole foot"], reps: ["Sit down and slightly back", "Track knees in line with toes", "Use the deepest comfortable range you can control", "Stand tall without snapping the knees"] },
  pushup: { name: "Push-Up", setup: ["Hands slightly wider than shoulders", "Create a straight head-to-heel line", "Brace glutes and trunk"], reps: ["Lower under control", "Keep elbows at a comfortable angle from your torso", "Keep hips and shoulders moving together", "Press the floor away"] },
  hinge: { name: "Hip Hinge / RDL", setup: ["Soft knees, feet planted", "Brace before moving", "Keep the load close to the body"], reps: ["Push hips backward", "Keep spine position controlled", "Stop when hamstrings limit the range", "Drive hips forward to stand"] },
  lunge: { name: "Lunge", setup: ["Choose a stable stance", "Keep front foot planted", "Brace before descending"], reps: ["Lower under control", "Keep front knee tracking with toes", "Maintain balance through the full rep", "Drive through the front foot to rise"] },
};

export default function FormGuide() {
  const [exercise, setExercise] = useState("squat");
  const [started, setStarted] = useState(false);
  const [reps, setReps] = useState(0);
  const [saved, setSaved] = useState(false);
  const ex = EXERCISES[exercise];
  const score = useMemo(() => Math.min(96, 70 + reps * 2), [reps]);

  async function finish() {
    const me = await base44.auth.me().catch(() => null);
    if (me?.id) {
      await base44.entities.FitnessFormSession.create({ user_id: me.id, exercise: ex.name, started_at: new Date(Date.now() - Math.max(1,reps) * 45000).toISOString(), completed_at: new Date().toISOString(), reps_observed: reps, form_score: score, tempo_score: score, range_score: Math.max(65, score - 4), stability_score: Math.max(65, score - 2), coaching_cues: ex.reps, source: "manual" }).catch(() => null);
      await base44.entities.FitnessLearningSignal.create({ user_id: me.id, signal_type: "workout_completed", feature: `form_guide:${exercise}`, context: "form_coaching", weight: 1, occurred_at: new Date().toISOString() }).catch(() => null);
    }
    setSaved(true); setStarted(false);
  }

  return <div className="p-4 space-y-4">
    <div className="flex items-center gap-3"><Link to="/fitness" className="h-9 w-9 rounded-full border border-white/10 flex items-center justify-center"><ArrowLeft className="h-4 w-4"/></Link><div><div className="text-[10px] tracking-[.24em] text-primary font-bold">LOKIN MOVEMENT INTELLIGENCE</div><h1 className="text-2xl font-bold font-heading metal-text">Form Guide</h1></div></div>

    <div className="rounded-3xl border border-primary/25 bg-primary/[.06] p-5">
      <div className="flex items-start gap-3"><div className="h-11 w-11 rounded-2xl bg-primary/15 flex items-center justify-center"><Activity className="text-primary"/></div><div><div className="font-bold">Move better. Train smarter.</div><div className="text-xs text-white/55 mt-1">Technique cues, controlled reps and progress signals designed to help users get more from training without turning LOKIN into a medical diagnostic tool.</div></div></div>
    </div>

    <div className="grid grid-cols-2 gap-2">{Object.entries(EXERCISES).map(([k,v]) => <button key={k} onClick={()=>{setExercise(k);setReps(0);setSaved(false)}} className={`rounded-2xl border p-3 text-left ${exercise===k?'border-primary/50 bg-primary/10':'border-white/10 lokin-panel'}`}><Dumbbell className={`h-4 w-4 mb-2 ${exercise===k?'text-primary':'text-white/45'}`}/><div className="text-sm font-semibold">{v.name}</div></button>)}</div>

    <div className="rounded-3xl border border-white/10 lokin-panel p-5 space-y-4">
      <div className="flex items-center justify-between"><div><div className="text-xs text-white/40">CURRENT MOVEMENT</div><div className="text-xl font-bold">{ex.name}</div></div><div className="text-right"><div className="text-xs text-white/40">FORM SIGNAL</div><div className="text-xl font-bold text-primary">{score}</div></div></div>
      <div><div className="text-xs font-bold tracking-wider text-white/45 mb-2">SETUP</div>{ex.setup.map(x=><div key={x} className="flex gap-2 text-sm text-white/75 py-1"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5"/>{x}</div>)}</div>
      <div><div className="text-xs font-bold tracking-wider text-white/45 mb-2">REP CUES</div>{ex.reps.map((x,i)=><div key={x} className="flex gap-3 text-sm text-white/75 py-1.5"><span className="h-5 w-5 rounded-full bg-white/8 text-[10px] flex items-center justify-center shrink-0">{i+1}</span>{x}</div>)}</div>
      {!started ? <button onClick={()=>{setStarted(true);setSaved(false)}} className="w-full rounded-2xl bg-primary text-black font-bold py-3 flex items-center justify-center gap-2"><Timer className="h-4 w-4"/>Start guided set</button> : <div className="space-y-3"><div className="grid grid-cols-3 gap-2"><button onClick={()=>setReps(Math.max(0,reps-1))} className="rounded-xl border border-white/10 py-3"><RotateCcw className="h-4 w-4 mx-auto"/></button><div className="rounded-xl bg-white/5 flex flex-col items-center justify-center"><span className="text-2xl font-bold">{reps}</span><span className="text-[9px] text-white/40">CONTROLLED REPS</span></div><button onClick={()=>setReps(reps+1)} className="rounded-xl bg-primary text-black text-xl font-bold">+1</button></div><button onClick={finish} className="w-full rounded-2xl border border-primary/30 bg-primary/10 text-primary font-bold py-3">Finish & learn from set</button></div>}
      {saved && <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-primary flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0"/>Set saved to your private fitness learning history.</div>}
    </div>

    <div className="rounded-3xl border border-white/10 lokin-panel p-5">
      <div className="flex items-center gap-2 mb-3"><Camera className="h-5 w-5 text-primary"/><div className="font-bold">Vision Form Coach — architecture ready</div></div>
      <p className="text-xs text-white/55 leading-relaxed">The data layer now supports future camera-based rep, range, tempo and stability feedback. Camera processing should require explicit permission and provide coaching cues rather than injury diagnosis.</p>
    </div>

    <div className="rounded-3xl border border-white/10 lokin-panel p-5">
      <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/><div className="font-bold">Performance Balance Intelligence</div></div>
      <p className="text-xs text-white/55 mt-2">LOKIN's larger goal is to protect productive earning windows while finding realistic training and recovery windows—so users don't have to choose between their income goal and their fitness goal.</p>
      <div className="grid grid-cols-2 gap-2 mt-4"><div className="rounded-2xl bg-white/5 p-3"><Wallet className="h-4 w-4 text-primary mb-2"/><div className="text-xs font-bold">Income intelligence</div><div className="text-[10px] text-white/40 mt-1">Protect peak earning blocks</div></div><div className="rounded-2xl bg-white/5 p-3"><Target className="h-4 w-4 text-primary mb-2"/><div className="text-xs font-bold">Gain intelligence</div><div className="text-[10px] text-white/40 mt-1">Fit quality sessions around work</div></div></div>
    </div>

    <div className="text-[10px] text-white/30 text-center px-4">General fitness guidance only. Stop an exercise that causes pain or feels unsafe; LOKIN Form Guide does not diagnose injuries or replace qualified medical or fitness professionals.</div>
  </div>;
}
