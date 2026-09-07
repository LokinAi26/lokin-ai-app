// This breaker bounds one sequential evaluation invocation, not external agents.
export function createEvaluationCircuit(now = Date.now()) {
  return { status: 'ACTIVE', calls: 0, errors: 0, started_at: now, reason: '' };
}
export function advanceEvaluationCircuit(state, event, now = Date.now()) {
  if (state.status === 'FROZEN') return { ...state };
  const next = { ...state };
  if (event === 'CALL') next.calls += 1;
  if (event === 'ERROR') next.errors += 1;
  if (event === 'POLICY_DENIAL') next.reason = 'POLICY_DENIAL';
  else if (now - next.started_at >= 120000) next.reason = 'TIME_BUDGET_EXCEEDED';
  else if (next.errors >= 2) next.reason = 'ERROR_BUDGET_EXCEEDED';
  else if (next.calls > 16) next.reason = 'CALL_BUDGET_EXCEEDED';
  if (next.reason) next.status = 'FROZEN';
  return next;
}
const validRate = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function estimateEvaluationCost(prompt, output, inputRate, outputRate) {
  if (!validRate(inputRate) || !validRate(outputRate)) return null;
  return (Math.ceil(String(prompt).length / 4) * inputRate +
    Math.ceil(String(output).length / 4) * outputRate) / 1000000;
}
export function summarizeEvaluationCost(results) {
  const known = results.length > 0 && results.every(row =>
    typeof row.estimated_cost_usd === 'number' &&
    Number.isFinite(row.estimated_cost_usd) && row.estimated_cost_usd >= 0 &&
    !row.error);
  const successes = results.filter(row => row.pass === true).length;
  const total = known ? results.reduce((sum, row) => sum + row.estimated_cost_usd, 0) : null;
  return {
    cost_status: known ? 'ESTIMATED_NOT_BILLED' : 'UNKNOWN',
    estimated_cost_usd: total,
    successful_tasks: successes,
    cost_per_successful_task_usd: known && successes > 0 ? total / successes : null
  };
}
