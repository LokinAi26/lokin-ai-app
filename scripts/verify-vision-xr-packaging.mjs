import fs from 'node:fs';

const checks = [
  ['native/android/vision-xr/app/build.gradle.kts', ['compileSdk = 37', 'targetSdk = 37', 'androidx.xr.projected:projected:1.0.0-alpha09', 'androidx.xr.glimmer:glimmer:1.0.0-alpha16']],
  ['native/android/vision-xr/app/src/main/AndroidManifest.xml', ['android.hardware.display.category.XR_PROJECTED', 'android.intent.category.XR_PROJECTED_LAUNCHER']],
  ['native/android/vision-xr/app/src/main/java/com/lokin/vision/xr/MainActivity.kt', ['ProjectedContext.createProjectedActivityOptions', 'LokinVisionXR', '/vision-bridge?native=xr']],
  ['native/android/vision-xr/app/src/main/java/com/lokin/vision/xr/ProjectedMainActivity.kt', ['GlimmerTheme', 'LOKIN Vision XR ready']],
  ['native/android/vision-xr/app/src/main/java/com/lokin/vision/xr/LokinVisionXrBridge.kt', ['lokin:native-vision-xr-state', 'allowedHost', 'compile_sdk']],
  ['src/lib/nativeVisionXrBridge.js', ['window).LokinVisionXR', 'lokin:native-vision-xr-state', 'launchNativeVisionXr']],
  ['src/pages/VisionBridge.jsx', ['ANDROID XR NATIVE RUNTIME', 'launchNativeVisionXr', 'native_xr']],
  ['base44/functions/legacy-deck/entry.ts', ['projected_connected', 'xr_compile_sdk', 'vision_xr_bridge:true']],
  ['src/legacy/main.js', ['OPEN VISION XR', 'vision.projected_state', 'vision.xr_compile_sdk']],
];

let failed = false;
for (const [path, needles] of checks) {
  if (!fs.existsSync(path)) {
    console.error(`FAIL missing ${path}`);
    failed = true;
    continue;
  }
  const source = fs.readFileSync(path, 'utf8');
  for (const needle of needles) {
    if (!source.includes(needle)) {
      console.error(`FAIL ${path}: missing ${needle}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`PASS LOKIN Vision XR packaging (${checks.length} contract files verified)`);
