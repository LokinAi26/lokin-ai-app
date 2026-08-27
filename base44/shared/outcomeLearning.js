const clean = (value, max = 2000) => String(value || "").trim().slice(0, max);
const n = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nowIso = () => new Date().toISOString();

function dayPart(date = new Date()) {
  const h = date.getHours();
  if (h < 10) return "morning";
  if (h < 14) return "lunch";
  if (h < 17) return "afternoon";
  if (h < 22) return "dinner";
  return "late_night";
}

function scoreOutcome({ netPerHour, dollarsPerMile, targetPerHour, minPerMile }) {
  const hourly = targetPerHour > 0 ? Math.min(1.5, netPerHour / targetPerHour) : 1;
  const mileage = minPerMile > 0 ? Math.min(1.5, dollarsPerMile / minPerMile) : 1;
  return Math.max(0, Math.min(100, Math.round((hourly * 0.65 + mileage * 0.35) * 70)));
}

async function getOrCreateProfile(base44, userId, existingProfile = null) {
  if (existingProfile) return existingProfile;
  const api = base44.asServiceRole.entities.LokinLearningProfile;
  const rows = await api.filter({ user_id: userId }, "-updated_date", 1);
  if (rows?.[0]) return rows[0];
  return await api.create({
    user_id: userId,
    version: 1,
    learning_enabled: true,
    preferred_response_style: "concise, practical, driver-safe",
    strategy_summary: "Learn only from this user's interactions, feedback, corrections, and measured outcomes.",
    confidence: 0.5,
    total_events: 0,
    last_learned_at: nowIso(),
  });
}

