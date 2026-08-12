import { useState } from "react";
import { Music, Play, Pause, Volume2, VolumeX } from "lucide-react";

// Free, ad-supported streaming stations for drivers — audio-only so it
// doesn't distract from the GPS HUD. Tap to play (user gesture = unmuted audio).
const STATIONS = [
  { id: "jfKfPfyJRdk", title: "Lofi Hip Hop", emoji: "🎧" },
  { id: "4xDzrJKXOOY", title: "Synthwave Drive", emoji: "🌆" },
  { id: "5qap5aO4i9A", title: "Chillhop", emoji: "☕" },
  { id: "DWcJFNfaw9c", title: "Deep House", emoji: "🪩" },
  { id: "1-xJn5VkESk", title: "Country Road", emoji: "🤠" },
  { id: "M4ZoCHId9A4", title: "Hip Hop Hits", emoji: "🔥" },
];

export default function DriveMusicPlayer() {
  const [station, setStation] = useState(STATIONS[0]);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  function togglePlay() {
    setPlaying((p) => !p);
    if (!playing) setMuted(false);
  }

  function select(s) {
    setStation(s);
    setPlaying(true);
    setMuted(false);
  }

  return (
    <div className="rounded-3xl border border-white/10 lokin-panel p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-white/80">Drive Music</span>
        </div>
        <span className="text-[10px] tracking-widest text-accent/60 font-display">FREE · AD-SUPPORTED</span>
      </div>

      {/* audio-only: iframe kept off-screen so video never distracts from driving */}
      <div className="relative h-0 w-0 overflow-hidden opacity-0" aria-hidden>
        {playing && (
          <iframe
            key={station.id + String(playing)}
            src={`https://www.youtube.com/embed/${station.id}?autoplay=1${muted ? "&mute=1" : ""}&controls=0`}
            allow="autoplay; encrypted-media"
            className="absolute inset-0 h-px w-px"
            title={station.title}
          />
        )}
      </div>

      {/* Now-playing bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-2.5">
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground glow-cyan active:scale-90 transition-transform"
        >
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{station.emoji} {station.title}</div>
          <div className="text-[11px] text-white/40">{playing ? "Now streaming" : "Tap play to listen"}</div>
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 active:scale-90 transition-transform"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-accent" />}
        </button>
      </div>

      {/* Station chips */}
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
        {STATIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => select(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${s.id === station.id ? "border-accent bg-accent/15 text-accent" : "border-white/10 bg-white/[0.03] text-white/50"}`}
          >
            {s.emoji} {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}