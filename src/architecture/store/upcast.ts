/**
 * LOKIN AI — Event schema upcasting (M1 evidence: "Older-schema fixtures
 * upcast deterministically").
 *
 * Frozen source: SPEC-001 M1 required evidence; Part 7 I59–I72
 * (schemaVersions in the ArchitectureRuntimeManifest).
 *
 * Raw stored payloads may predate the current event schema. Each upcaster
 * is version-pinned and deterministic: the same raw input always yields
 * the same ShiftEvent. Upcasters never mutate history semantics — they
 * only project older shapes onto the current contract.
 */

import { z } from "zod";
import { ShiftEventSchema } from "../contracts/index.js";
import type { ShiftEvent } from "../contracts/index.js";

export const EVENT_SCHEMA_VERSION = 1;

type Upcaster = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * v0 -> v1: the pre-amendment shape carried `version` (monotonic within the
 * originating session) but no sessionId/sequenceNumber. Deterministic rule:
 * sessionId becomes `${shiftId}:legacy`, sequenceNumber takes the old
 * version. Documented here; changing the rule is a versioned delta.
 */
const upcastV0ToV1: Upcaster = (raw) => {
  const { version, schemaVersion: _dropped, ...rest } = raw;
  const shiftId = typeof rest["shiftId"] === "string" ? rest["shiftId"] : "unknown";
  return {
    ...rest,
    sessionId:
      typeof rest["sessionId"] === "string" && rest["sessionId"]
        ? rest["sessionId"]
        : `${shiftId}:legacy`,
    sequenceNumber:
      typeof rest["sequenceNumber"] === "number"
        ? rest["sequenceNumber"]
        : typeof version === "number"
          ? version
          : 0,
  };
};

const UPCASTERS: Record<number, Upcaster> = {
  0: upcastV0ToV1,
};

const RawEventSchema = z.record(z.string(), z.unknown());

export function upcastEvent(raw: unknown): ShiftEvent {
  const record = RawEventSchema.parse(raw);
  const declared =
    typeof record["schemaVersion"] === "number"
      ? record["schemaVersion"]
      : EVENT_SCHEMA_VERSION;

  if (declared > EVENT_SCHEMA_VERSION) {
    throw new Error(
      `event schemaVersion ${declared} is newer than supported ${EVENT_SCHEMA_VERSION}`
    );
  }

  let current = record;
  for (let v = declared; v < EVENT_SCHEMA_VERSION; v++) {
    const upcaster = UPCASTERS[v];
    if (!upcaster) {
      throw new Error(`no upcaster registered for event schemaVersion ${v}`);
    }
    current = upcaster(current);
  }

  const { schemaVersion: _ignored, ...eventFields } = current;
  // Runtime-validated by zod; the cast bridges the rest-destructure's
  // optional-field inference, not a validation gap.
  return ShiftEventSchema.parse(eventFields) as ShiftEvent;
}
