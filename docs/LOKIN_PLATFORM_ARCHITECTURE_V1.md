# LOKIN Platform Architecture v1

## Platform identity

LOKIN AI is an AI-powered mobility and driver intelligence operating system. The platform unifies driver work state, navigation, provider data, earnings intelligence, AI recommendations, commerce, native runtime services, and LOKIN Vision behind a shared control plane.

## Architectural objective

Build LOKIN as a modular platform instead of a collection of independent screens and features. Every production capability must belong to one bounded domain, communicate through explicit contracts, and preserve canonical state, provenance, authorization, and auditability.

## Platform topology

```text
                           ┌───────────────────────────┐
                           │   UNIFIED CONTROL PLANE   │
                           │ state • policy • audit    │
                           │ capability • checkpoint  │
                           └─────────────┬─────────────┘
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
┌─────────▼─────────┐          ┌─────────▼─────────┐          ┌─────────▼─────────┐
│ DRIVER OPERATIONS │          │ LOKIN INTELLIGENCE│          │ PROVIDER FABRIC   │
│ sessions • goals  │◄────────►│ Ask LOKIN • Seal  │◄────────►│ OAuth • ingestion │
│ mileage • safety  │          │ learning • models │          │ normalization     │
└─────────┬─────────┘          └─────────┬─────────┘          └─────────┬─────────┘
          │                              │                              │
          └──────────────┐               │               ┌──────────────┘
                         │               │               │
               ┌─────────▼───────────────▼───────────────▼─────────┐
               │       NAVIGATION & ROUTE INTELLIGENCE             │
               │ map • route • road match • sensor fusion • ETA    │
               └───────────────────────┬───────────────────────────┘
                                       │
                         ┌─────────────▼─────────────┐
                         │ NATIVE RUNTIME / VISION   │
                         │ iOS • Android • XR • HUD  │
                         └───────────────────────────┘

          ┌────────────────────────────────────────────────────────┐
          │ COMMERCE & OASIS                                      │
          │ storefront • fulfillment • product • production       │
          │ consumes Control + Intelligence + Provider contracts  │
          └────────────────────────────────────────────────────────┘
```

## Bounded domains

### 1. Unified Control Plane

Responsibilities:
- Canonical cross-domain state.
- Versioning and hash-addressed state.
- Capability authorization.
- Audit events.
- Idempotency policy.
- Feature flags and health state.
- Checkpoints and immutable approvals.

Existing spine:
- `base44/shared/unifiedControlPlane.js`
- `base44/shared/capabilityBroker.js`
- `LokinControlState`
- `LokinControlEvent`

Rule: no domain should invent its own competing global truth source.

### 2. Driver Operations

Responsibilities:
- Lock In / Pause / Resume / Tap Out.
- Driver goal and active work context.
- Session continuity across refresh, force-close, and relaunch.
- Mileage and earnings session attribution.
- Safety and active-driving state.

Canonical state owner:
- `DriverPreference.work_status` plus persisted session records.

Rule: navigation, AI, and UI may consume driver state but must not independently redefine it.

### 3. Navigation & Route Intelligence

Responsibilities:
- Map presentation.
- Route calculation and optimization.
- Road matching.
- Rerouting.
- ETA and route telemetry.
- Sensor fusion and dead reckoning.
- Navigation quality and calibration.

Rule: map rendering and navigation state are separate concerns. Rendering failures must not corrupt route/session truth.

### 4. LOKIN Intelligence

Responsibilities:
- Ask LOKIN voice/text interface.
- LOKIN Seal scoring and evidence confidence.
- Offer/work recommendations.
- Model routing.
- Learning and outcome feedback.
- Explanation and recommendation provenance.

Truth contract:
- VERIFIED
- DRIVER REPORTED
- ESTIMATED / MODELED

Rule: intelligence may recommend but must not fabricate provider data or silently perform provider actions.

### 5. Provider & Integration Fabric

Responsibilities:
- Provider OAuth and approved integrations.
- Manual/verified capture fallback.
- Provider capability registry.
- External schema normalization.
- Connection and sync health.

Canonical adapter contract:

```text
External provider
    ↓
Provider adapter
    ↓
Capability validation
    ↓
Normalize into LOKIN schema
    ↓
Attach provenance + confidence
    ↓
Domain consumer
```

Rule: provider capability must be truthful. Unsupported live-offer or automatic acceptance functionality must not be implied.

### 6. Commerce & Oasis

Responsibilities:
- LOKIN Commerce orchestration.
- Shopify/Printful/Printify integrations.
- Order lifecycle and fulfillment.
- Product intelligence.
- Oasis design and production workflows.
- Asset lineage and approvals.

Rule: Commerce is a platform domain, not a second application architecture. It consumes shared Control, Intelligence, and Provider contracts.

