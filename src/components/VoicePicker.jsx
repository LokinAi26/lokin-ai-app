import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import SelectSheet from "@/components/ui/SelectSheet";
import {
  TTS_VOICES,
  getTtsVoice,
  setTtsVoice,
  getGuidanceVoice,
  setGuidanceVoice,
  getTtsVolume,
  setTtsVolume,
  speakLokin,
} from "@/lib/lokinVoicePipeline";

// LOKIN voice picker — gateway TTS voices. These are real spoken voices rendered
// server-side, so they play inside the native iOS app (device speechSynthesis
// voices are silent there). Selection persists globally and applies to every
// spoken reply.
// voiceKind="guidance" drives the separate turn-by-turn guidance voice
// (Kendall 2026-09-27): own persisted pick, navigation-style preview.
export default function VoicePicker({ compact = false, voiceKind = "lokin" }) {
  const isGuidance = voiceKind === "guidance";
  const [voiceId, setVoiceId] = useState(() => (isGuidance ? getGuidanceVoice() : getTtsVoice()));
  const [previewing, setPreviewing] = useState(false);
  const [level, setLevel] = useState(() => getTtsVolume());

  function changeLevel(v) {
    const n = Math.min(150, Math.max(0, Math.round(Number(v) || 0)));
    setLevel(n);
    setTtsVolume(n);
  }

  function pick(id) {
    setVoiceId(id);
    if (isGuidance) setGuidanceVoice(id);
    else setTtsVoice(id);
  }

  async function preview() {
    if (previewing) return;
    setPreviewing(true);
    try {
      if (isGuidance) {
        await speakLokin("In 500 feet, turn right onto Colley Avenue.", { voice: getGuidanceVoice() });
      } else {
        await speakLokin("Hey, this is LOKIN. Let's lock in and get that bag.");
      }
    } finally {
      setPreviewing(false);
    }
  }

  const pickerLabel = isGuidance ? "Guidance voice" : "LOKIN voice";

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
      <Volume2 className="h-4 w-4 shrink-0 text-[#8FE44E]" />
      <SelectSheet
        value={voiceId}
        onChange={pick}
        options={TTS_VOICES.map((v) => ({ value: v.id, label: `${v.label} — ${v.hint}` }))}
        placeholder={pickerLabel}
        label={pickerLabel}
        className="min-w-0 flex-1 rounded-xl border-white/15 bg-black/60 px-2.5 py-2 text-xs"
      />
      <button
        onClick={preview}
        disabled={previewing}
        className="shrink-0 rounded-xl border border-[#8FE44E]/40 px-2.5 py-2 text-xs font-semibold text-[#8FE44E] active:scale-95 transition-transform disabled:opacity-50"
      >
        {previewing ? "Playing…" : "Preview"}
      </button>
      {!compact && (
        <div className="pt-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">Voice level</span>
            <span className="text-[11px] tabular-nums text-white/60">{level}%</span>
          </div>
          <div className="flex items-center gap-2">
            <VolumeX className="h-3.5 w-3.5 shrink-0 text-white/40" />
            <input
              type="range"
              min={0}
              max={150}
              step={5}
              value={level}
              onChange={(e) => changeLevel(e.target.value)}
              aria-label="Voice level"
              className="min-w-0 flex-1 accent-[#8FE44E]"
            />
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-white/40" />
          </div>
        </div>
      )}
    </div>
  );
}