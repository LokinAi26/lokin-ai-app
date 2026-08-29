# LOKIN Vision XR — Legacy Deck Native Runtime

This project is the Android Studio / Jetpack XR runtime for the existing LOKIN AI application. It is intentionally isolated from `native/android/location-core` so the SDK 37 / Android XR toolchain does not disturb the existing location and sensor-fusion package.

## Runtime topology

1. Install/run `vision-xr` on the paired Phone AVD.
2. `MainActivity` hosts the authenticated LOKIN `/vision-bridge` page in a trusted HTTPS WebView.
3. The WebView receives a narrowly scoped `LokinVisionXR` JavaScript interface only while the page is on `lokin-ai-app-604c3139.base44.app`.
4. The page can request a projected launch through Jetpack Projected.
5. `ProjectedMainActivity` renders the display-glasses UI with Compose Glimmer.
6. Native XR state is emitted back to the web page as `lokin:native-vision-xr-state`.
7. The authenticated web page sends that state through the existing `legacy-deck` `vision_heartbeat` action.
8. The Legacy Deck reads `LokinVisionTelemetry` and displays the real phone/glasses state.

No Base44 service-role token or permanent API credential is stored in the APK.

## Locked toolchain

- compileSdk: 37
- targetSdk: 37
- minSdk: 26
- Android Gradle Plugin: 9.1.1
- Gradle: 9.3.1
- Java: 17
- Jetpack XR Runtime: 1.0.0-beta02
- Jetpack Compose Glimmer: 1.0.0-alpha16
- Jetpack Projected: 1.0.0-alpha09
- ARCore for Jetpack XR: 1.0.0-beta01

## Android Studio acceptance test

1. Open `native/android/vision-xr` as its own Android Studio project.
2. Install Android SDK/API 37 and the required Android XR emulator images.
3. Create/start a Phone AVD.
4. Create/start a Display Glasses AVD and pair it to that phone.
5. Run the `app` configuration on the Phone AVD.
6. Sign in to LOKIN in the embedded `/vision-bridge` page if needed.
7. Confirm the page shows `ANDROID XR NATIVE RUNTIME`.
8. Press `LAUNCH DISPLAY GLASSES`.
9. Confirm the glasses show `LOKIN Vision XR ready`.
10. Open `/legacy.html`; the LOKIN Vision card should report the Android XR host and projected-glasses state on its next refresh.

## Protected existing functionality

Do not merge this project into the root `native/android/settings.gradle.kts` until the legacy location-core module is independently migrated to the SDK 37/AGP 9 toolchain. Keeping the projects separate prevents an XR dependency upgrade from breaking production location, sensor-fusion, or the existing web fallback.
