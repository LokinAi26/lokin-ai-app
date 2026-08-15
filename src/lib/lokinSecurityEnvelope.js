const SAFE_METHODS = new Set(["GET","POST","PUT","PATCH","DELETE"]);

export function validateSecurityEnvelope(input = {}) {
  const issues = [];
  const method = String(input.method || "GET").toUpperCase();
  if (!SAFE_METHODS.has(method)) issues.push("unsupported_method");
  if (input.bodyBytes != null && (!Number.isFinite(input.bodyBytes) || input.bodyBytes < 0 || input.bodyBytes > 1_000_000)) issues.push("body_size_rejected");
  if (input.timeoutMs != null && (!Number.isFinite(input.timeoutMs) || input.timeoutMs < 500 || input.timeoutMs > 30_000)) issues.push("timeout_out_of_policy");
  if (input.retryCount != null && (!Number.isInteger(input.retryCount) || input.retryCount < 0 || input.retryCount > 2)) issues.push("retry_budget_exceeded");
  if (input.scope && !/^[a-z0-9:_-]{1,80}$/i.test(input.scope)) issues.push("invalid_scope");
  if (input.tenantId && !/^[A-Za-z0-9_-]{1,80}$/.test(input.tenantId)) issues.push("invalid_tenant");
  if (input.idempotencyKey && !/^[A-Za-z0-9_-]{12,120}$/.test(input.idempotencyKey)) issues.push("invalid_idempotency_key");
  if (Array.isArray(input.capabilities) && input.capabilities.length > 20) issues.push("capability_overflow");
  return { ok: issues.length === 0, issues, normalized: { ...input, method } };
}

export function requiresStepUp(surface, action) {
  const key = `${surface}:${action}`;
  return new Set([
    "payments:create",
    "payments:refund",
    "authentication:change_email",
    "authentication:reset_mfa",
    "merchant_integrations:change_payout",
    "external_commands:tap_out",
  ]).has(key);
}
