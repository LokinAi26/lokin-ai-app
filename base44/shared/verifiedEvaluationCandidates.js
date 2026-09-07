// Public availability does not establish account access or a working adapter.
export const VERIFIED_EVALUATION_CANDIDATES = Object.freeze([
  {
    provider: 'google',
    model: 'gemini-3.8-flash',
    status: 'SETUP_REQUIRED',
    enabled: false,
    public_documentation_verified_at: '2026-09-07',
    source: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash',
    required: ['provider adapter', 'account access check', 'served model identity', 'usage evidence', 'LOKIN evaluation pass'],
    automatic_promotion: false
  }
]);
