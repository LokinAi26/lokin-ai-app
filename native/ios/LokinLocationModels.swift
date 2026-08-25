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
            source
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
