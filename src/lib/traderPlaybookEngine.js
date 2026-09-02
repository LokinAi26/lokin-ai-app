export const PLAYBOOK_VERSION = "1.0.0-education-mvp";

export const LESSONS = [
  { id: "candles", title: "Read the Candle", level: "Foundation", minutes: 7, summary: "Bodies show control; wicks show rejection. A candle only has meaning in context.", rule: "Never trade one candle without structure and location." },
  { id: "structure", title: "Market Structure", level: "Foundation", minutes: 9, summary: "Higher highs and higher lows favor an uptrend. Lower highs and lower lows favor a downtrend.", rule: "Define the higher-timeframe trend before looking for an entry." },
  { id: "levels", title: "Support & Resistance", level: "Core", minutes: 8, summary: "Treat levels as zones where decisions cluster, not exact magic prices.", rule: "Require a reaction or retest; do not assume a level will hold." },
  { id: "entries", title: "Entry Confirmation", level: "Core", minutes: 10, summary: "A valid setup needs location, trigger, invalidation, and enough reward for the risk.", rule: "If the trigger has not happened, the trade does not exist." },
  { id: "risk", title: "Risk Before Reward", level: "Essential", minutes: 10, summary: "Position size comes from account risk and stop distance, never excitement or conviction.", rule: "Define the stop and size before entering." },
  { id: "psychology", title: "Protect Your Mind", level: "Essential", minutes: 8, summary: "Revenge trading, FOMO, and overtrading are risk events, not personality flaws.", rule: "Stop when the daily loss limit or emotional circuit breaker is reached." },
];

export const SAMPLE_CANDLES = [
  [44,58,40,54],[54,63,50,60],[60,66,55,57],[57,70,56,67],[67,73,62,64],
  [64,77,63,74],[74,79,68,71],[71,82,70,80],[80,84,73,75],[75,88,74,85],
  [85,91,81,88],[88,94,82,84],[84,90,78,80],[80,87,73,76],[76,83,70,79],
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculatePositionSize({ accountSize, riskPct, entry, stop }) {
  const account = number(accountSize);
  const pct = number(riskPct);
  const entryPrice = number(entry);
  const stopPrice = number(stop);
  if (!account || !pct || !entryPrice || !stopPrice) {
    return { valid: false, error: "Complete account size, risk %, entry, and stop." };
  }
  const perUnitRisk = Math.abs(entryPrice - stopPrice);
  if (perUnitRisk <= 0) return { valid: false, error: "Entry and stop must be different." };
  const riskAmount = account * (pct / 100);
  return {
    valid: true,
    riskAmount,
    perUnitRisk,
    quantity: Math.floor(riskAmount / perUnitRisk),
  };
}

export function evaluateSetup(input) {
  const entry = number(input.entry);
  const stop = number(input.stop);
  const target = number(input.target);
  const direction = input.direction || "long";
  const priceValid = entry > 0 && stop > 0 && target > 0;
  const stopValid = priceValid && (direction === "long" ? stop < entry : stop > entry);
  const targetValid = priceValid && (direction === "long" ? target > entry : target < entry);
  const risk = priceValid ? Math.abs(entry - stop) : 0;
  const reward = priceValid ? Math.abs(target - entry) : 0;
  const ratio = risk > 0 ? reward / risk : 0;

  const checks = [
    { key: "trend", label: "Higher-timeframe trend agrees", passed: Boolean(input.trendAligned), weight: 20 },
    { key: "level", label: "Entry is at a defined level", passed: Boolean(input.atLevel), weight: 20 },
    { key: "trigger", label: "Entry trigger is confirmed", passed: Boolean(input.triggerConfirmed), weight: 25 },
    { key: "volume", label: "Participation supports the move", passed: Boolean(input.volumeConfirmed), weight: 10 },
    { key: "news", label: "No unmanaged scheduled-news risk", passed: Boolean(input.newsClear), weight: 10 },
    { key: "rr", label: "Planned reward/risk is at least 2:1", passed: ratio >= 2, weight: 15 },
  ];
  const score = checks.reduce((sum, item) => sum + (item.passed ? item.weight : 0), 0);
  const blockers = [];
  if (!priceValid) blockers.push("Entry, stop, and target must be positive numbers.");
  if (priceValid && !stopValid) blockers.push("Stop is on the wrong side of the entry.");
  if (priceValid && !targetValid) blockers.push("Target is on the wrong side of the entry.");
  if (!input.triggerConfirmed) blockers.push("The entry trigger is not confirmed.");
  if (ratio < 2) blockers.push("The planned reward does not justify the risk.");
  const decision = blockers.length === 0 && score >= 75 ? "PAPER_TRADE" : "NO_TRADE";
  return { score, checks, blockers, ratio, risk, reward, decision };
}
