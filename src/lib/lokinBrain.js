// LOKIN Brain — Jarvis fusion client (Phase 1).
//
// The Oasis deck's intelligence engine ("Ask LOKIN hub": GPT + Gemini + Claude
// behind the Ask LOKIN / Gig Coach / Manifesto bots) is now fused into the
// app's own backend: base44/functions/external-ai-gateway/entry.ts routes
// `bot` + `engine` through the same auth, AI-consent, budget-guardian, and
// telemetry guardrails as every other AI call.
//
// askBrain() is the single entry point. Pass a bot, an optional engine
// override, the message, and optional driver context. Nothing in the UI
// changes by itself — callers opt in per feature.

import { base44 } from "@/api/base44Client";
import { guardedInvoke } from "@/lib/creditGuardian";

export const BRAIN_BOTS = [
  { id: "asklokin", label: "Ask LOKIN", desc: "Flagship assistant" },
  { id: "gigcoach", label: "Gig Coach", desc: "Earnings + strategy" },
  { id: "manifesto", label: "Manifesto", desc: "Creative + film brain" },
];

export const BRAIN_ENGINES = [
  { id: "gpt", label: "GPT" },
  { id: "gemini", label: "Gemini" },
  { id: "claude", label: "Claude" },
];

// Bot -> default engine (mirrors the deck; Manifesto falls back gpt on failure).
export const BRAIN_BOT_ENGINES = {
  asklokin: "gpt",
  gigcoach: "gpt",
  manifesto: "claude",
};

export async function askBrain({ bot = "asklokin", engine, message, context } = {}) {
  const text = String(message || "").trim();
  if (!text) throw new Error("askBrain: message is required");
  const botId = BRAIN_BOTS.some((b) => b.id === bot) ? bot : "asklokin";
  const engineId = engine && BRAIN_ENGINES.some((e) => e.id === engine) ? engine : undefined;
  // guardedInvoke enforces the AI-consent gate + credit-guardian policy
  // ("external-ai-gateway" is already in the consent-gated set).
  return guardedInvoke(
    base44,
    "external-ai-gateway",
    { mode: "assistant", bot: botId, ...(engineId ? { engine: engineId } : {}), message: text, context: context || {} },
    { userInitiated: true }
  );
}
