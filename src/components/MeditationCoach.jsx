import { useEffect, useRef, useState } from "react";
import { Wind, Play, Square, Volume2, VolumeX } from "lucide-react";

// Guided breathing to regroup and reset between shifts.
const PRESETS = {
  box: {
    name: "Box Breathing",
    sub: "Inhale · Hold · Exhale · Hold",
    phases: [
      { label: "Inhale", dur: 4, scale: 1.5 },
      { label: "Hold", dur: 4, scale: 1.5 },
      { label: "Exhale", dur: 4, scale: 1 },
      { label: "Hold", dur: 4, scale: 1 },
    ],
  },
  calm: {
    name: "Calm Breath",
    sub: "4 · 2 · 6 reset",
    phases: [
      { label: "Inhale", dur: 4, scale: 1.5 },
      { label: "Hold", dur: 2, scale: 1.5 },
      { label: "Exhale", dur: 6, scale: 1 },
    ],
  },
  reset: {
    name: "Quick Reset",
    sub: "3 in · 3 out",
    phases: [
      { label: "Inhale", dur: 3, scale: 1.5 },
      { label: "Exhale", dur: 3, scale: 1 },
    ],
  },
};

export default function MeditationCoach() {
  const [preset, setPreset] = useState("box");
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [remaining, setRemaining] = useState(PRESETS.box.phases[0].dur);
  const [total, setTotal] = useState(0);
  const [voice, setVoice] = useState(true);
  const audioRef = useRef(null);

  const phases = PRESETS[preset].phases;
  const phase = phases[phaseIdx];

  function chime(freq) {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.75);
    } catch {}
  }

  function speak(text) {
    if (!voice || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.82;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  function start() {
    if (audioRef.current?.state === "suspended") audioRef.current.resume();
    setRunning(true);
    setPhaseIdx(0);
    setRemaining(phases[0].dur);
    setTotal(0);
    chime(523);
    speak(phases[0].label);
  }

  function stop() {
    setRunning(false);
    setPhaseIdx(0);
    setRemaining(phases[0].dur);
    setTotal(0);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // advance phases
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      setPhaseIdx((p) => {
        const np = (p + 1) % phases.length;
        chime(np === 0 ? 523 : 392);
        speak(phases[np].label);
        return np;
      });
    }, phase.dur * 1000);
    return () => clearTimeout(t);
  }, [running, phaseIdx, preset]);

  // countdown + total
  useEffect(() => {
    if (!running) return;
    setRemaining(phase.dur);
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
      setTotal((t2) => t2 + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [phaseIdx, running, preset]);

  useEffect(() => () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); }, []);

  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return (
    <div className="rounded-3xl border border-accent/25 bg-accent/[0.05] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Wind className="h-4 w-4 text-accent" />
        <div className="text-sm font-semibold text-white">Regroup &amp; Reset</div>
      </div>
      <p className="text-xs text-white/45 mb-4">Guided breathing to clear your head before the next shift.</p>

      {/* Breathing orb */}
      <div className="relative h-52 w-full flex items-center justify-center">
        <div
          className="rounded-full border-2 border-accent/50 bg-accent/10 glow-cyan flex items-center justify-center"
          style={{
            width: 150,
            height: 150,
            transform: `scale(${running ? phase.scale : 1})`,
            transition: `transform ${running ? phase.dur : 0.6}s ease-in-out`,
          }}
        >
          <div className="text-center">
            <div className="font-display text-lg font-bold tracking-wide text-accent text-glow-cyan leading-none">
              {running ? phase.label : "Ready"}
            </div>
            {running && <div className="text-3xl font-bold font-display text-white mt-1">{remaining}</div>}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-white/40 mt-1">
        {running ? `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} elapsed` : "Pick a rhythm and breathe"}
      </div>

      {/* Presets */}
      <div className="flex gap-2 mt-4">
        {Object.entries(PRESETS).map(([k, v]) => (
          <button key={k} onClick={() => !running && setPreset(k)}
            className={`flex-1 rounded-2xl border px-2 py-2 text-center ${k === preset ? "border-accent bg-accent/15" : "border-white/10 bg-white/[0.03]"}`}>
            <div className={`text-xs font-semibold ${k === preset ? "text-accent" : "text-white/60"}`}>{v.name}</div>
            <div className="text-[10px] text-white/35">{v.sub}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4">
        {running ? (
          <button onClick={stop} className="flex-1 rounded-2xl border border-destructive/50 bg-destructive/[0.08] py-3.5 font-display text-sm font-bold tracking-[0.12em] text-destructive flex items-center justify-center gap-2"
            style={{ boxShadow: "0 0 16px -4px hsl(0 84% 60% / 0.4)" }}>
            <Square className="h-4 w-4 fill-destructive" /> STOP
          </button>
        ) : (
          <button onClick={start} className="flex-1 rounded-2xl border border-accent/50 bg-accent/[0.08] py-3.5 font-display text-sm font-bold tracking-[0.12em] text-accent flex items-center justify-center gap-2"
            style={{ boxShadow: "0 0 16px -4px hsl(188 95% 50% / 0.4)" }}>
            <Play className="h-4 w-4 fill-accent" /> START
          </button>
        )}
        <button onClick={() => setVoice((v) => !v)}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 active:scale-95 transition-transform"
          aria-label="Toggle voice guidance">
          {voice ? <Volume2 className="h-4 w-4 text-accent" /> : <VolumeX className="h-4 w-4 text-white/40" />}
        </button>
      </div>
    </div>
  );
}