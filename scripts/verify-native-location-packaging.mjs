import assert from "node:assert/strict";
import fs from "node:fs";

const required = [
  "native/ios/Package.swift",
  "native/ios/LokinLocationModels.swift",
  "native/ios/LokinLocationEngine.swift",
  "native/ios/LokinSensorFusion.swift",
  "native/ios/LokinLocationBridge.swift",
  "native/android/settings.gradle.kts",
  "native/android/build.gradle.kts",
  "native/android/location-core/build.gradle.kts",
  "native/android/location-core/src/main/AndroidManifest.xml",
  "native/android/LokinLocationModels.kt",
  "native/android/LokinLocationService.kt",
  "native/android/LokinSensorFusion.kt",
  "native/android/LokinLocationBridge.kt",
];
for (const path of required) assert.ok(fs.existsSync(path), `missing native package file: ${path}`);

const iosPackage = fs.readFileSync("native/ios/Package.swift", "utf8");
assert.match(iosPackage, /LokinLocationCore/);
assert.match(iosPackage, /linkedLibrary\("sqlite3"\)/);
assert.match(iosPackage, /LokinSensorFusion\.swift/);

const iosEngine = fs.readFileSync("native/ios/LokinLocationEngine.swift", "utf8");
assert.match(iosEngine, /authoritative: false/);
assert.match(iosEngine, /queue\?\.enqueue\(sample\)/);
assert.match(iosEngine, /anchorSeq: fix\.anchorSeq/);

const androidModule = fs.readFileSync("native/android/location-core/build.gradle.kts", "utf8");
assert.match(androidModule, /play-services-location/);
assert.match(androidModule, /androidx\.core/);
const androidService = fs.readFileSync("native/android/LokinLocationService.kt", "utf8");
assert.match(androidService, /authoritative = false/);
assert.match(androidService, /queue\.enqueue\(sample\)/);
assert.match(androidService, /anchorSeq = fix\.anchorSeq/);

const androidManifest = fs.readFileSync("native/android/location-core/src/main/AndroidManifest.xml", "utf8");
assert.match(androidManifest, /FOREGROUND_SERVICE_LOCATION/);
assert.match(androidManifest, /foregroundServiceType="location"/);

console.log(JSON.stringify({
  ok: true,
  ios: "Swift Package manifest + SQLite linker contract present",
  android: "Gradle library module + location foreground-service manifest present",
  provenance: "dead-reckoned samples persist with authoritative=false + anchor lineage",
  note: "This verifies packaging/contracts in the Base44 sandbox; Xcode/Android SDK compilers are not installed here."
}, null, 2));
