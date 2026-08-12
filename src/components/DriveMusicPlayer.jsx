import { useEffect, useRef, useState } from "react";
import { Music, Play, Pause, Volume2, VolumeX, SkipForward, SkipBack } from "lucide-react";

const GENRES = [
  { id: "chill", label: "Chill" },
  { id: "drive", label: "Drive" },
  { id: "hype", label: "Hype" },
  { id: "country", label: "Country" },
];

// Free, ad-supported streaming stations for drivers — audio-only so the
// video never distracts from the GPS HUD. Tap play (user gesture = unmuted audio).
const STATIONS = [
  { id: "jfKfPfyJRdk", title: "Lofi Hip Hop", emoji: "🎧", genre: "chill" },
  { id: "5qap5aO4i9A", title: "Chillhop", emoji: "☕", genre: "chill" },
  { id: "rTUsNvOXwu0", title: "R&B Chill", emoji: "💜", genre: "chill" },
  { id: "4xDzrJKXOOY", title: "Synthwave Drive", emoji: "🌆", genre: "drive" },
  { id: "DWcJFNfaw9c", title: "Deep House", emoji: "🪩", genre: "drive" },
  { id: "tV5QM6Aj5rQ", title: "Road Trip Rock", emoji: "🎸", genre: "drive" },
  { id: "M4ZoCHId9A4", title: "Hip Hop Hits", emoji: "🔥", genre: "hype" },
  { id: "1-xJn5VkESk", title: "Country Road", emoji: "🤠", genre: "country" },
];

export default function DriveMusicPlayer() {
  const [genre, setGenre] = useState("drive");
  const [stationIdx, setStationIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(65);
  const iframeRef = useRef(null);

  const list = STATIONS.filter((s) => s.genre === genre);
  const station = list[stationIdx] || list[0];

  function post(func, args = []) {
    const f = iframeRef.current;
    if (!f || !f.contentWindow) return;
    try { f.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*"); } catch {}
  }

  function mountAndPlay() {
    setStarted(true);
    setPlaying(true);
    setMuted(false);
  }

  function togglePlay() {
    if (!started) { mountAndPlay(); return; }
    if (playing) { post("pauseVideo"); setPlaying(false); }
    else { post("playVideo"); setPlaying(true); setMuted(false); post("unMute"); }
  }

  function selectStation(i) {
    setStationIdx(i);
    mountAndPlay();
  }

  function next() { setStationIdx((i) => (i + 1) % list.length); mountAndPlay(); }
  function prev() { setStationIdx((i) => (i - 1 + list.length) % list.length); mountAndPlay(); }

  function changeGenre(g) {
    setGenre(g);
    setStationIdx(0);
    mountAndPlay();
  }

  function changeVol(v) {
    setVolume(v);
    setMuted(false);
    post("setVolume", [v]);
    post("unMute", []);
  }

  function toggleMute() {
    if (muted) { setMuted(false); post("unMute", []); post("setVolume", [volume]); }
    else { setMuted(true); post("mute", []); }
  }

  function onIframeLoad() {
    post("setVolume", [muted ? 0 : volume]);
    if (!muted) post("unMute", []);
  }

  // Voice assistant control via window events
  useEffect(() => {
    function onMsg(e) {
      const { action } = e.detail || {};
      if (!action) return;
      if (action === "play") { if (!started) mountAndPlay(); else { post("playVideo"); setPlaying(true); setMuted(false); post("unMute"); } }
      else if (action === "pause" || action === "stop") { post("pauseVideo"); setPlaying(false); }
      else if (action === "next") next();
      else if (action === "prev") prev();
    }
    window.addEventListener("lokin:music", onMsg);
    return () => window.removeEventListener("lokin:music", onMsg);
  }, [started, genre]);

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
      <div className="absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
        {started && (
          <iframe
            key={station.id}
            ref={iframeRef}
            onLoad={onIframeLoad}
            src={`https://www.youtube.com/embed/${station.id}?autoplay=1&enablejsapi=1&controls=0&mute=${muted ? 1 : 0}`}
            allow="autoplay; encrypted-media"
            className="absolute inset-0 h-px w-px"
            title={station.title}
          />
        )}
      </div>

      {/* Now-playing bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-2.5">
        <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground glow-cyan active:scale-90 transition-transform">
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <button onClick={prev} aria-label="Previous station" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 active:scale-90 transition-transform">
          <SkipBack className="h-4 w-4" />
        </button>
        <button onClick={next} aria-label="Next station" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 active:scale-90 transition-transform">
          <SkipForward className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{station.emoji} {station.title}</div>
          <div className="text-[11px] text-white/40">{playing ? "Now streaming" : "Tap play to listen"}</div>
        </div>
        <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 active:scale-90 transition-transform">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-accent" />}
        </button>
      </div>

      {/* Volume slider */}
      <div className="mt-2.5 flex items-center gap-2">
        <Volume2 className="h-3.5 w-3.5 text-white/40 shrink-0" />
        <input
          type="range" min={0} max={100} value={muted ? 0 : volume}
          onChange={(e) => changeVol(Number(e.target.value))}
          className="flex-1 accent-[hsl(188_95%_50%)] h-1.5"
          aria-label="Volume"
        />
        <span className="text-[10px] text-white/40 w-7 text-right tabular-nums">{muted ? 0 : volume}</span>
      </div>

      {/* Genre chips */}
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
        {GENRES.map((g) => (
          <button key={g.id} onClick={() => changeGenre(g.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors ${g.id === genre ? "border-accent bg-accent/15 text-accent" : "border-white/10 bg-white/[0.03] text-white/45"}`}>
            {g.label}
          </button>
        ))}
      </div>

      {/* Station chips */}
      <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
        {list.map((s, i) => (
          <button key={s.id} onClick={() => selectStation(i)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${s.id === station.id && started ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
            {s.emoji} {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}