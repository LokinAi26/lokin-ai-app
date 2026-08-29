plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.lokin.vision.xr"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.lokin.vision.xr"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0-legacy-bridge"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.08.00")
    implementation(composeBom)

    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.xr.runtime:runtime:1.0.0-beta02")
    implementation("androidx.xr.glimmer:glimmer:1.0.0-alpha16")
    implementation("androidx.xr.glimmer:glimmer-google-fonts:1.0.0-alpha16")
    implementation("androidx.xr.projected:projected:1.0.0-alpha09")
    implementation("androidx.xr.arcore:arcore:1.0.0-beta01")
}
