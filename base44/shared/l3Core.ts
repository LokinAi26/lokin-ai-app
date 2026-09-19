// L3 operating-layer core: deterministic directive classification, checkpoint
// detection, and the plan template. Shared by lokin-l3-dispatch and future L3
// functions. Deliberately zero external calls — the L3 layer runs on a $0 cap.

export const APPROVAL_TTL_MINUTES = 30;

// Non-negotiable checkpoint classes — no automation without a human card.
// Ordered: first match wins.
const CHECKPOINT_PATTERNS = [
  { klass: "irreversible", test: /\b(un-?send|irreversible|drop table|permanently)\b/i },
  { klass: "destructive", test: /\b(delete|erase|wipe|remove all|reset|clear all|destroy|purge)\b/i },
  { klass: "financial", test: /\b(pay|purchase|spend|buy|refund|payout|checkout|subscribe)\b/i },
  { klass: "public", test: /\b(post|publish|tweet|send|email|announce|launch externally)\b/i },
  { klass: "credential", test: /\b(log ?in|sign ?in|password|api key|secret|token|credential)\b/i },
];

export function detectCheckpoint(directive) {
  const text = String(directive || "");
  for (const p of CHECKPOINT_PATTERNS) {
    if (p.test.test(text)) return p.klass;
  }
  return null;
}

// Dispatcher triage: every directive is classified before anything executes.
export function classifyDirective(directive) {
  const text = String(directive || "").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  if (/\b(daily|weekly|every (morning|day|week|hour)|cron|schedule[dr]?|recurring|each monday|sundays?)\b/i.test(text)) return "scheduled";
  if (words <= 6 && text.includes("?")) return "quick_answer";
  if (/^(what|when|where|who|why|how (much|many|often)|is|are|does|did|can you (check|show|tell me))\b/i.test(text) && words <= 12) return "quick_answer";
  return "task";
}

export function planSteps(classification, checkpointClass) {
  const steps = [
    { name: "Confirm scope", purpose: "Use the smallest change that satisfies the directive.", done: false },
    { name: "Inspect current state", purpose: "Read the code, records, or logs this directive touches before acting.", done: false },
  ];
  if (checkpointClass) {
    steps.push({
      name: `Checkpoint: ${checkpointClass}`,
      purpose: `Human approval card required (${checkpointClass}) — TTL ${APPROVAL_TTL_MINUTES} min, default-DENY on expiry.`,
      done: false,
    });
  }
  steps.push(
    { name: "Execute focused work", purpose: "Perform only the classified actions; no spend without an approved card.", done: false },
    { name: "Verify outcome", purpose: "Prove the result with evidence — not just that it ran.", done: false },
    { name: "Report + archive", purpose: "Return status to chat and archive the plan with its run logs.", done: false },
  );
  return steps.map((step, i) => ({ order: i + 1, ...step }));
}