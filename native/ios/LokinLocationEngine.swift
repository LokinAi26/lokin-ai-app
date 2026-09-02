import Foundation
import CoreLocation

final class LokinLocationEngine: NSObject, CLLocationManagerDelegate {
    static let shared = LokinLocationEngine()

    private let manager = CLLocationManager()
    private let filter = LokinLocationFilter()
    private let fusion = LokinSensorFusion()
    private let queue: LokinLocationQueue?
    private let defaults = UserDefaults.standard
    private let sequenceKey = "lokin.location.sequence"
    private let sequenceLock = NSLock()

    private(set) var mode: LokinTrackingMode = .stopped
    private(set) var sessionId: String = UUID().uuidString

    var onSample: ((LokinLocationSample) -> Void)?
    var onAuthorizationChanged: ((CLAuthorizationStatus, CLAccuracyAuthorization) -> Void)?
    var onError: ((Error) -> Void)?

    private override init() {
        queue = try? LokinLocationQueue()
        super.init()
        manager.delegate = self
        fusion.onPredictedFix = { [weak self] fix in
            self?.publishPredicted(fix)
        }
    }

    func requestWhenInUse() {
        manager.requestWhenInUseAuthorization()
        // Also publish the current state immediately. If permission was already
        // granted, iOS may not emit another delegate transition, and the web
        // bridge still needs a deterministic authorization handshake.
        onAuthorizationChanged?(manager.authorizationStatus, manager.accuracyAuthorization)
    }

    func requestAlwaysAfterUserExplanation() {
        let status = manager.authorizationStatus
        guard status == .authorizedWhenInUse || status == .notDetermined else { return }
        manager.requestAlwaysAuthorization()
    }

    func requestTemporaryPreciseLocation() {
        guard manager.accuracyAuthorization == .reducedAccuracy else { return }
        manager.requestTemporaryFullAccuracyAuthorization(withPurposeKey: "NavigationPreciseLocation")
    }

    func start(mode newMode: LokinTrackingMode, sessionId: String? = nil) {
        guard CLLocationManager.locationServicesEnabled() else {
            onError?(NSError(domain: "LokinLocation", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Location Services are disabled"])); return
        }
        mode = newMode
        if let sessionId, !sessionId.isEmpty { self.sessionId = sessionId }
        filter.reset()

        switch newMode {
        case .activeNavigation:
            manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
            manager.activityType = .automotiveNavigation
            manager.distanceFilter = 1
            manager.pausesLocationUpdatesAutomatically = false
            manager.allowsBackgroundLocationUpdates = true
            manager.showsBackgroundLocationIndicator = true
            fusion.start()
            manager.startUpdatingLocation()

        case .passive:
            manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
            manager.activityType = .otherNavigation
            manager.distanceFilter = 50
            manager.pausesLocationUpdatesAutomatically = true
            manager.allowsBackgroundLocationUpdates = false
            manager.showsBackgroundLocationIndicator = false
            fusion.stop()
            manager.startUpdatingLocation()

        case .stopped:
            stop()
        }
    }

    func stop() {
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
        manager.allowsBackgroundLocationUpdates = false
        fusion.stop()
        mode = .stopped
        filter.reset()
    }

    func readQueued(limit: Int = 120, completion: @escaping ([LokinLocationSample]) -> Void) {
        queue?.read(limit: limit, completion: completion) ?? completion([])
    }

    func acknowledgeQueued(throughSeq seq: Int64) {
        queue?.acknowledge(throughSeq: seq)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        onAuthorizationChanged?(manager.authorizationStatus, manager.accuracyAuthorization)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        onError?(error)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard mode != .stopped else { return }
        for raw in locations {
            guard let cleaned = filter.filter(raw, mode: mode) else { continue }
            let seq = nextSequence()
            if mode == .activeNavigation { fusion.ingestAnchor(cleaned, anchorSeq: seq) }
            let accuracyConfidence = max(0.05, min(0.99, exp(-cleaned.horizontalAccuracy / 65.0)))
            let sample = LokinLocationSample(
                seq: seq,
                timestampMs: Int64((cleaned.timestamp.timeIntervalSince1970 * 1000).rounded()),
                latitude: cleaned.coordinate.latitude,
                longitude: cleaned.coordinate.longitude,
                altitudeM: cleaned.verticalAccuracy >= 0 ? cleaned.altitude : nil,
                horizontalAccuracyM: cleaned.horizontalAccuracy,
                verticalAccuracyM: cleaned.verticalAccuracy >= 0 ? cleaned.verticalAccuracy : nil,
                speedMps: cleaned.lokinSpeedMps,
                headingDeg: cleaned.lokinHeadingDeg,
                source: mode == .activeNavigation ? "corelocation+sensor-fusion-anchor" : "corelocation",
                confidence: accuracyConfidence,
                deadReckoned: false,
                barometricAltitudeM: fusion.latestBarometricAltitudeM,
                authoritative: true,
                anchorSeq: seq,
                estimatedUncertaintyM: cleaned.horizontalAccuracy
            )
            queue?.enqueue(sample)
            DispatchQueue.main.async { [weak self] in self?.onSample?(sample) }
        }
    }

    private func publishPredicted(_ fix: LokinSensorFusion.FusedFix) {
        guard mode == .activeNavigation else { return }
        let location = fix.location
        // Dead-reckoned fixes now receive normal monotonic sequence numbers and
        // are persisted for complete offline replay. Provenance prevents them
        // from ever being confused with absolute provider anchors.
        let seq = nextSequence()
        let sample = LokinLocationSample(
            seq: seq,
            timestampMs: Int64((location.timestamp.timeIntervalSince1970 * 1000).rounded()),
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            altitudeM: location.verticalAccuracy >= 0 ? location.altitude : fix.barometricAltitudeM,
            horizontalAccuracyM: location.horizontalAccuracy,
            verticalAccuracyM: location.verticalAccuracy >= 0 ? location.verticalAccuracy : nil,
            speedMps: location.lokinSpeedMps,
            headingDeg: location.lokinHeadingDeg,
            source: fix.source,
            confidence: fix.confidence,
            deadReckoned: fix.deadReckoned,
            barometricAltitudeM: fix.barometricAltitudeM,
            authoritative: false,
            anchorSeq: fix.anchorSeq,
            estimatedUncertaintyM: location.horizontalAccuracy
        )
        queue?.enqueue(sample)
        DispatchQueue.main.async { [weak self] in self?.onSample?(sample) }
    }

    private func nextSequence() -> Int64 {
        sequenceLock.lock()
        defer { sequenceLock.unlock() }
        let current = Int64(defaults.integer(forKey: sequenceKey))
        let next = current + 1
        defaults.set(Int(next), forKey: sequenceKey)
        return next
    }
}
