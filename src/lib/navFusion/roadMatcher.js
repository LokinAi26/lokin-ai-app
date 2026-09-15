import { clamp } from "@/lib/navigationQuality";

/**
 * Nav Fusion v3.5 road matcher — a pure, side-effect-free candidate scorer.
 * Real map-tile candidates arrive in a later port; until then the stub
 * candidate source below feeds unit tests with deterministic geometry.
 */
export const SCORING_WEIGHTS = Object.freeze({
  heading: 0.35,
  speed: 0.10,
  turnRestrictions: 0.15,
  routeContext: 0.15,
  intersectionTopology: 0.05,
  recentSegments: 0.10,
  gpsUncertainty: 0.05,
  expectedManeuver: 0.05,
});

function bearingDeltaDeg(a, b) {
  if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return null;
  return Math.abs((((Number(a) - Number(b)) % 360) + 540) % 360 - 180);
}

function headingAgreementScore(deltaDeg) {
  if (deltaDeg == null) return 0.5;
  return (1 + Math.cos((deltaDeg * Math.PI) / 180)) / 2;
}

/**
 * Scores candidate road segments against the current position and navigation
 * context. Components: heading agreement, speed plausibility, turn
 * restrictions, route context, intersection topology, recently matched
 * segments, GPS uncertainty, and the expected maneuver.
 *
 * @returns {{ scored: Array<Object>, best: Object|null, confidence: number }}
 */
export function scoreCandidates(position, candidates = [], context = {}) {
  const uncertaintyM = Math.max(
    1,
    Number(position?.confidenceRadius) || Number(position?.horizontalAccuracy) || 1
  );
  const recentSegmentIds = new Set(context.recentSegmentIds || []);
  const expectedSegmentId = context.expectedManeuverSegmentId || null;
  const expectedBearing = Number.isFinite(Number(context.expectedBearing)) ? Number(context.expectedBearing) : null;
  const weightTotal = Object.values(SCORING_WEIGHTS).reduce((sum, weight) => sum + weight, 0);

  const entries = (candidates || []).map((candidate) => {
    const headingAgreement = headingAgreementScore(bearingDeltaDeg(position?.bearing, candidate?.heading));
    const speed = Math.max(0, Number(position?.speed) || 0);
    const maxSpeedMps = Number(candidate?.maxSpeedMps);
    const speedPlausibility = !Number.isFinite(maxSpeedMps)
      ? 1
      : clamp(1 - Math.max(0, speed - maxSpeedMps) / Math.max(1, maxSpeedMps), 0, 1);
    const approachDelta = bearingDeltaDeg(position?.bearing, candidate?.approachBearing);
    const turnScore = candidate?.turnRestricted === true && approachDelta != null && approachDelta > 90 ? 0 : 1;
    const routeScore = candidate?.onRoute === true ? 1 : 0.5;
    const intersectionScore = candidate?.isIntersectionConnector === true && headingAgreement < 0.9 ? 0.5 : 1;
    const recentScore = candidate?.segmentId != null && recentSegmentIds.has(candidate.segmentId) ? 1 : 0.5;
    const distanceM = Number.isFinite(Number(candidate?.distanceM)) ? Number(candidate.distanceM) : uncertaintyM;
    const gpsScore = clamp(1 - distanceM / (2 * uncertaintyM), 0, 1);
    const maneuverScore = expectedSegmentId != null && candidate?.segmentId === expectedSegmentId
      ? 1
      : headingAgreementScore(bearingDeltaDeg(expectedBearing, candidate?.heading));

    const score =
      (SCORING_WEIGHTS.heading * headingAgreement +
        SCORING_WEIGHTS.speed * speedPlausibility +
        SCORING_WEIGHTS.turnRestrictions * turnScore +
        SCORING_WEIGHTS.routeContext * routeScore +
        SCORING_WEIGHTS.intersectionTopology * intersectionScore +
        SCORING_WEIGHTS.recentSegments * recentScore +
        SCORING_WEIGHTS.gpsUncertainty * gpsScore +
        SCORING_WEIGHTS.expectedManeuver * maneuverScore) /
      weightTotal;

    return {
      candidate,
      score: clamp(score, 0, 1),
      components: {
        headingAgreement,
        speedPlausibility,
        turnScore,
        routeScore,
        intersectionScore,
        recentScore,
        gpsScore,
        maneuverScore,
      },
    };
  }).sort((a, b) => b.score - a.score);

  return {
    scored: entries.map((entry) => ({
      ...entry.candidate,
      score: entry.score,
      scoreComponents: entry.components,
    })),
    best: entries[0]
      ? { ...entries[0].candidate, score: entries[0].score, scoreComponents: entries[0].components }
      : null,
    confidence: entries[0] ? clamp(entries[0].score, 0, 1) : 0,
  };
}

/**
 * Stub candidate source: synthesizes deterministic nearby candidates from
 * the incoming position for unit tests. Replace with real map-tile
 * candidates in a later port — the scorer above stays unchanged.
 */
export function getStubCandidates(position, context = {}) {
  const bearing = Number.isFinite(Number(position?.bearing)) ? Number(position.bearing) : 0;
  const crossStreetBearing = (bearing + 90) % 360;
  const excludedSegmentIds = new Set(context.excludedSegmentIds || []);
  return [
    {
      segmentId: "stub-on-route",
      heading: bearing,
      approachBearing: bearing,
      maxSpeedMps: 40,
      distanceM: 2,
      onRoute: true,
      turnRestricted: false,
      isIntersectionConnector: false,
    },
    {
      segmentId: "stub-cross-street",
      heading: crossStreetBearing,
      approachBearing: crossStreetBearing,
      maxSpeedMps: 15,
      distanceM: 6,
      onRoute: false,
      turnRestricted: true,
      isIntersectionConnector: true,
    },
  ].filter((candidate) => !excludedSegmentIds.has(candidate.segmentId));
}