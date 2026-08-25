import { createClientFromRequest } from "npm:@base44/sdk@0.8.43";

type Point = {
  seq: number;
  timestampMs: number;
  latitude: number;
  longitude: number;
  horizontalAccuracyM?: number;
  confidence?: number | null;
  deadReckoned?: boolean | null;
  authoritative?: boolean | null;
  anchorSeq?: number | null;
  estimatedUncertaintyM?: number | null;
  source?: string;
};

function validPoint(raw: any): Point | null {
  const seq = Number(raw?.seq);
  const timestampMs = Number(raw?.timestampMs);
  const latitude = Number(raw?.latitude);
  const longitude = Number(raw?.longitude);
  if (!Number.isSafeInteger(seq) || seq <= 0) return null;
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return null;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;

  const deadReckoned = raw?.deadReckoned === true;
  // Backward-compatible: older absolute-anchor queue records predate the
  // explicit authoritative field. Only an explicit false or DR provenance
  // downgrades the point from an absolute provider anchor.
  const authoritative = !deadReckoned && raw?.authoritative !== false;
  const anchorSeqRaw = Number(raw?.anchorSeq);
  const anchorSeq = Number.isSafeInteger(anchorSeqRaw) && anchorSeqRaw > 0 ? anchorSeqRaw : null;

  return {
    seq,
    timestampMs,
    latitude,
    longitude,
    horizontalAccuracyM: Math.max(0, Number(raw?.horizontalAccuracyM) || 0),
    confidence: Number.isFinite(Number(raw?.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : null,
    deadReckoned,
    authoritative,
    anchorSeq,
    estimatedUncertaintyM: Number.isFinite(Number(raw?.estimatedUncertaintyM)) ? Math.max(0, Number(raw.estimatedUncertaintyM)) : null,
    source: String(raw?.source || "unknown").slice(0, 120),
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || body?.sessionId || "").trim().slice(0, 160);
    if (!sessionId) return Response.json({ error: "session_id is required" }, { status: 400 });
    if (!Array.isArray(body?.points) || body.points.length < 1 || body.points.length > 120) {
      return Response.json({ error: "points must contain 1-120 location samples" }, { status: 400 });
    }

    const points = body.points.map(validPoint);
    if (points.some((p: Point | null) => !p)) {
      return Response.json({ error: "One or more location samples are invalid" }, { status: 400 });
    }
    const clean = (points as Point[]).sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < clean.length; i++) {
      if (clean[i].seq === clean[i - 1].seq) {
        return Response.json({ error: "Duplicate sequence number in batch" }, { status: 400 });
      }
    }

    const firstSeq = clean[0].seq;
    const lastSeq = clean[clean.length - 1].seq;
    const authoritativeCount = clean.filter((p) => p.authoritative === true).length;
    const estimatedCount = clean.filter((p) => p.deadReckoned === true || p.authoritative !== true).length;
    const payloadJson = JSON.stringify(clean);
    if (payloadJson.length > 100_000) return Response.json({ error: "Batch payload too large" }, { status: 413 });

    await base44.entities.NavigationTelemetryBatch.create({
      session_id: sessionId,
      first_seq: firstSeq,
      last_seq: lastSeq,
      point_count: clean.length,
      authoritative_count: authoritativeCount,
      estimated_count: estimatedCount,
      payload_json: payloadJson,
    });

    return Response.json({
      ok: true,
      acceptedThrough: lastSeq,
      authoritativeCount,
      estimatedCount,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Navigation telemetry ingest failed" }, { status: 500 });
  }
}
