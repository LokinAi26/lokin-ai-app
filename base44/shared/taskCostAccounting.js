export const TASK_COST_CATEGORIES = Object.freeze(['inference','cpu','maps','storage','database','external_api','network']);
export function summarizeTaskCosts(entries = [], successfulTasks = 0) {
  if (!Array.isArray(entries) || !Number.isSafeInteger(successfulTasks) || successfulTasks < 0) throw new Error('INVALID_COST_INPUT');
  const totals = Object.fromEntries(TASK_COST_CATEGORIES.map(key => [key, null]));
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.entry_id !== 'string' || !entry.entry_id || seen.has(entry.entry_id)) throw new Error('INVALID_OR_DUPLICATE_COST_ENTRY');
    seen.add(entry.entry_id);
    if (!TASK_COST_CATEGORIES.includes(entry.category) || typeof entry.amount_usd !== 'number' || !Number.isFinite(entry.amount_usd) || entry.amount_usd < 0) throw new Error('INVALID_COST_ENTRY');
    totals[entry.category] = (totals[entry.category] ?? 0) + entry.amount_usd;
    if (!Number.isFinite(totals[entry.category])) throw new Error('COST_OVERFLOW');
  }
  const missing = TASK_COST_CATEGORIES.filter(key => totals[key] === null);
  const known = Object.values(totals).reduce((sum, value) => sum + (value ?? 0), 0);
  if (!Number.isFinite(known)) throw new Error('COST_OVERFLOW');
  return { status: missing.length ? 'INCOMPLETE' : 'REPORTED_ESTIMATE', billing_verified: false, categories: totals, missing_categories: missing, known_subtotal_usd: known, total_cost_usd: missing.length ? null : known, successful_tasks: successfulTasks, cost_per_successful_task_usd: missing.length || !successfulTasks ? null : known / successfulTasks };
}
