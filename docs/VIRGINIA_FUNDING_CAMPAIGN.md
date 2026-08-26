# LOKIN Virginia Funding + Operational Readiness Campaign

Status date: 2026-08-26
Scope: LOKIN AI + LOKIN Productions / Manifesto Films
Owner system: LOKIN AI funding-control entities

## Operating rule

No funding program, legal registration, license, native-device validation, or provider-rights status may be represented as complete without authoritative evidence. Product code, a product name, or a successful web build is not proof of a government filing, legal status, physical-device test, or contractual right.

Sensitive identifiers (FEIN, SSN, tax credentials, bank details, provider secrets) must not be stored in public app source or ordinary evidence text. Store only verification status and non-sensitive reference metadata.

## Funding priority

### Track A — LOKIN AI: NSF SBIR/STTR Mobility

Primary target: NSF 26-510 Mobility
Current full-proposal due date target: 2026-11-04
Phase I ceiling currently published by NSF Seed Fund: up to $305,000
Current campaign stage: Project Pitch preparation

Technical thesis:
LOKIN Adaptive Driver Decision Intelligence combines bounded mobile sensor fusion, authoritative GNSS anchors, temporary dead-reckoned estimates, HMM-style road matching, confidence/uncertainty calibration, route/offer context, and explainable SEAL decisioning. The R&D question is whether this architecture can measurably reduce wrong-road inference, false reroutes, degraded-GNSS errors, and low-confidence driver recommendations without turning temporary estimates into false authoritative location.

Existing evidence:
- SEAL decision records with score, confidence, reason codes, uncertainty codes, projected economics, policy/engine version, and driver-confirmation requirements.
- Sensor Fusion v2.1 Swift/Kotlin implementation.
- Navigation route-match, drift, recovery, calibration, anchor-lineage, telemetry and reroute-decision entities.
- Physical field-calibration protocol for tunnel/garage, parallel roads, urban canyon, battery, offline recovery and background/screen lock.
- Explicit authoritative vs dead-reckoned provenance.

Do not claim:
- physical-device validation is complete;
- dead reckoning is absolute positioning;
- the research project is merely completion of the existing app.

### Track B — VIPC Federal Funding Assistance Program

Purpose: strengthen LOKIN AI's SBIR/STTR pursuit with Virginia-specific proposal guidance, training and eligible proposal-support resources.

Use the same non-confidential technical thesis as Track A. Do not create a contradictory second R&D story.

### Track C — Virginia eVA government contracting

Products:
- LOKIN AI: software, AI, analytics, automation, mobility/GIS, workflow integration, decision-support systems.
- LOKIN Productions: media systems, AI production orchestration, digital production workflows, media automation, QC/provenance tooling.

Required before payment-ready vendor posture:
- verified legal entity/tax identity;
- eVA supplier registration;
- signed/dated COVA Substitute W-9;
- relevant commodity codes;
- capability statements;
- SWaM evaluation/application if eligible.

### Track D — LOKIN Productions NSF AI R&D

Hold until the primary LOKIN AI NSF Project Pitch is resolved because NSF limits parallel Phase I consideration by the same company.

Potential technical thesis:
Provider-neutral multimodal generation orchestration that predicts route quality/cost/latency, preserves provenance and temporal/identity continuity across heterogeneous providers, detects failed outputs before downstream spend, and recovers workflow state without regenerating verified completed media.

Ordinary video generation, editing, API integration, and film production are not sufficient R&D claims by themselves.

### Track E — VIPC venture capital

- Launch Grant: $50,000, strict pre-MVP/pre-product-revenue, 1:1 match. Existing LOKIN implementation means stage fit must be tested truthfully; do not relabel a functioning MVP as pre-MVP.
- Launch Note: up to $150,000, convertible financing with matching-investment requirements.
- VVP Pre-Seed: up to $250,000, MVP + early traction and financing-round requirements.
- VVP Seed: later-stage path after real traction/fundraising eligibility.

### Track F — Virginia Beach Small Business Grant

Conditional only. Up to $10,000. First 2026 cycle opens 2026-10-01 and closes 2026-10-30. Eligible uses include online/mobile presence; payroll/salary/insurance/lease/personal expenses are not eligible. Requires a valid Virginia Beach business license, at least one year operating in the City, current local obligations, required documentation and a mandatory pre-application workshop.

