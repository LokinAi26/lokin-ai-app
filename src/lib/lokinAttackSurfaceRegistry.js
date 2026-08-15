export const LOKIN_ATTACK_SURFACES = Object.freeze({
  urls: { risk: "high", mode: "fail-closed", controls: ["https-only","host-allowlist","path-allowlist","parameter-schema","versioning","duplicate-reject","confirmation-gates"] },
  oauth: { risk: "critical", mode: "fail-closed", controls: ["exact-redirect-uri","state-validation","pkce","least-scope","token-expiry","reauth-on-scope-change"] },
  apis: { risk: "critical", mode: "fail-closed", controls: ["authenticated-calls","schema-validation","rate-limits","timeouts","retry-budget","least-privilege"] },
  merchant_integrations: { risk: "high", mode: "guarded", controls: ["tenant-boundary","capability-allowlist","signed-requests","auditable-actions","revocation"] },
  ai_tool_calls: { risk: "critical", mode: "guarded", controls: ["tool-allowlist","argument-validation","human-confirmation-for-high-impact","output-sanitization","budget-limits"] },
  uploaded_data: { risk: "high", mode: "quarantine-first", controls: ["type-allowlist","size-limits","content-validation","metadata-stripping","isolated-processing"] },
  authentication: { risk: "critical", mode: "fail-closed", controls: ["session-expiry","secure-recovery","step-up-auth","device-awareness","audit-events"] },
  native_bridges: { risk: "critical", mode: "fail-closed", controls: ["semantic-command-ids","universal-link-validation","source-allowlist","contract-version","replay-resistance"] },
  payments: { risk: "critical", mode: "confirm", controls: ["provider-tokenization","explicit-confirmation","idempotency","amount-validation","server-authority"] },
  external_commands: { risk: "critical", mode: "adaptive", controls: ["command-allowlist","source-allowlist","payload-schema","confirmation-gates","lockdown-mode"] },
  backend: { risk: "critical", mode: "zero-trust", controls: ["rls","service-separation","secret-isolation","logging","backups","dependency-review","incident-runbook"] },
});

export function getAttackSurfaceSummary() {
  const entries = Object.entries(LOKIN_ATTACK_SURFACES);
  return {
    total: entries.length,
    critical: entries.filter(([,v]) => v.risk === "critical").length,
    high: entries.filter(([,v]) => v.risk === "high").length,
    guarded: entries.filter(([,v]) => ["guarded","adaptive","confirm","quarantine-first"].includes(v.mode)).length,
  };
}

export function surfacePolicy(name) {
  return LOKIN_ATTACK_SURFACES[name] || null;
}
