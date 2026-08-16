import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { COMMERCE_SCHEMA_MANIFEST } from "../../shared/commerceSchemaManifest.ts";
import { isCoreCommerceModel, COMMERCE_CORE_VERSION } from "../../shared/commerceModelRegistry.ts";

/**
 * LOKIN Commerce Schema Auditor
 *
 * Admin-only, preserve-first infrastructure for scanning legacy commerce schemas.
 * This function NEVER deletes schemas or records. It only classifies them and
 * records evidence in CommerceSchemaAudit. Deletion remains an explicit future
 * migration action after a second dependency scan and verified zero-record state.
 *
 * Actions:
 * - summary: returns manifest totals and current audit totals
 * - scanBatch: scans a bounded batch for records + static direct references
 * - candidate: returns only schemas currently certified as removal candidates
 */

const SCAN_VERSION = `core-${COMMERCE_CORE_VERSION}-audit-1`;
const MAX_BATCH = 25;

function recommendation({ isCore, directReferenceCount, hasRecords }) {
  if (isCore) return { classification: "core", recommendation: "KEEP — authoritative Commerce Intelligence Core model." };
  if (directReferenceCount > 0) return { classification: "dependency", recommendation: "KEEP — active code/backend dependency detected." };
  if (hasRecords) return { classification: "data", recommendation: "KEEP — persisted records detected; migrate only with field-level verification." };
  return { classification: "candidate", recommendation: "PRESERVE FOR NOW — zero records + zero direct refs; eligible for second-pass dependency certification." };
}

async function sampleEntity(base44, name) {
  try {
    const api = base44.asServiceRole.entities[name];
    if (!api?.filter) return { supported: false, hasRecords: false, sampleRecordId: "" };
    const rows = await api.filter({}, "-created_date", 1);
    const first = Array.isArray(rows) ? rows[0] : null;
    return { supported: true, hasRecords: !!first, sampleRecordId: first?.id ? String(first.id) : "" };
  } catch (error) {
    return { supported: false, hasRecords: false, sampleRecordId: "", error: String(error?.message || error) };
  }
}

async function upsertAudit(base44, row) {
  const existing = await base44.asServiceRole.entities.CommerceSchemaAudit.filter({ schema_name: row.schema_name }, "-updated_date", 1);
  if (existing?.[0]) return base44.asServiceRole.entities.CommerceSchemaAudit.update(existing[0].id, row);
  return base44.asServiceRole.entities.CommerceSchemaAudit.create(row);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "summary");

    if (action === "summary") {
      const audits = await base44.asServiceRole.entities.CommerceSchemaAudit.filter({});
      const counts = { core: 0, dependency: 0, data: 0, candidate: 0, error: 0 };
      for (const a of audits || []) counts[a.classification] = (counts[a.classification] || 0) + 1;
      return Response.json({
        scan_version: SCAN_VERSION,
        manifest_count: COMMERCE_SCHEMA_MANIFEST.length,
        audited_count: audits?.length || 0,
        remaining_count: Math.max(0, COMMERCE_SCHEMA_MANIFEST.length - (audits?.length || 0)),
        counts,
        deletion_enabled: false,
        safety_rule: "No schema deletion occurs in the auditor. Candidates require zero records, zero direct refs, and a second-pass dependency certification.",
      });
    }

    if (action === "scanBatch") {
      const offset = Math.max(0, Number(payload.offset) || 0);
      const limit = Math.min(MAX_BATCH, Math.max(1, Number(payload.limit) || 20));
      const batch = COMMERCE_SCHEMA_MANIFEST.slice(offset, offset + limit);
      const results = [];

      for (const item of batch) {
        const sample = await sampleEntity(base44, item.name);
        const isCore = isCoreCommerceModel(item.name) || item.name === "CommerceSchemaAudit";
        const policy = sample.supported
          ? recommendation({ isCore, directReferenceCount: item.directReferenceCount, hasRecords: sample.hasRecords })
          : { classification: "error", recommendation: "KEEP — runtime data check unavailable; manual review required." };
        const row = {
          schema_name: item.name,
          is_core: isCore,
          direct_reference_count: item.directReferenceCount,
          has_records: sample.hasRecords,
          sample_record_id: sample.sampleRecordId || "",
          classification: policy.classification,
          recommendation: policy.recommendation,
          last_scanned_at: new Date().toISOString(),
          scan_version: SCAN_VERSION,
        };
        await upsertAudit(base44, row);
        results.push({ ...row, runtime_check_supported: sample.supported, runtime_error: sample.error || null });
      }

      return Response.json({
        scan_version: SCAN_VERSION,
        offset,
        scanned: results.length,
        next_offset: offset + results.length < COMMERCE_SCHEMA_MANIFEST.length ? offset + results.length : null,
        total: COMMERCE_SCHEMA_MANIFEST.length,
        deletion_enabled: false,
        results,
      });
    }

    if (action === "candidate") {
      const candidates = await base44.asServiceRole.entities.CommerceSchemaAudit.filter({ classification: "candidate", has_records: false, direct_reference_count: 0 });
      return Response.json({
        count: candidates?.length || 0,
        candidates: candidates || [],
        deletion_enabled: false,
        note: "Candidate means preserve-first second-pass review, not automatic deletion approval.",
      });
    }

    return Response.json({ error: "Invalid action. Use summary, scanBatch, or candidate." }, { status: 400 });
  } catch (error) {
    console.error("commerce-schema-auditor error", error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
