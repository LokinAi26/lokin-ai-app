/**
 * LOKIN AI — Canonical Contracts: Approval & Execution
 *
 * Frozen source: SPEC-001 Method §§5–6 (Approval Service, Approval Event
 * Chain, Execution Guard); I1.
 *
 * Consequential actions cross a backend approval boundary. Gig-app
 * ACCEPT_ORDER / DECLINE_ORDER are FORBIDDEN capabilities and are absent
 * from every executable surface defined here.
 */

export interface ApprovalRequest {
  approvalId: string;
  correlationId: string;

  toolId: string;
  toolVersion: string;

  materialParameters: unknown;
  parameterHash: string;

  status:
    | "PENDING"
    | "APPROVED"
    | "DENIED"
    | "EXPIRED"
    | "CONSUMED";

  requestedAt: string;
  expiresAt: string;

  grantedAt?: string;
}

/**
 * I1 names this concept "ExecutionToken"; the Method's canonical interface
 * name is ActionExecutionToken. Both names refer to this single interface.
 *
 * Execution requires ALL of: registered ACTION tool AND valid approval AND
 * token ACTIVE AND token not expired AND tool/version match AND material
 * parameter hash match AND current preconditions pass. Failure of any
 * condition is fail-closed.
 */
export interface ActionExecutionToken {
  tokenId: string;

  approvalId: string;
  driverId: string;
  shiftId: string;

  toolId: string;
  toolVersion: string;

  parameterHash: string;

  issuedAt: string;
  expiresAt: string;

  status: "ACTIVE" | "CONSUMED" | "EXPIRED";
}

export type ExecutionToken = ActionExecutionToken;

export type PlannedActionStatus =
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "PENDING_CONNECTIVITY"
  | "EXECUTING"
  | "UNCERTAIN"
  | "EXECUTED"
  | "EXPIRED"
  | "PRUNED"
  | "FAILED";