Do not activate this application until location and one-year eligibility are verified.

## Virginia operational-readiness gates

### Corporate
- Exact legal applicant entity: NEEDS USER/AUTHORITATIVE VERIFICATION.
- SCC entity ID/good standing: NEEDS VERIFICATION.
- Fictitious-name/DBA filings for product brands where required: NEEDS VERIFICATION.
- Founder/contractor IP assignments and chain of title: NEEDS VERIFICATION.

### Tax
- FEIN aligned to legal name: NEEDS VERIFICATION.
- Virginia Tax registrations/NAICS/tax types: NEEDS VERIFICATION.

### Locality
- Actual Virginia operating locality: NEEDS VERIFICATION.
- Local business license/zoning/home-occupation requirements: NEEDS VERIFICATION.

### Procurement
- eVA supplier status: NEEDS VERIFICATION.
- COVA Substitute W-9: NEEDS VERIFICATION.
- SWaM: NEEDS VERIFICATION.

### Federal funding
- Project Pitch can proceed before SAM/Research.gov/SBA Company Registry registrations.
- An invited NSF full proposal requires active SAM/UEI, Research.gov and SBA Company Registry registrations using matching entity information.

### LOKIN AI privacy/location

Current technical positives:
- user-scoped data controls;
- separate authoritative/estimated location lineage;
- bounded navigation telemetry architecture;
- general Privacy Policy and account-deletion path.

Required before claiming Virginia privacy-law compliance:
- confirm applicability and legal-controller identity;
- explicitly validate consent for sensitive/precise location where required;
- verify minimization and purpose limitation;
- document retention/deletion behavior;
- provide consumer request and appeal mechanics when required;
- verify categories of third-party sharing;
- maintain reasonable security safeguards;
- never sell precise geolocation data.

### LOKIN AI regulated features

Verified release posture as of 2026-08-26:
- RELEASE_FLAGS.regulatedCannabis = false.
- Cannabis routes are ReleaseGate-protected.
- Cannabis items are hidden from More when release flag is false.
- CannabisMarketConfig returned zero live records during campaign review.

Policy: exclude cannabis commerce/delivery from initial Virginia launch and funding claims unless separately authorized after legal/licensing/partner review.

### LOKIN AI native validation

BLOCKED from production-validated claim:
- Swift/Kotlin navigation packages are build-ready but not proven compiled into signed shipping shells by current Base44 evidence.
- No ProductionNativeConfig or NavigationNativeBuildStatus validation records were present during campaign review.
- Apple AASA documentation records empty app association details until final Team ID/Bundle ID are inserted.
- Physical field testing remains required.

### LOKIN Productions rights/provenance

Technical strengths:
- provider/model provenance;
- checksums;
- QC status;
- persisted-asset truth gates;
- explicit reference fallback;
- cost/unit separation;
- provider health and circuit routing;
- completed-work reuse and idempotency.

Required legal tightening:
- provider-by-provider terms review;
- input/source rights documentation;
- music/SFX/voice rights documentation;
- avoid blanket ownership promises not supported by provider/source terms.

## Current internal campaign records

Base44 entities:
- FundingProgram — authoritative program registry.
- FundingApplication — application execution state and blockers.
- VirginiaReadinessItem — evidence-backed corporate/tax/procurement/privacy/native/IP readiness gates.

Admin-only RLS is enabled on these campaign entities.

## Immediate execution order

1. Verify exact legal Virginia applicant entity, SCC status, FEIN alignment and IP ownership.
2. Prepare one non-confidential LOKIN AI R&D abstract.
3. Engage VIPC FFAP.
4. Submit the NSF Project Pitch for LOKIN AI Mobility/Trustworthy AI fit.
5. Start SAM/UEI + Research.gov + SBA Company Registry in parallel so an invitation does not create registration delay.
6. Complete eVA + COVA W-9 + SWaM path.
7. Build separate government capability statements for LOKIN AI and LOKIN Productions.
8. Complete LOKIN AI Virginia privacy/legal review and native physical validation.
9. Validate Virginia Beach grant eligibility before attending workshop/applying.
10. Develop LOKIN Productions R&D hypotheses while its NSF track remains sequenced behind the primary pitch.
