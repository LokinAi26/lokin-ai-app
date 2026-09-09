import assert from "node:assert/strict";
import fs from "node:fs";

const required = [
  "native/ios/Package.swift",
  "native/ios/LokinLocationModels.swift",
  "native/ios/LokinNativeRuntime.swift",
  "native/ios/LokinLocationEngine.swift",
  "native/ios/LokinSensorFusion.swift",
  "native/ios/LokinLocationBridge.swift",
  "native/ios/LokinLocationShellInstaller.swift",
  "native/android/settings.gradle.kts",
  "native/android/build.gradle.kts",
  "native/android/location-core/build.gradle.kts",
  "native/android/location-core/src/main/AndroidManifest.xml",
  "native/android/LokinLocationModels.kt",
  "native/android/LokinLocationService.kt",
  "native/android/LokinSensorFusion.kt",
  "native/android/LokinLocationBridge.kt",
  "native/android/LokinLocationShellInstaller.kt",
];
for (const path of required) assert.ok(fs.existsSync(path), `missing native package file: ${path}`);

const iosPackage = fs.readFileSync("native/ios/Package.swift", "utf8");
assert.match(iosPackage, /LokinLocationCore/);
assert.match(iosPackage, /linkedLibrary\("sqlite3"\)/);
assert.match(iosPackage, /LokinSensorFusion\.swift/);
assert.match(iosPackage, /LokinNativeRuntime\.swift/);
assert.match(iosPackage, /LokinLocationShellInstaller\.swift/);

const iosRuntime = fs.readFileSync("native/ios/LokinNativeRuntime.swift", "utf8");
assert.match(iosRuntime, /packageVersion = "3\.0\.0"/);
assert.match(iosRuntime, /backgroundLocationDeclared/);
const iosBridge = fs.readFileSync("native/ios/LokinLocationBridge.swift", "utf8");
assert.match(iosBridge, /case "runtimeStatus"/);
assert.match(iosBridge, /lokin:native-location-runtime/);

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
const androidBridge = fs.readFileSync("native/android/LokinLocationBridge.kt", "utf8");
assert.match(androidBridge, /requestWhenInUse/);
assert.match(androidBridge, /ActivityCompat\.requestPermissions/);
assert.match(androidBridge, /lokin:native-location-authorization/);
assert.match(androidBridge, /"runtimeStatus" -> emitRuntimeStatus\(\)/);
assert.match(androidBridge, /"packageVersion", "3\.0\.0"/);
assert.match(androidBridge, /lokin:native-location-runtime/);
const androidInstaller = fs.readFileSync("native/android/LokinLocationShellInstaller.kt", "utf8");
assert.match(androidInstaller, /addJavascriptInterface\(bridge, "LokinLocation"\)/);

const reactBridge = fs.readFileSync("src/lib/nativeLocationBridge.js", "utf8");
assert.match(reactBridge, /requestNativeRuntimeStatus/);
assert.match(reactBridge, /subscribeNativeLocationRuntime/);
const reactHook = fs.readFileSync("src/hooks/useLokinNavigation.js", "utf8");
assert.match(reactHook, /nativeStartedRef/);
assert.match(reactHook, /\["always", "whenInUse"\]/);
assert.match(reactHook, /requestNativeRuntimeStatus\(\)/);
assert.match(reactHook, /nativeRuntime/);

const androidManifest = fs.readFileSync("native/android/location-core/src/main/AndroidManifest.xml", "utf8");
assert.match(androidManifest, /FOREGROUND_SERVICE_LOCATION/);
assert.match(androidManifest, /foregroundServiceType="location"/);

console.log(JSON.stringify({
  ok: true,
  ios: "Swift Package manifest + SQLite linker + runtime capability handshake present",
  android: "Gradle library module + runtime permission/capability handshake + location foreground-service manifest present",
  provenance: "dead-reckoned samples persist with authoritative=false + anchor lineage",
  note: "This verifies packaging/contracts in the Base44 sandbox; Xcode/Android SDK compilers are not installed here."
}, null, 2));
