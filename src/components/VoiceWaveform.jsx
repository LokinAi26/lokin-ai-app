// Animated neon voice-waveform used by the AI Co-Pilot.
// `active` toggles between a dim idle state and a glowing animated bar set.
export default function VoiceWaveform({ active = false, bars = 5, className = "" }) {
  return (
    <div className={`flex items-end justify-center gap-1 ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={active ? "lokin-wave" : ""}
          style={{
            width: 4,
            height: active ? 30 : 10,
            borderRadius: 4,
            background: "hsl(80 100% 50%)",
            opacity: active ? 1 : 0.4,
            animationDelay: `${(i % bars) * 0.13}s`,
            boxShadow: active ? "0 0 8px hsl(80 100% 50% / 0.7)" : "none",
          }}
        />
      ))}
    </div>
  );
}