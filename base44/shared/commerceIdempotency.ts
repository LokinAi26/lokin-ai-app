// Idempotency guard for LOKIN commerce writes.
// Prevents duplicate order creation / fulfillment / invoice / completion when a
// request is replayed (network timeout + retry). The caller supplies a stable
// key (client key for new-resource writes, server-derived key for target-id writes).
//
// On a completed prior attempt the stored confirmed result is replayed instead
// of re-running the write. On an in-progress attempt a 409 is returned so the
// caller does not blind-retry. No tokens or secrets are persisted or logged.

export async function guardedIdempotentWrite(
  base44: any,
  operation: string,
  key: string,
  exec: () => Promise<Response>
): Promise<Response> {
  if (!base44 || !key) return exec();

  let rec: any = null;
  try {
    const found = await base44.asServiceRole.entities.CommerceIdempotencyKey.filter(
      { key, operation },
      undefined,
      1
    );
    rec = Array.isArray(found) ? found[0] : null;
  } catch (e) {
    console.error("idempotency lookup failed:", e?.message || e);
  }

  if (rec && rec.status === "completed") {
    const r = rec.result || {};
    return Response.json(r.body || r, { status: r.http_status || 200 });
  }
  if (rec && rec.status === "in_progress") {
    return Response.json(
      { error: "Operation already in progress. Wait a moment and retry with a fresh request." },
      { status: 409 }
    );
  }

  try {
    if (!rec) {
      rec = await base44.asServiceRole.entities.CommerceIdempotencyKey.create({
        key,
        operation,
        status: "in_progress",
      });
    } else {
      await base44.asServiceRole.entities.CommerceIdempotencyKey.update(rec.id, {
        status: "in_progress",
        error: "",
      });
    }
  } catch (e) {
    console.error("idempotency lock failed:", e?.message || e);
  }

  const response = await exec();
  if (rec) {
    try {
      const body = await response.clone().json().catch(() => null);
      await base44.asServiceRole.entities.CommerceIdempotencyKey.update(rec.id, {
        status: response.ok ? "completed" : "failed",
        result: { http_status: response.status, body },
        error: response.ok ? "" : JSON.stringify(body).slice(0, 500),
      });
    } catch (e) {
      console.error("idempotency record failed:", e?.message || e);
    }
  }
  return response;
}