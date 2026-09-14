import { useEffect, useRef, useState } from "react";
import { Coffee, Play, Square, ExternalLink, Headphones } from "lucide-react";
import MeditationCoach from "@/components/MeditationCoach";
import MotivationCoach from "@/components/MotivationCoach";

const STREAMS = [
  { id: "jfKfPfyJRdk", title: "Lofi Hip Hop Radio", sub: "Beats to chill to", emoji: "🎧" },
  { id: "4xDzrJKXOOY", title: "Synthwave Radio", sub: "Beats to drive to", emoji: "🌆" },
  { id: "5qap5aO4i9A", title: "Chillhop Radio", sub: "Relaxing beats", emoji: "☕" },
];

const CATEGORIES = [
  { label: "Stand-Up Comedy", query: "stand up comedy special full", emoji: "😂" },
  { label: "Live News", query: "live news stream 24/7", emoji: "📰" },
  { label: "Podcasts", query: "podcast full episode 2024", emoji: "🎙️" },
  { label: "ASMR / Relax", query: "asmr relax sleep", emoji: "✨" },
  { label: "Documentaries", query: "free documentary full", emoji: "🌍" },
  { label: "Car Reviews", query: "car review road test", emoji: "🚗" },
];

const APPS = [
  { name: "Pluto TV", url: "https://pluto.tv/watch", uri: "plutotv://" },
  { name: "Tubi", url: "https://tubitv.com", uri: "tubitv://" },
  { name: "YouTube", url: "https://youtube.com", uri: "youtube://" },
  { name: "Crackle", url: "https://www.crackle.com", uri: "crackle://" },
  { name: "Plex", url: "https://www.plex.tv/watch-free", uri: "plex://" },
  { name: "Freevee", url: "https://www.amazon.com/primevideo", uri: "primevideo://" },
];

const TARGET_MIN = 15;

export default function BreakTime() {
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState(STREAMS[0]);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function startBreak() {
    setActive(true);
    setElapsed(0);
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function stopBreak() {
    setActive(false);
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setElapsed(0);
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pct = Math.min(100, (elapsed / (TARGET_MIN * 60)) * 100);

  function launch(app) {
    if (app.uri) {
      const start = Date.now();
      window.location.href = app.uri;
      setTimeout(() => {
        if (Date.now() - start < 2000) window.open(app.url, "_blank", "noopener,noreferrer");
      }, 600);
    } else {
      window.open(app.url, "_blank", "noopener,noreferrer");
    }
  }

  function openSearch(query) {
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="p-4 space-y-4">
      <div className="lokin-kicker lokin-kicker-lime">BREAK</div>
      <div className="flex items-center gap-2">
        <Coffee className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Break Time</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">You earned it. Kick back, watch something, and recharge.</p>

      {/* Break timer */}
      <div className="rounded-3xl border border-white/10 lokin-panel lokin-card radial-fade p-5 text-center">
        <div className="relative h-28 w-28 mx-auto">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
            <circle cx="50" cy="50" r="42" stroke="hsl(0 0% 100% / 0.08)" strokeWidth="5" fill="none" />
            <circle cx="50" cy="50" r="42" stroke="hsl(81 84% 51%)" strokeWidth="5" fill="none" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
              style={{ filter: "drop-shadow(0 0 4px hsl(81 84% 51% / 0.7))" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-display text-primary text-glow leading-none">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-white/40 mt-0.5">break</span>
          </div>
        </div>
        <div className="text-xs text-white/45 mt-3">
          {active ? (pct >= 100 ? "Break's done — back to earning!" : `${Math.max(0, TARGET_MIN - mins)} min to recommended break`) : "15-min recommended break"}
        </div>
        {active ? (
          <button onClick={stopBreak} className="mt-4 w-full rounded-2xl border border-destructive/50 bg-destructive/[0.08] py-3.5 font-display text-lg font-bold tracking-[0.12em] text-destructive flex items-center justify-center gap-2"
            style={{ boxShadow: "0 0 16px -4px hsl(0 84% 60% / 0.45)" }}>
            <Square className="h-4 w-4 fill-destructive" /> END BREAK
          </button>
        ) : (
          <button onClick={startBreak} className="mt-4 w-full rounded-2xl glow-border lokin-panel py-3.5 font-display text-lg font-bold tracking-[0.12em] text-primary text-glow flex items-center justify-center gap-2">
            <Play className="h-4 w-4 fill-primary" /> START BREAK
          </button>
        )}
      </div>

      {/* Regroup & reset */}
      <MeditationCoach />
      <MotivationCoach />

      {/* Now playing */}
      <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Headphones className="h-4 w-4 text-accent" />
          <div className="text-sm font-semibold text-white/80">Now Playing</div>
        </div>
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10">
          <iframe
            key={stream.id}
            src={`https://www.youtube.com/embed/${stream.id}?autoplay=1&mute=1`}
            title={stream.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">{stream.emoji} {stream.title}</div>
            <div className="text-xs text-white/45">{stream.sub}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {STREAMS.map((s) => (
            <button key={s.id} onClick={() => setStream(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border ${s.id === stream.id ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
              {s.emoji} {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Browse categories */}
      <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
        <div className="text-sm font-semibold text-white/80 mb-3">Browse on YouTube</div>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.label} onClick={() => openSearch(c.query)}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-center active:scale-95 transition-transform">
              <div className="text-2xl mb-1">{c.emoji}</div>
              <div className="text-xs font-medium text-white/70">{c.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Free streaming apps */}
      <div className="rounded-3xl border border-white/10 lokin-panel lokin-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold text-white/80">Free Streaming Apps</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {APPS.map((app) => (
            <button key={app.name} onClick={() => launch(app)}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-center active:scale-95 transition-transform">
              <div className="text-sm font-bold text-white">{app.name}</div>
              <div className="text-[10px] text-primary mt-0.5 flex items-center justify-center gap-0.5">Open <ExternalLink className="h-2.5 w-2.5" /></div>
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-[10px] tracking-[0.18em] text-white/30 pt-1 pb-2">
        STREAM SMART. EARN HARD. LOCK IN.
      </div>
    </div>
  );
}