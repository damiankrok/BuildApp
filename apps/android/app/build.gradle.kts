import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.buildplan.preview"
    compileSdk = 35

    defaultConfig {
        // Deliberately NOT com.buildplan.app: the owner keeps the older
        // BuildPlan prototype installed, and a different signing key on the
        // same id would be an update/signature conflict rather than a
        // second app. This preview must be installable alongside it.
        applicationId = "com.buildplan.preview"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-preview"
        // No permissions at all: the preview reads bundled assets and nothing else.
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
    }

    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a", "x86_64")
            // arm64 is the phone artifact; the universal APK is the fallback
            // for an owner who does not know their device's ABI.
            isUniversalApk = true
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            isDebuggable = true
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.all { it.useJUnit() }
    }

    packaging {
        resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.kotlinx.serialization.json)

    // Filament renders the scene. Only the core artifact: the materials are
    // this app's own .filamat packages and the camera maths is plain Kotlin,
    // so neither gltfio nor filament-utils is pulled in — nothing here can
    // load a mesh file, because the building comes from the compiler.
    implementation(libs.filament.android)

    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
}

// ---------------------------------------------------------------------------
// Scene assets
// ---------------------------------------------------------------------------

/**
 * The scene bundles are DERIVED data written by `npm run mobile:export-scenes`
 * from the CanonicalBuildingModel. Gradle never generates geometry; it only
 * refuses to build an APK that would ship with no model in it.
 */
val sceneAssetsDir: File = layout.projectDirectory.dir("src/main/assets/scenes").asFile

val checkSceneAssets = tasks.register("checkSceneAssets") {
    group = "verification"
    description = "Fail early if the exported mobile scene bundles are missing."
    val dir = sceneAssetsDir
    doLast {
        val index = File(dir, "index.json")
        if (!index.isFile) {
            throw GradleException(
                "No mobile scene bundles in ${dir.path}.\n" +
                    "They are derived from the CanonicalBuildingModel — generate them from the repo root with:\n" +
                    "    npm run mobile:export-scenes",
            )
        }
        val scenes = dir.listFiles { f: File -> f.name.endsWith(".scene.json") }?.size ?: 0
        if (scenes == 0) throw GradleException("index.json is present in ${dir.path} but no *.scene.json bundle is")
    }
}

tasks.named("preBuild") { dependsOn(checkSceneAssets) }

/**
 * Collect the split APKs under the names the owner is told to download.
 * `app-arm64-v8a-debug.apk` means nothing on a phone's download list;
 * `BuildPlan-Model-Preview-arm64-v8a-debug.apk` does.
 */
tasks.register<Copy>("previewApks") {
    group = "build"
    description = "Assemble the debug APKs and collect them under their delivery names."
    dependsOn("assembleDebug")
    from(layout.buildDirectory.dir("outputs/apk/debug")) { include("*.apk") }
    into(layout.buildDirectory.dir("preview-apks"))
    rename("""^app-(.+)-debug\.apk$""", "BuildPlan-Model-Preview-$1-debug.apk")
}