### 7. Native Runtime & LOKIN Vision

Responsibilities:
- iOS and Android native bridges.
- Location and motion permissions.
- Native sensor fusion runtime.
- Universal links / App Intents.
- LOKIN Vision XR bridge and HUD telemetry.

Rule: native clients consume the same platform contracts as the web shell. Native implementations must not fork business truth.

## Core data flow

```text
Provider / User / Sensor input
          ↓
Validation + provenance
          ↓
Provider or Native adapter
          ↓
Canonical domain model
          ↓
Unified Control Plane
          ↓
LOKIN Intelligence
          ↓
Recommendation / Route / UI state
          ↓
Driver confirmation where required
          ↓
Action + audit event + outcome learning
```

## Platform invariants

1. Provider-neutral architecture.
2. No fabricated offers, payouts, demand, routes, or provider capability.
3. Driver confirmation for external provider decisions/actions unless an explicitly approved integration contract allows otherwise.
4. One canonical session-state model.
5. Every high-risk mutation passes capability authorization.
6. State mutations are idempotent where retry is possible.
7. Important decisions carry source/provenance/confidence.
8. Web, native, and Vision clients consume common domain contracts.
9. UI modules do not become systems of record.
10. A domain failure must degrade locally rather than corrupt unrelated domains.

## API/service boundary standard

Every cross-domain operation should use an envelope equivalent to:

```json
{
  "request_id": "uuid",
  "correlation_id": "uuid",
  "domain": "navigation",
  "operation": "optimize_route",
  "actor": {
    "user_id": "...",
    "source": "ios"
  },
  "input": {},
  "context": {
    "session_id": "...",
    "provider": "..."
  },
  "policy": {
    "idempotency_key": "...",
    "requires_confirmation": false
  }
}
```

Responses should include:
- status
- result
- evidence/provenance
- confidence when inferred
- warnings
- correlation ID
- timing/latency

## Build phases

### Phase 1 — Platform spine

- Canonical domain registry.
- Unified control-plane ownership.
- Common command envelope.
- Capability policy coverage.
- Domain health endpoints.
- Platform verification suite.

Acceptance gate: every major production function can be assigned to exactly one primary domain.

### Phase 2 — Driver + Navigation core

- Stabilize canonical work/session state.
- Route optimizer service boundary.
- Navigation engine service boundary.
- Sensor fusion/native bridge contract.
- Unified route/session telemetry.

Acceptance gate: Lock In → route → navigation → pause/resume → Tap Out survives app relaunch with no state divergence.

### Phase 3 — Intelligence layer

- Ask LOKIN uses shared context assembler.
- LOKIN Seal becomes the shared recommendation contract.
- Recommendation provenance enforced.
- Model router separated from product UI.
- Outcome learning closes the feedback loop.

Acceptance gate: recommendations can be traced to source data and confidence.

### Phase 4 — Provider fabric

- One adapter interface for approved providers.
- Connection state and scopes centralized.
- Offer/task normalization standardized.
- Manual capture represented as a first-class source with provenance.

Acceptance gate: provider-specific logic does not leak into Driver or Navigation domains.

### Phase 5 — Commerce + Oasis integration

- Reduce duplicate Commerce state/entity types.
- Define canonical order, fulfillment, inventory, and production state machines.
- Route all commerce automation through capability and control layers.

Acceptance gate: Commerce/Oasis can evolve independently without changing driver/navigation contracts.

### Phase 6 — Native + Vision runtime

- Native location engine uses Navigation contracts.
- App Intents/voice use shared command bus.
- LOKIN Vision consumes navigation/intelligence state through a versioned bridge.

Acceptance gate: iPhone, Android, and Vision surfaces show consistent canonical state.

### Phase 7 — Observability and scale

- Platform health aggregation.
- Domain-level latency/error budgets.
- Structured tracing with correlation IDs.
- Dead-letter and retry contracts.
- Cost/usage budgets for model inference.

Acceptance gate: failures can be isolated to a domain and diagnosed without reconstructing state manually.

## Immediate repository decisions

Keep and elevate:
- `unifiedControlPlane.js`
- `capabilityBroker.js`
- `driverProviderRegistry.js`
- `modelRouter.js`
- `seal.js`
- navigation verification suite
- native location/sensor fusion runtime

Consolidate over time:
- duplicate/overlapping Commerce entities
- temporary `_NoOp*` and `Temp*` schemas
- multiple components that independently calculate the same derived driver/earnings state
- provider-specific branching outside provider adapters

Do not perform destructive consolidation until data migration and compatibility checks exist.

## Platform north-star contract

LOKIN should behave as one operating system even when its capabilities are implemented by many services:

**Sense → Normalize → Understand → Recommend → Confirm → Act → Learn**

That loop is the architectural center of the platform.