export async function recordMeasuredOutcome(base44, userId, input = {}, options = {}) {
  const uid = String(userId);
  const outcomesApi = base44.asServiceRole.entities.LokinOutcomeLearning;
  const strategiesApi = base44.asServiceRole.entities.LokinStrategyPerformance;
  const memoriesApi = base44.asServiceRole.entities.LokinLearningMemory;
  const eventsApi = base44.asServiceRole.entities.LokinLearningEvent;
  const profilesApi = base44.asServiceRole.entities.LokinLearningProfile;

  let profile = await getOrCreateProfile(base44, uid, options.profile || null);
  if (profile.learning_enabled === false) {
    return { ok: true, learned: false, skipped: "learning_disabled", profile, engine_version: 3 };
  }

  const outcomeType = ["delivery", "route", "opportunity", "session", "strategy"].includes(input.outcome_type)
    ? input.outcome_type
    : "strategy";
  const strategyKey = clean(input.strategy_key, 180);
  if (!strategyKey) throw new Error("strategy_key required");

  const sourceProvider = clean(input.source_provider, 80);
  const sourceExternalId = clean(input.source_external_id, 180);
  const sourceSyncKey = clean(input.source_sync_key, 300);
  if (sourceSyncKey) {
    const existing = await outcomesApi.filter({ user_id: uid, source_sync_key: sourceSyncKey }, "-occurred_at", 1);
    if (existing?.[0]) {
      return { ok: true, learned: false, duplicate: true, outcome: existing[0], profile, engine_version: 3 };
    }
  }

  const gross = Math.max(0, n(input.gross_earnings));
  const tips = Math.max(0, n(input.tips));
  const miles = Math.max(0, n(input.miles));
  const minutes = Math.max(0, n(input.duration_minutes));
  const explicitNetPerHour = Number(input.net_per_hour);
  const netPerHour = Number.isFinite(explicitNetPerHour)
    ? Math.max(0, explicitNetPerHour)
    : minutes > 0 ? gross / (minutes / 60) : 0;
  const explicitDollarsPerMile = Number(input.dollars_per_mile);
  const dollarsPerMile = Number.isFinite(explicitDollarsPerMile)
    ? Math.max(0, explicitDollarsPerMile)
    : miles > 0 ? gross / miles : 0;

  const pref = options.preferences || {};
  const targetPerHour = Math.max(1, n(pref.min_per_hour, 22));
  const minPerMile = Math.max(0.5, n(input.min_per_mile, pref.target_per_mile || 1.5));
  const explicitSuccess = Number(input.success_score);
  const successScore = Number.isFinite(explicitSuccess)
    ? Math.max(0, Math.min(100, explicitSuccess))
    : scoreOutcome({ netPerHour, dollarsPerMile, targetPerHour, minPerMile });
  const occurredAt = clean(input.occurred_at, 80) || nowIso();
  const d = new Date(occurredAt);
  const validDate = Number.isFinite(d.getTime()) ? d : new Date();

  const outcome = await outcomesApi.create({
    user_id: uid,
    outcome_type: outcomeType,
    strategy_key: strategyKey,
    platform: clean(input.platform, 80) || "mixed",
    day_part: clean(input.day_part, 40) || dayPart(validDate),
    day_of_week: validDate.toLocaleDateString("en-US", { weekday: "long" }),
    gross_earnings: gross,
    tips,
    miles,
    duration_minutes: minutes,
    net_per_hour: netPerHour,
    dollars_per_mile: dollarsPerMile,
    success_score: successScore,
    metadata_json: JSON.stringify(input.metadata || {}),
    source_provider: sourceProvider,
    source_external_id: sourceExternalId,
    source_sync_key: sourceSyncKey,
    occurred_at: occurredAt,
  });

  const currentRows = await strategiesApi.filter({ user_id: uid, strategy_key: strategyKey }, "-updated_date", 1);
  const current = currentRows?.[0];
  const oldCount = n(current?.sample_count);
  const count = oldCount + 1;
  const avg = (old, fresh) => ((n(old) * oldCount) + n(fresh)) / count;
  const avgNph = avg(current?.avg_net_per_hour, netPerHour);
  const avgDpm = avg(current?.avg_dollars_per_mile, dollarsPerMile);
  const avgSuccess = avg(current?.avg_success_score, successScore);
  const wins = n(current?.wins) + (successScore >= 70 ? 1 : 0);
  const losses = n(current?.losses) + (successScore < 50 ? 1 : 0);
  const confidence = Math.min(0.98, 0.30 + Math.min(0.68, count * 0.07));
  const rankScore = avgSuccess * confidence + Math.min(20, avgNph / Math.max(1, targetPerHour) * 10);
  const summary = `${strategyKey}: ${count} measured outcome${count === 1 ? "" : "s"}; avg $${avgNph.toFixed(2)}/hr, $${avgDpm.toFixed(2)}/mi, success ${avgSuccess.toFixed(0)}/100.`;
  const strategyRecord = {
    user_id: uid,
    strategy_key: strategyKey,
    sample_count: count,
    wins,
    losses,
    avg_net_per_hour: avgNph,
    avg_dollars_per_mile: avgDpm,
    avg_success_score: avgSuccess,
    confidence,
    rank_score: rankScore,
    last_outcome_at: occurredAt,
    summary,
    active: true,
  };
  const strategy = current
    ? await strategiesApi.update(current.id, strategyRecord)
    : await strategiesApi.create(strategyRecord);

  const topic = `outcome:${strategyKey}`;
  const memoryRows = await memoriesApi.filter({ user_id: uid, topic, active: true }, "-updated_date", 1);
  const memoryRecord = {
    user_id: uid,
    memory_type: "strategy",
    topic,
    summary,
    confidence,
    evidence_count: count,
    positive_count: wins,
    negative_count: losses,
    last_evidence_at: occurredAt,
    source: "outcome",
    active: true,
  };
  if (memoryRows?.[0]) await memoriesApi.update(memoryRows[0].id, memoryRecord);
  else await memoriesApi.create(memoryRecord);

  await eventsApi.create({
    user_id: uid,
    event_type: "outcome",
    feature: outcomeType,
    input_text: strategyKey,
    response_text: summary,
    rating: successScore >= 70 ? 1 : successScore < 50 ? -1 : 0,
    metadata_json: JSON.stringify({
      outcome_id: outcome.id,
      success_score: successScore,
      source_provider: sourceProvider || null,
      source_external_id: sourceExternalId || null,
    }),
    occurred_at: occurredAt,
  });

  profile = await profilesApi.update(profile.id, {
    total_events: n(profile.total_events) + 1,
    last_learned_at: occurredAt,
    version: n(profile.version, 1) + 1,
    strategy_summary: `LOKIN v3 ranks strategies from measured outcomes. Current learned strategy: ${summary}`,
  });

  return { ok: true, learned: true, outcome, strategy, profile, engine_version: 3 };
}
