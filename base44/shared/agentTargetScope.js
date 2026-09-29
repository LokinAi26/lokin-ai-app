export function authorizeAgentTarget(session = {}, request = {}) {
  const targets = session.metadata?.authorized_targets;
  if (!Array.isArray(targets) || !targets.length) return { allowed:false, decision:'DENY', reason:'TARGET_SCOPE_REQUIRED' };
  const match = targets.some(target =>
    typeof target.capability === 'string' && target.capability === request.capability &&
    typeof target.target_type === 'string' && target.target_type === request.target_type &&
    typeof target.target_id === 'string' && target.target_id.length > 0 && target.target_id === request.target_id);
  return match ? {allowed:true,decision:'ALLOW',reason:'EXACT_TARGET_MATCH'} : {allowed:false,decision:'DENY',reason:'TARGET_OUTSIDE_SCOPE'};
}
