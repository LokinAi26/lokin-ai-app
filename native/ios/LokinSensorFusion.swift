import Foundation
import CoreLocation
import CoreMotion

/// Short-horizon sensor fusion for active vehicle navigation.
/// Core Location remains the absolute position anchor. Core Motion and the
/// barometer bridge sub-second gaps and short GNSS outages; they are not used
/// to claim standalone absolute positioning.
final class LokinSensorFusion {
    struct FusedFix {
        let location: CLLocation
        let confidence: Double
        let deadReckoned: Bool
        let barometricAltitudeM: Double?
        let source: String
    }

    private let motion = CMMotionManager()
    private let altimeter = CMAltimeter()
    private let queue = OperationQueue()
    private let lock = NSLock()

    private var running = false
    private var lastAnchor: CLLocation?
    private var lastAnchorMonotonic = ProcessInfo.processInfo.systemUptime
    private var lastPredictionMonotonic = ProcessInfo.processInfo.systemUptime
    private var lastEmitMonotonic = 0.0

    // Local tangent-plane velocity. +north, +east in m/s.
    private var velocityNorth = 0.0
    private var velocityEast = 0.0
    private var predictedLatitude: Double?
    private var predictedLongitude: Double?

    private var barometerReferenceRelativeM: Double?
    private var barometerReferenceAltitudeM: Double?
    private(set) var latestBarometricAltitudeM: Double?

    var onPredictedFix: ((FusedFix) -> Void)?

    init() {
        queue.name = "ai.lokin.sensor-fusion"
        queue.qualityOfService = .userInteractive
        queue.maxConcurrentOperationCount = 1
    }

    func start() {
        guard !running else { return }
        running = true
        lastPredictionMonotonic = ProcessInfo.processInfo.systemUptime

        if motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 1.0 / 50.0
            let frame: CMAttitudeReferenceFrame = CMMotionManager.availableAttitudeReferenceFrames().contains(.xTrueNorthZVertical)
                ? .xTrueNorthZVertical
                : .xArbitraryCorrectedZVertical
            motion.startDeviceMotionUpdates(using: frame, to: queue) { [weak self] sample, _ in
                guard let self, let sample else { return }
                self.consumeMotion(sample)
            }
        }

        if CMAltimeter.isRelativeAltitudeAvailable() {
            altimeter.startRelativeAltitudeUpdates(to: queue) { [weak self] data, _ in
                guard let self, let data else { return }
                self.consumeAltitude(relativeM: data.relativeAltitude.doubleValue)
            }
        }
    }

    func stop() {
        running = false
        motion.stopDeviceMotionUpdates()
        altimeter.stopRelativeAltitudeUpdates()
        lock.lock()
        defer { lock.unlock() }
        lastAnchor = nil
        predictedLatitude = nil
        predictedLongitude = nil
        velocityNorth = 0
        velocityEast = 0
        barometerReferenceRelativeM = nil
        barometerReferenceAltitudeM = nil
        latestBarometricAltitudeM = nil
    }

    func ingestAnchor(_ location: CLLocation) {
        let speed = max(location.lokinSpeedMps ?? 0, 0)
        let heading = (location.lokinHeadingDeg ?? 0) * .pi / 180
        lock.lock()
        lastAnchor = location
        lastAnchorMonotonic = ProcessInfo.processInfo.systemUptime
        lastPredictionMonotonic = lastAnchorMonotonic
        predictedLatitude = location.coordinate.latitude
        predictedLongitude = location.coordinate.longitude
        velocityNorth = speed * cos(heading)
        velocityEast = speed * sin(heading)
        if location.verticalAccuracy >= 0 {
            barometerReferenceAltitudeM = location.altitude
        }
        lock.unlock()
    }

    private func consumeAltitude(relativeM: Double) {
        lock.lock()
        defer { lock.unlock() }
        if barometerReferenceRelativeM == nil {
            barometerReferenceRelativeM = relativeM
        }
        if let refRelative = barometerReferenceRelativeM,
           let refAltitude = barometerReferenceAltitudeM {
            latestBarometricAltitudeM = refAltitude + (relativeM - refRelative)
        }
    }

    private func consumeMotion(_ sample: CMDeviceMotion) {
        guard running else { return }
        let now = ProcessInfo.processInfo.systemUptime

        lock.lock()
        guard let anchor = lastAnchor,
              var lat = predictedLatitude,
              var lon = predictedLongitude else {
            lock.unlock()
            return
        }

        let anchorAge = now - lastAnchorMonotonic
        // Dead reckoning is deliberately bounded. Past this point uncertainty
        // grows too quickly for safe turn-by-turn use, so wait for a new anchor.
        guard anchorAge >= 0.60, anchorAge <= 8.0 else {
            lastPredictionMonotonic = now
            lock.unlock()
            return
        }

        let dt = min(0.10, max(0.005, now - lastPredictionMonotonic))
        lastPredictionMonotonic = now

        // Transform user acceleration from device coordinates into the Core
        // Motion reference frame. With X-True-North/Z-Vertical, ref X is north
        // and ref Y is west, therefore east acceleration is -refY.
        let a = sample.userAcceleration
        let r = sample.attitude.rotationMatrix
        let refX = r.m11 * a.x + r.m21 * a.y + r.m31 * a.z
        let refY = r.m12 * a.x + r.m22 * a.y + r.m32 * a.z
        let g = 9.80665
        let northAcceleration = max(-6.0, min(6.0, refX * g))
        let eastAcceleration = max(-6.0, min(6.0, -refY * g))

        velocityNorth += northAcceleration * dt
        velocityEast += eastAcceleration * dt

        // Prevent sensor noise from creating impossible vehicle speeds.
        let speed = hypot(velocityNorth, velocityEast)
        if speed > 75 {
            let scale = 75 / speed
            velocityNorth *= scale
            velocityEast *= scale
        }

        let metersNorth = velocityNorth * dt
        let metersEast = velocityEast * dt
        lat += metersNorth / 111_132.0
        let lonMetersPerDegree = max(10_000.0, 111_320.0 * cos(lat * .pi / 180))
        lon += metersEast / lonMetersPerDegree
        predictedLatitude = lat
        predictedLongitude = lon

        let altitude = latestBarometricAltitudeM ?? anchor.altitude
        let heading = (atan2(velocityEast, velocityNorth) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
        let predictedSpeed = hypot(velocityNorth, velocityEast)
        let uncertainty = min(120.0, max(anchor.horizontalAccuracy, 4.0) + anchorAge * 4.5)
        let confidence = max(0.05, min(0.98, exp(-anchorAge / 5.5) * exp(-uncertainty / 120.0)))
        let shouldEmit = now - lastEmitMonotonic >= 0.20
        if shouldEmit { lastEmitMonotonic = now }
        lock.unlock()

        guard shouldEmit else { return }
        let location = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon),
            altitude: altitude,
            horizontalAccuracy: uncertainty,
            verticalAccuracy: latestBarometricAltitudeM == nil ? -1 : 8,
            course: heading,
            speed: predictedSpeed,
            timestamp: Date()
        )
        onPredictedFix?(FusedFix(
            location: location,
            confidence: confidence,
            deadReckoned: true,
            barometricAltitudeM: latestBarometricAltitudeM,
            source: "corelocation+imu+barometer-dead-reckoning"
        ))
    }
}
