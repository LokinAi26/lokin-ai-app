import Foundation
import CoreLocation

final class LokinLocationFilter {
    private var lastAccepted: CLLocation?
    private var filteredLatitude: Double?
    private var filteredLongitude: Double?
    private var latitudeVariance = 1.0
    private var longitudeVariance = 1.0

    func reset() {
        lastAccepted = nil
        filteredLatitude = nil
        filteredLongitude = nil
        latitudeVariance = 1.0
        longitudeVariance = 1.0
    }

    func filter(_ location: CLLocation, mode: LokinTrackingMode) -> CLLocation? {
        let age = abs(location.timestamp.timeIntervalSinceNow)
        guard age <= 15 else { return nil }
        guard location.horizontalAccuracy > 0 else { return nil }

        let maxAccuracy: CLLocationAccuracy = mode == .activeNavigation ? 80 : 150
        guard location.horizontalAccuracy <= maxAccuracy else { return nil }

        if let previous = lastAccepted {
            let dt = max(0.1, location.timestamp.timeIntervalSince(previous.timestamp))
            let distance = location.distance(from: previous)
            let impliedSpeed = distance / dt
            let reportedSpeed = max(location.speed, previous.speed, 0)
            let speedCeiling = max(65.0, reportedSpeed + 20.0)
            if impliedSpeed > speedCeiling && distance > max(35, location.horizontalAccuracy * 2) {
                return nil
            }
        }

        let measurementVarianceM2 = max(4.0, location.horizontalAccuracy * location.horizontalAccuracy)
        let latMetersPerDegree = 111_132.0
        let lonMetersPerDegree = max(10_000.0, 111_320.0 * cos(location.coordinate.latitude * .pi / 180))
        let latMeasurementVariance = measurementVarianceM2 / (latMetersPerDegree * latMetersPerDegree)
        let lonMeasurementVariance = measurementVarianceM2 / (lonMetersPerDegree * lonMetersPerDegree)

        let dt = lastAccepted.map { max(0.1, location.timestamp.timeIntervalSince($0.timestamp)) } ?? 1.0
        let speed = max(location.speed, 0)
        let processNoiseM = mode == .activeNavigation ? max(2.0, speed * dt * 0.35) : max(4.0, speed * dt * 0.5)
        latitudeVariance += (processNoiseM * processNoiseM) / (latMetersPerDegree * latMetersPerDegree)
        longitudeVariance += (processNoiseM * processNoiseM) / (lonMetersPerDegree * lonMetersPerDegree)

        if filteredLatitude == nil || filteredLongitude == nil {
            filteredLatitude = location.coordinate.latitude
            filteredLongitude = location.coordinate.longitude
            latitudeVariance = latMeasurementVariance
            longitudeVariance = lonMeasurementVariance
        } else {
            let latGain = latitudeVariance / (latitudeVariance + latMeasurementVariance)
            let lonGain = longitudeVariance / (longitudeVariance + lonMeasurementVariance)
            filteredLatitude! += latGain * (location.coordinate.latitude - filteredLatitude!)
            filteredLongitude! += lonGain * (location.coordinate.longitude - filteredLongitude!)
            latitudeVariance *= (1 - latGain)
            longitudeVariance *= (1 - lonGain)
        }

        let result = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: filteredLatitude!, longitude: filteredLongitude!),
            altitude: location.altitude,
            horizontalAccuracy: location.horizontalAccuracy,
            verticalAccuracy: location.verticalAccuracy,
            course: location.course,
            speed: location.speed,
            timestamp: location.timestamp
        )
        lastAccepted = result
        return result
    }
}
