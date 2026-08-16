import { useEffect } from "react";
import { dispatchLokinCommand, LOKIN_COMMANDS } from "@/lib/lokinCommandBus";

const ALLOWED = new Set(Object.values(LOKIN_COMMANDS));

function postToNative(message) {
  try {
    if (window.webkit?.messageHandlers?.lokinVoice?.postMessage) {
      window.webkit.messageHandlers.lokinVoice.postMessage(message);
      return true;
    }
    if (window.LokinAndroidVoice?.postMessage) {
      window.LokinAndroidVoice.postMessage(JSON.stringify(message));
      return true;
    }
  } catch {}
  return false;
}

export function nativeVoiceAvailable() {
  return Boolean(window.webkit?.messageHandlers?.lokinVoice?.postMessage || window.LokinAndroidVoice?.postMessage);
}

export default function NativeVoiceBridge() {
  useEffect(() => {
    window.LOKINNativeVoice = {
      receive(payload = {}) {
        const commandId = String(payload.commandId || "ask");
        const transcript = String(payload.transcript || "").slice(0, 500);
        if (!ALLOWED.has(commandId) && commandId !== "ask") return false;
        dispatchLokinCommand(commandId, { phrase: transcript || payload.phrase || commandId, transcript }, "native-voice");
        return true;
      },
      status(payload = {}) {
        window.dispatchEvent(new CustomEvent("lokin:native-voice-status", { detail: payload }));
      },
      isAvailable: nativeVoiceAvailable,
      startWake() { return postToNative({ type: "startWake", wakePhrase: "hey lokin" }); },
      stopWake() { return postToNative({ type: "stopWake" }); },
      startCommand() { return postToNative({ type: "startCommand" }); },
    };

    const available = nativeVoiceAvailable();
    window.dispatchEvent(new CustomEvent("lokin:native-voice-status", { detail: { available, state: available ? "ready" : "web-fallback" } }));
    if (available) postToNative({ type: "webReady", protocol: 1 });

    return () => { try { delete window.LOKINNativeVoice; } catch {} };
  }, []);

  return null;
}
