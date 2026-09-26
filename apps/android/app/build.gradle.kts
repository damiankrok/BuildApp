import java.io.File
import java.security.KeyStore
import java.security.MessageDigest

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// ---------------------------------------------------------------------------
// Preview identity: one signing key, a versionCode that only goes up
// ---------------------------------------------------------------------------

/**
 * Android installs an APK as an UPDATE of the app already on the phone only
 * when both are signed by the same certificate and the new versionCode is not
 * lower. Both used to fail for CI builds: every runner signed with its own
 * freshly generated `~/.android/debug.keystore`, and versionCode was a
 * constant 1. So the owner could never update the installed preview; Android
 * refused each new APK as a signature mismatch.
 *
 * The fix is a stable PREVIEW identity that is deliberately not a secret:
 * `apps/android/keystore/preview.keystore`, committed, password and alias in
 * the README next to it. It signs nothing but this preview app and grants
 * nothing (see that README). Each of the four values can be replaced from the
 * environment, so a private key kept in CI secrets needs no code change:
 *
 *   BUILDPLAN_PREVIEW_KEYSTORE            path to a keystore file (PKCS12 or JKS)
 *   BUILDPLAN_PREVIEW_KEYSTORE_PASSWORD   its store password
 *   BUILDPLAN_PREVIEW_KEY_ALIAS           the key alias inside it
 *   BUILDPLAN_PREVIEW_KEY_PASSWORD        that key's password (defaults to the store password)
 *
 * Blank values count as unset, so a CI job may map secrets that do not exist yet.
 */
fun previewEnv(name: String): String? =
    providers.environmentVariable(name).orNull?.trim()?.takeIf { it.isNotEmpty() }

val previewKeystoreFile: File =
    previewEnv("BUILDPLAN_PREVIEW_KEYSTORE")?.let { rootProject.file(it) }
        ?: rootProject.file("keystore/preview.keystore")
val previewKeystorePassword: String = previewEnv("BUILDPLAN_PREVIEW_KEYSTORE_PASSWORD") ?: "buildplan-preview"
val previewKeyAlias: String = previewEnv("BUILDPLAN_PREVIEW_KEY_ALIAS") ?: "buildplan-preview"
val previewKeyPassword: String = previewEnv("BUILDPLAN_PREVIEW_KEY_PASSWORD") ?: previewKeystorePassword

if (!previewKeystoreFile.isFile) {
    throw GradleException(
        "Preview signing keystore not found: ${previewKeystoreFile.path}\n" +
            "The committed key is apps/android/keystore/preview.keystore. If BUILDPLAN_PREVIEW_KEYSTORE is set " +
            "it must name an existing keystore file.",
    )
}

/** SHA-256 of the DER certificate, formatted the way `apksigner verify --print-certs` prints it. */
fun signerSha256Of(keystore: File, storePassword: String, alias: String): String {
    val store = listOf("PKCS12", "JKS").firstNotNullOfOrNull { type ->
        runCatching {
            KeyStore.getInstance(type).also { ks -> keystore.inputStream().use { ks.load(it, storePassword.toCharArray()) } }
        }.getOrNull()
    } ?: throw GradleException("Cannot open preview keystore ${keystore.path}: wrong password or not a PKCS12/JKS keystore")
    val cert = store.getCertificate(alias)
        ?: throw GradleException("Preview keystore ${keystore.path} has no key with alias '$alias' (it has: ${store.aliases().toList()})")
    return MessageDigest.getInstance("SHA-256").digest(cert.encoded).joinToString("") { "%02x".format(it) }
}

// Opening the keystore here also fails fast, with a readable message, on a
// wrong password or alias — before AGP gets to the packaging step.
val previewSignerSha256: String = signerSha256Of(previewKeystoreFile, previewKeystorePassword, previewKeyAlias)

/**
 * versionCode is DERIVED, never typed in, because it must grow on every build
 * the owner might install:
 *
 *   in CI      GITHUB_RUN_NUMBER          versionCode = 1000 + run,   versionName = 0.<run>.0-preview
 *   locally    git rev-list --count HEAD  versionCode = commit count, versionName = 0.<count>.0-local
 *   no git     (a source tarball)         versionCode = 1,            versionName = 0.0.1-local
 *
 * The workflow run number only ever rises, so consecutive CI APKs always
 * update each other. CI starts at 1001 and gains at least one per push while
 * the commit count gains one per commit, so a CI APK also outranks a local
 * one; the reverse (a local build on top of a CI install) is the one case
 * that needs `adb install -r -d`, which Android allows for a debuggable app.
 *
 * The run number belongs to the workflow FILE (`buildapp-ci.yml`): if that
 * file is ever renamed its counter restarts at 1, and PREVIEW_VERSION_CODE_BASE
 * must then be raised above the last versionCode that was published.
 */
