import Foundation
import CoreMotion

struct LokinNativeRuntimeStatus: Codable, Sendable {
    let packageVersion: String
    let platform: String
    let motionAvailable: Bool
    let barometerAvailable: Bool
    let backgroundLocationDeclared: Bool
    let bridge: String
}

enum LokinNativeRuntime {
    static let packageVersion = "3.0.0"

    static func status() -> LokinNativeRuntimeStatus {
        let modes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String] ?? []
        return LokinNativeRuntimeStatus(
            packageVersion: packageVersion,
            platform: "ios",
            motionAvailable: CMMotionManager().isDeviceMotionAvailable,
            barometerAvailable: CMAltimeter.isRelativeAltitudeAvailable(),
            backgroundLocationDeclared: modes.contains("location"),
            bridge: "wkwebview"
        )
    }
}
