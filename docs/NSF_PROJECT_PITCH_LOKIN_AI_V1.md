# NSF Project Pitch — LOKIN Adaptive Driver Decision Intelligence

Status: REVIEW READY — company facts required before submission
Program: NSF SBIR/STTR Phase I, NSF 26-510
Primary fit: Mobility
Alternate fit if directed by NSF: Technologies for Trustworthy AI
Phase I ceiling: up to $305,000 for 6–18 months, subject to invitation and award

## Submission truth boundary

Existing LOKIN AI code, native packages, telemetry contracts, SEAL records, and synthetic verification are preliminary engineering evidence. Physical-device field validation, confidence calibration, road-discrimination performance, reroute thresholds, and the effect of uncertainty-aware decision intelligence are unresolved R&D questions. Do not state or imply that these Phase I research questions are already proven.

## 1. Technology Innovation — 2307 / 3500 characters

LOKIN Adaptive Driver Decision Intelligence is a high-risk mobility technology that combines confidence-calibrated phone sensor fusion with explainable, human-authorized decision intelligence for workers and operators moving goods through uncertain real-world environments.

Current mobile navigation and gig-work tools typically treat location, route state, and work opportunities as separate problems. They often depend on a single location stream, hide uncertainty from downstream decision logic, and can continue making route or earnings recommendations when the underlying evidence is weak. LOKIN’s innovation is a unified evidence model in which every mobility recommendation is conditioned on the quality and provenance of the state estimate used to make it.

The proposed Phase I R&D centers on a bounded fusion architecture that distinguishes authoritative GNSS/location-provider anchors from temporary inertial dead-reckoned estimates; propagates uncertainty as estimates age; performs online road matching using distance, heading, route continuity, expected travel, and segment-transition costs; and prevents low-confidence estimates from independently triggering network reroutes. That mobility state is then consumed by LOKIN’s SEAL decision layer, which produces an explainable TAKE / CONSIDER / PASS recommendation with a score, confidence, reason codes, uncertainty codes, projected economics, and a mandatory human-confirmation boundary.

The technical risk is substantial. Commodity phone IMUs drift quickly, urban canyons and parallel roads create ambiguous hypotheses, confidence scores can be poorly calibrated, and errors in state estimation can propagate into operational decisions. The core research question is whether a bounded, provenance-aware fusion and decision architecture can produce materially better calibrated mobility decisions than conventional location-first approaches without increasing raw GPS polling or pretending inertial estimates are absolute position.

If successful, the technology would create a reusable decision-intelligence layer for last-mile delivery, courier operations, field service, fleet workflows, and other movement-of-goods applications where position quality, route context, time, cost, and human authorization must be reasoned about together.

## 2. Technical Objectives and Challenges — 2607 / 3500 characters

Phase I will establish whether LOKIN’s confidence-calibrated mobility state and explainable decision layer can reduce technical risk enough to support commercialization.

Objective 1 — Quantify bounded dead-reckoning behavior. Build controlled tunnel/garage and offline-loss experiments using real mobile-device inertial and absolute-location anchors. Measure drift, uncertainty growth, confidence decay, recovery jump distance, and maximum useful prediction horizon. The system must stop or downgrade prediction when uncertainty exceeds calibrated limits rather than extrapolating indefinitely.

Objective 2 — Validate ambiguous-road discrimination. Evaluate the online road matcher on divided highways, frontage roads, dense urban grids, and other parallel-segment conditions. Compare candidate-segment selection using distance-only baselines versus distance + heading + continuity + expected-travel transition costs. Measure wrong-road snaps, match confidence, and recovery after degraded fixes.

Objective 3 — Calibrate reroute confidence. Test whether combining absolute-anchor evidence, map-match confidence, horizontal accuracy, repeated off-route samples, and dead-reckoning provenance reduces false reroutes. Dead-reckoned estimates will not independently authorize a network reroute. Key metrics include false-reroute rate, time to correct reroute, and missed-reroute rate.

