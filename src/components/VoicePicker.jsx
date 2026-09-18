import { useState } from "react";
import { Volume2 } from "lucide-react";
import SelectSheet from "@/components/ui/SelectSheet";
import {
  TTS_VOICES,
  getTtsVoice,
  setTtsVoice,
  speakLokin,
} from "@/lib/lokinVoicePipeline";

// LOKIN voice picker — gateway TTS voices. These are real spoken voices rendered
// server-side, so they play inside the native iOS app (device speechSynthesis
// voices are silent there). Selection persists globally and applies to every
// spoken reply.
export default function VoicePicker({ compact = false }) {
  const [voiceId, setVoiceId] = useState(() => getTtsVoice());
  const [previewing, setPreviewing] = useState(false);

  function pick(id) {
    setVoiceId(id);
    setTtsVoice(id);
  }

  async function preview() {
    if (previewing) return;
    setPreviewing(true);
    try {
      await speakLokin("Hey, this is LOKIN. Let's lock in and get that bag.");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
      <Volume2 className="h-4 w-4 shrink-0 text-[#8FE44E]" />
      <SelectSheet
        value={voiceId}
        onChange={pick}
        options={TTS_VOICES.map((v) => ({ value: v.id, label: `${v.label} — ${v.hint}` }))}
        placeholder="LOKIN voice"
        label="LOKIN voice"
        className="min-w-0 flex-1 rounded-xl border-white/15 bg-black/60 px-2.5 py-2 text-xs"
      />
      <button
        onClick={preview}
        disabled={previewing}
        className="shrink-0 rounded-xl border border-[#8FE44E]/40 px-2.5 py-2 text-xs font-semibold text-[#8FE44E] active:scale-95 transition-transform disabled:opacity-50"
      >
        {previewing ? "Playing…" : "Preview"}
      </button>
    </div>
  );
}