import { secrets } from "base44:runtime";

// Shared internal job key guard. Authorizes machine-to-machine invocations of
// LOKIN internal jobs (scheduled workflows and authorized bridges) using the
// LOKIN_INTERNAL_JOB_KEY secret. The key may be supplied either in the
// x-lokin-internal-job-key request header or the internal_job_key body field.
// Returns false when the secret is unset or the supplied key does not match.
export async function hasInternalJobKey(req: Request, body: any): Promise<boolean> {
  try {
    const expected = String(await Promise.resolve(secrets.get("LOKIN_INTERNAL_JOB_KEY")) || "");
    if (!expected) return false;
    const supplied = String(req?.headers?.get?.("x-lokin-internal-job-key") || body?.internal_job_key || "").trim();
    if (!supplied) return false;
    return supplied.length === expected.length && supplied === expected;
  } catch {
    return false;
  }
}