Objective 4 — Couple mobility uncertainty to operational decisions. Feed the calibrated state into SEAL and measure whether confidence/uncertainty-aware recommendations improve decision quality compared with recommendations that ignore evidence quality. Candidate outcomes include projected-versus-actual net earnings rate, dollars per mile, completion time, recommendation acceptance, and human override.

Objective 5 — Establish a power/reliability envelope. Profile active navigation and low-power modes on representative iOS and Android devices while preserving absolute anchors and reducing inertial duty cycle where appropriate. Measure battery drop per hour, sensor sampling behavior, telemetry integrity, and offline queue recovery.

The Phase I result will be an experimentally supported set of calibration curves, decision thresholds, failure boundaries, and performance evidence—not simply a completed app. Failure is possible: phone sensors may not support a commercially useful outage horizon, road hypotheses may remain too ambiguous in some environments, or confidence-aware SEAL decisions may not outperform simpler baselines. Those uncertainties are precisely what the proposed R&D is designed to resolve.

## 3. Market Opportunity — 1442 / 1750 characters

LOKIN’s near-term market is technology for independent delivery/courier workers and small operators who must make repeated route, offer, and time-cost decisions while driving and shopping. The initial wedge is last-mile gig and courier work, where a poor route snap, false reroute, low-value offer, or avoidable mileage decision directly affects earnings, safety, and service quality.

The same underlying capability can extend to field service, merchant delivery, local fleets, medical/package courier operations, and logistics software that needs a confidence-aware mobility decision layer rather than another map UI.

Existing navigation products are strong at consumer routing, and gig platforms are strong at dispatch within their own networks. The unmet need is cross-workflow decision support that explicitly represents uncertainty, keeps estimated versus authoritative location provenance separate, combines route state with operating economics, and preserves the worker’s final authorization.

LOKIN plans to commercialize the technology through a driver-facing software product and, if validated, reusable B2B/API capabilities for mobility and operations platforms. Competitive advantage would come from the integrated evidence/decision architecture, learned outcome data, explainable reason codes, bounded safety behavior, and the ability to operate across authorized data sources rather than depending on one delivery marketplace.

## 4. Company and Team — 1491 / 1750 characters

LOKIN is a Virginia-centered, founder-led technology effort developing LOKIN AI and related production/operations systems. The current team has already implemented the software architecture needed to begin the proposed research: a Base44 application/control plane, iOS Swift and Android Kotlin native location packages, bounded sensor-fusion logic, an online HMM-style road matcher, structured navigation telemetry and calibration records, and the SEAL explainable decision schema.

The technical lead’s work spans application architecture, software integration, AI orchestration, mobile/location systems, automation, and production operations. Existing engineering artifacts include reproducible synthetic navigation checks and a physical-device field-calibration protocol covering tunnel/garage loss, parallel-road matching, urban canyon behavior, battery profiling, offline recovery, and background operation.

Phase I team gaps are being treated explicitly rather than hidden. LOKIN intends to add or contract specialized support where needed for statistical experimental design/geospatial validation, mobile sensor calibration, privacy/security review, and federal grant accounting/compliance. Any consultant or research-institution role will be defined before a full proposal and matched to SBIR/STTR eligibility requirements.

The company/legal applicant identity, PI employment status, and federal registrations will be verified before any invited full Phase I proposal is submitted.

## Required company facts before Project Pitch submission

- Exact legal Virginia applicant entity name and location
- Authorized representative name and contact information
- Corporate website used for the submission
- Whether this project/technology was previously submitted to NSF
- Whether the company has received a prior NSF SBIR/STTR award
- Whether the company currently has a Phase I proposal under NSF review

## Sequence

1. Fill the company facts above.
2. Perform final eligibility and truth review.
3. Submit one NSF Project Pitch.
4. Wait for NSF response before any second Project Pitch.
5. If invited, complete SAM/UEI, Research.gov, SBA Company Registry, full proposal, budget, PI eligibility, research-security, IP, and accounting gates.
