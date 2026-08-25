import Foundation
import CoreLocation

enum LokinTrackingMode: String, Codable {
    case stopped
    case passive
    case activeNavigation
}

struct LokinLocationSample: Codable, Sendable {
    let seq: Int64
    let timestampMs: Int64
    let latitude: Double
    let longitude: Double
    let altitudeM: Double?
    let horizontalAccuracyM: Double
    let verticalAccuracyM: Double?
    let speedMps: Double?
    let headingDeg: Double?
    let source: String
    let confidence: Double?
    let deadReckoned: Bool?
    let barometricAltitudeM: Double?
    /// True only for an absolute Core Location/Fused Location anchor.
    /// Dead-reckoned samples are persisted, but never mislabeled as absolute.
    let authoritative: Bool?
    /// Sequence number of the absolute fix that seeded this estimate.
    let anchorSeq: Int64?
    /// Explicit uncertainty carried through offline replay/backend ingestion.
    let estimatedUncertaintyM: Double?

    var compactArray: [Any] {
        [
            seq,
            timestampMs,
            Int64((latitude * 10_000_000).rounded()),
            Int64((longitude * 10_000_000).rounded()),
            Int((horizontalAccuracyM * 10).rounded()),
            speedMps.map { Int(($0 * 100).rounded()) } ?? NSNull(),
            headingDeg.map { Int(($0 * 100).rounded()) } ?? NSNull(),
            altitudeM.map { Int(($0 * 10).rounded()) } ?? NSNull(),
            source,
            confidence.map { Int(($0 * 1000).rounded()) } ?? NSNull(),
            deadReckoned ?? false,
            authoritative ?? !(deadReckoned ?? false),
            anchorSeq ?? NSNull(),
            estimatedUncertaintyM.map { Int(($0 * 10).rounded()) } ?? NSNull()
        ]
    }
}

struct LokinLocationBatch: Codable, Sendable {
    let version: Int
    let sessionId: String
    let platform: String
    let sentAtMs: Int64
    let points: [LokinLocationSample]
}

extension CLLocation {
    var lokinSpeedMps: Double? {
        speed >= 0 ? speed : nil
    }

    var lokinHeadingDeg: Double? {
        course >= 0 ? course : nil
    }
}