val PREVIEW_VERSION_CODE_BASE = 1000

data class PreviewVersion(val code: Int, val name: String, val source: String)

fun gitStdout(vararg args: String): String? = try {
    providers.exec {
        commandLine("git", *args)
        isIgnoreExitValue = true
    }.standardOutput.asText.get().trim().takeIf { it.isNotEmpty() }
} catch (_: Exception) {
    null // git is not installed
}

val previewVersion: PreviewVersion = run {
    val runNumber = previewEnv("GITHUB_RUN_NUMBER")?.toIntOrNull()
    val commits = if (runNumber == null) gitStdout("rev-list", "--count", "HEAD")?.toIntOrNull() else null
    when {
        runNumber != null -> PreviewVersion(PREVIEW_VERSION_CODE_BASE + runNumber, "0.$runNumber.0-preview", "GITHUB_RUN_NUMBER=$runNumber")
        commits != null && commits > 0 -> PreviewVersion(commits, "0.$commits.0-local", "git rev-list --count HEAD")
        else -> PreviewVersion(1, "0.0.1-local", "no git history available")
    }
}

val previewCommit: String = previewEnv("GITHUB_SHA") ?: gitStdout("rev-parse", "HEAD") ?: "unknown"

logger.lifecycle(
    "BuildPlan Model Preview: versionCode ${previewVersion.code}, versionName ${previewVersion.name} " +
        "(from ${previewVersion.source}); signing with ${previewKeystoreFile.path} alias '$previewKeyAlias' " +
        "(signer SHA-256 $previewSignerSha256)",
)

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
        versionCode = previewVersion.code
        versionName = previewVersion.name
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

    signingConfigs {
        // The stable preview identity described at the top of this file.
        create("preview") {
            storeFile = previewKeystoreFile
            storePassword = previewKeystorePassword
            keyAlias = previewKeyAlias
            keyPassword = previewKeyPassword
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            isDebuggable = true
            // Not the machine's ~/.android/debug.keystore: the same key on
            // every machine and every CI run, so each assembleDebug APK
            // installs as an update over the previous one.
            signingConfig = signingConfigs.getByName("preview")
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

// ---------------------------------------------------------------------------
// Delivery: the APKs under their download names, plus VERSION.txt
// ---------------------------------------------------------------------------

/**
 * VERSION.txt travels next to the APKs so a downloaded artifact says which
 * versionCode it carries and which key signed it, without unpacking an APK.
 * CI compares the signer written here with what `apksigner` reads back from
 * the APK (tools/verify-preview-signature.sh). Only plain values are captured
 * below: the configuration cache cannot serialize references to this script.
 */
val previewVersionFile = tasks.register("previewVersionFile") {
    group = "build"
    description = "Write VERSION.txt: the preview APKs' versionCode, versionName, commit and signing key."
    val out = layout.buildDirectory.file("preview-version/VERSION.txt")
    val applicationId: String = android.defaultConfig.applicationId ?: android.namespace ?: "com.buildplan.preview"
    val versionCode: Int = previewVersion.code
    val versionName: String = previewVersion.name
    val versionSource: String = previewVersion.source
    val commit: String = previewCommit
    val keystorePath: String = previewKeystoreFile.path
    val alias: String = previewKeyAlias
    val signer: String = previewSignerSha256
    inputs.property("applicationId", applicationId)
    inputs.property("versionCode", versionCode)
    inputs.property("versionName", versionName)
    inputs.property("versionSource", versionSource)
    inputs.property("commit", commit)
    inputs.property("keyAlias", alias)
    inputs.property("signer", signer)
    inputs.file(previewKeystoreFile)
    outputs.file(out)
    doLast {
        out.get().asFile.writeText(
            """
            applicationId=$applicationId
            versionCode=$versionCode
            versionName=$versionName
            versionSource=$versionSource
            commit=$commit
            signingKeystore=$keystorePath
            signingKeyAlias=$alias
            signerCertSha256=$signer
            """.trimIndent() + "\n",
        )
    }
}

/**
 * Collect the split APKs under the names the owner is told to download.
 * `app-arm64-v8a-debug.apk` means nothing on a phone's download list;
 * `BuildPlan-Model-Preview-arm64-v8a-debug.apk` does.
 */
tasks.register<Copy>("previewApks") {
    group = "build"
    description = "Assemble the debug APKs and collect them, with VERSION.txt, under their delivery names."
    dependsOn("assembleDebug")
    from(layout.buildDirectory.dir("outputs/apk/debug")) { include("*.apk") }
    from(previewVersionFile)
    into(layout.buildDirectory.dir("preview-apks"))
    rename("""^app-(.+)-debug\.apk$""", "BuildPlan-Model-Preview-$1-debug.apk")
}
