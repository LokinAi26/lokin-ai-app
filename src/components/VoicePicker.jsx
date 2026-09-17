import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  loadVoices,
  onVoices,
  getStoredVoiceURI,
  setStoredVoiceURI,
  speakText,
} from "@/lib/lokinVoice";

// LOKIN Voice picker — real device voices only (male/female), user-pickable.
// Compact pull-down for the Voice overlay; selection persists globally via
// lokin_voice and applies to voice replies, turn-by-turn, and coaches.
export default function VoicePicker({ compact = false }) {
  const [options, setOptions] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");

  useEffect(() => {
    loadVoices();
    setVoiceURI(getStoredVoiceURI());
    const off = onVoices((list) => {
      setOptions(list);
      // Default: first female voice if nothing stored yet.
      if (!getStoredVoiceURI() && list.length) {
        const first = list.find((v) => v.gender === "female") || list[0];
        setStoredVoiceURI(first.voiceURI);
        setVoiceURI(first.voiceURI);
      }
    });
    return off;
  }, []);

  function pick(uri) {
    setVoiceURI(uri);
    setStoredVoiceURI(uri);
  }

  function preview() {
    speakText("Hey, this is LOKIN. Let's lock in and get that bag.", { rate: 1.05 });
  }

  const females = options.filter((v) => v.gender === "female");
  const males = options.filter((v) => v.gender === "male");
  const others = options.filter((v) => v.gender === "unknown");

  if (!options.length) return null;

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
      <Volume2 className="h-4 w-4 shrink-0 text-[#8FE44E]" />
      <select
        value={voiceURI}
        onChange={(e) => pick(e.target.value)}
        aria-label="LOKIN voice"
        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/60 px-2.5 py-2 text-xs text-white/90 outline-none focus:border-[#8FE44E]/60"
      >
        <option value="">System default</option>
        {females.length > 0 && (
          <optgroup label="Female voices">
            {females.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </optgroup>
        )}
        {males.length > 0 && (
          <optgroup label="Male voices">
            {males.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label="Other voices">
            {others.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        onClick={preview}
        className="shrink-0 rounded-xl border border-[#8FE44E]/40 px-2.5 py-2 text-xs font-semibold text-[#8FE44E] active:scale-95 transition-transform"
      >
        Preview
      </button>
    </div>
  );
}
