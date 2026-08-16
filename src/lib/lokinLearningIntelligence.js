// Local-first learning intelligence. Summarizes behavior signals into a compact
// profile/context without spending an external AI call.

export function summarizeDriverLearning(signals = [], v2 = []) {
  const accepted = [];
  const dismissed = [];
  const contexts = {};
  let voiceUses = 0;
  let acceptCount = 0;
  let dismissCount = 0;

  for (const s of signals) {
    const feature = s?.feature_key || "";
    if (s?.signal_type === "accepted_recommendation" && feature) { accepted.push(feature); acceptCount += 1; }
    if (s?.signal_type === "dismissed_recommendation" && feature) { dismissed.push(feature); dismissCount += 1; }
    if (s?.signal_type === "work_pattern" || s?.signal_type === "preference") {
      const key = feature || "general";
      contexts[key] = (contexts[key] || 0) + Number(s?.weight || 1);
    }
  }

  for (const s of v2) {
    if (s?.signal_type === "voice_used") voiceUses += 1;
    if (s?.signal_type === "accepted") acceptCount += 1;
    if (s?.signal_type === "dismissed") dismissCount += 1;
    if (s?.context) contexts[s.context] = (contexts[s.context] || 0) + 1;
    if (s?.feature && s?.signal_type === "accepted") accepted.push(s.feature);
    if (s?.feature && s?.signal_type === "dismissed") dismissed.push(s.feature);
  }

  const totalDecisions = acceptCount + dismissCount;
  return {
    acceptedFeatures: [...new Set(accepted)].slice(-12),
    dismissedFeatures: [...new Set(dismissed)].slice(-12),
    preferredContexts: Object.entries(contexts).sort((a,b) => b[1]-a[1]).slice(0,6).map(([k]) => k),
    voiceUsageScore: Math.min(100, voiceUses * 5),
    recommendationAcceptanceScore: totalDecisions ? Math.round((acceptCount / totalDecisions) * 100) : 0,
    learningConfidence: Math.min(100, Math.round((signals.length + v2.length) * 2.5)),
    signalCount: signals.length + v2.length,
  };
}

export function summarizeFitnessLearning(signals = []) {
  const preferred = {};
  const disliked = {};
  let completed = 0;
  let skipped = 0;
  for (const s of signals) {
    const feature = s?.feature || "general";
    if (s?.signal_type === "workout_completed") completed += 1;
    if (s?.signal_type === "workout_skipped") skipped += 1;
    if (s?.signal_type === "workout_preferred") preferred[feature] = (preferred[feature] || 0) + Number(s?.weight || 1);
    if (s?.signal_type === "workout_disliked") disliked[feature] = (disliked[feature] || 0) + Number(s?.weight || 1);
  }
  return {
    preferredWorkouts: Object.entries(preferred).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k),
    dislikedWorkouts: Object.entries(disliked).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k),
    completionRate: completed + skipped ? Math.round((completed/(completed+skipped))*100) : 0,
    signalCount: signals.length,
  };
}
