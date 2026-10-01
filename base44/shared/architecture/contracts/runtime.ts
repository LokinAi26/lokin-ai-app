/**
 * LOKIN AI — Canonical Contracts: Runtime, Manifests
 *
 * Frozen source: SPEC-001 Method §§30–31 (RuntimeStatus resolving the
 * previously overlapping health models; Release Safety), §7 (Atomic
 * Recovery Manifest), Part 7 I59–I72 (ArchitectureRuntimeManifest); I1.
 */

export type RuntimeHealth =
  | "ONLINE"
  | "AI_UNAVAILABLE"
  | "BACKEND_UNAVAILABLE"
  | "OFFLINE"
  | "RECOVERING";

export interface RuntimeStatus {
  service:
    | "ONLINE"
    | "AI_UNAVAILABLE"
    | "BACKEND_UNAVAILABLE"
    | "OFFLINE"
    | "RECOVERING";

  recovery: {
    state:
      | "COMPLETE"
      | "RECONCILING"
      | "INCOMPLETE"
      | "LOCAL_STORE_UNAVAILABLE";

    possiblyMissingEvents: boolean;
  };
}

/**
 * One immutable manifest generated at build time, containing all
 * policy/schema/evaluator/registry versions. Its hash is embedded in
 * SESSION_STARTED, giving every shift an exact architecture fingerprint.
 * Individual event fields still retain their relevant specific versions.
 *
 * Frozen source: Part 7 I59–I72. Field structure is the minimal faithful
 * reading of "containing all policy/schema/evaluator/registry versions";
 * field-level refinement requires a documented delta.
 */
export interface ArchitectureRuntimeManifest {
  manifestHash: string;
  generatedAt: string;
  commitSha: string;

  policyVersions: Record<string, string>;
  schemaVersions: Record<string, string>;
  evaluatorVersions: Record<string, string>;
  registryVersions: Record<string, string>;
}

/**
 * Acceleration/recovery index. The immutable event log remains the source
 * from which operational state can be rebuilt.
 *
 * Frozen rule: the event append and the corresponding manifest update SHALL
 * occur in the SAME IndexedDB transaction — both commit or both rollback.
 */
export interface ShiftRecoveryManifest {
  shiftId: string;
  sessionId: string;

  lastMaterializedEventId: string;
  lastMaterializedSequence: number;

  pendingSyncEventIds: string[];

  activeJobIds: string[];

  navigation?: {
    routeId?: string;
    destinationId?: string;
    activeStopId?: string;
  };

  updatedAt: string;
}
