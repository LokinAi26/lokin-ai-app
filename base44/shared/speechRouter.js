export const SPEECH_ROUTER_VERSION = 'LOKIN_SPEECH_ROUTER_V1';

const normalize = (value) => String(value || '').trim().toLowerCase();

export function chooseSpeechProvider(providers = [], request = {}) {
  const now = Date.now();
  const language = normalize(request.language || 'en');
  const ranked = providers
    .filter((provider) => provider?.enabled !== false && provider?.configured === true)
    .filter((provider) => !provider.circuit_open_until || Date.parse(provider.circuit_open_until) <= now)
    .filter((provider) => !(provider.languages || []).length || provider.languages.map(normalize).includes(language) || provider.languages.includes('*'))
    .map((provider) => {
      const health = Number(provider.health_score ?? 1);
      const latency = Math.max(1, Number(provider.latency_ms || 500));
      const priority = Number(provider.priority || 0);
      const streaming = request.streaming && provider.streaming ? 0.25 : 0;
      const score = health * 0.55 + Math.max(0, 1 - latency / 5000) * 0.2 + priority * 0.01 + streaming;
      return { ...provider, routing_score: Number(score.toFixed(6)) };
    })
    .sort((a, b) => b.routing_score - a.routing_score);
  return {
    selected: ranked[0] || null,
    fallbacks: ranked.slice(1),
    reason: ranked.length ? 'HEALTH_AWARE_ROUTE' : 'NO_CONFIGURED_SPEECH_PROVIDER',
    version: SPEECH_ROUTER_VERSION,
  };
}

export function nextCircuitState(current = {}, outcome = {}) {
  const failures = outcome.success ? 0 : Number(current.consecutive_failures || 0) + 1;
  const threshold = Math.max(2, Number(current.failure_threshold || 3));
  const open = failures >= threshold;
  return {
    consecutive_failures: failures,
    health_score: outcome.success
      ? Math.min(1, Number(current.health_score || 0.5) + 0.1)
      : Math.max(0, Number(current.health_score || 1) - 0.25),
    circuit_state: open ? 'OPEN' : 'CLOSED',
    circuit_open_until: open ? new Date(Date.now() + Math.max(30000, Number(current.cooldown_ms || 120000))).toISOString() : '',
    last_latency_ms: Math.max(0, Number(outcome.latency_ms || 0)),
  };
}
