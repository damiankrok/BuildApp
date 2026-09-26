package com.buildplan.preview.analyzer.local

import java.io.File
import java.io.IOException
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** `assets/local-analyzer/manifest.json`, written by `apps/local-analyzer/build.mjs`. */
@Serializable
data class LocalRuntimeManifest(
    val schema: String = "",
    val protocol: Int = 0,
    val runtime: Runtime = Runtime(),
    val entry: String = "",
    val files: Map<String, FileInfo> = emptyMap(),
) {
    @Serializable
    data class Runtime(val name: String = "", val node: String = "", val target: String = "")

    @Serializable
    data class FileInfo(val sha256: String = "", val bytes: Long = 0)

    companion object {
        const val SCHEMA = "buildapp.local-analyzer-runtime"
    }
}

/** The analyzer program, installed where the runtime can read it. */
data class InstalledRuntime(val dir: File, val entry: File, val manifest: LocalRuntimeManifest)

/**
 * The production analyzer bundle ships inside the APK as assets
 * (`local-analyzer/analyzer.mjs`, `main.mjs`, `manifest.json`). Node reads
 * files, not APK entries, so before a job the bundle is copied into the app's
 * private storage — once per bundle version, into a folder named by the
 * bundle's own hash — and every file is checked against the sha256 the
 * manifest records for it, on the way in and each time it is reused. A file
 * that does not match is replaced; an older version's folder is removed.
 *
 * The bundle is the production pipeline itself. Nothing here reads it.
 */
class LocalRuntimeFiles(
    private val root: File,
    private val openAsset: (String) -> InputStream?,
) {
    private val runtimeRoot = File(root, "runtime")

    /** The manifest the APK carries, or null when this build embeds no local analyzer. */
    fun manifest(): LocalRuntimeManifest? = try {
        openAsset("$ASSET_DIR/manifest.json")?.use { JSON.decodeFromString(LocalRuntimeManifest.serializer(), it.readBytes().decodeToString()) }
    } catch (e: Exception) {
        null
    }

    fun install(): InstalledRuntime {
        val manifest = manifest() ?: throw IOException("this build carries no local analyzer bundle")
        if (manifest.schema != LocalRuntimeManifest.SCHEMA) throw IOException("the embedded analyzer bundle has an unknown manifest")
        if (manifest.protocol != LocalProtocol.PROTOCOL) throw IOException("the embedded analyzer speaks protocol ${manifest.protocol}, this app ${LocalProtocol.PROTOCOL}")
        val analyzer = manifest.files["analyzer.mjs"] ?: throw IOException("the embedded analyzer bundle lists no analyzer.mjs")
        if (!SHA256.matches(analyzer.sha256) || manifest.entry !in manifest.files) throw IOException("the embedded analyzer manifest is malformed")
        val dir = File(runtimeRoot, analyzer.sha256.take(16))
        if (!dir.isDirectory && !dir.mkdirs()) throw IOException("cannot create the runtime folder")
        for ((name, info) in manifest.files) {
            require(NAME.matches(name)) { "unexpected file name in the analyzer manifest" }
            val target = File(dir, name)
            if (target.isFile && target.length() == info.bytes && sha256Of(target) == info.sha256) continue
            val temp = File(dir, ".$name.tmp")
            val stream = openAsset("$ASSET_DIR/$name") ?: throw IOException("the APK lacks $ASSET_DIR/$name")
            stream.use { input -> temp.outputStream().use { input.copyTo(it) } }
            val actual = sha256Of(temp)
            if (actual != info.sha256) {
                temp.delete()
                throw IOException("$name in the APK does not match its manifest")
            }
            Files.move(temp.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        }
        runtimeRoot.listFiles()?.filter { it.isDirectory && it != dir }?.forEach { it.deleteRecursively() }
        return InstalledRuntime(dir, File(dir, manifest.entry), manifest)
    }

    companion object {
        const val ASSET_DIR = "local-analyzer"
        private val SHA256 = Regex("^[0-9a-f]{64}$")
        private val NAME = Regex("^[a-z0-9-]+\\.(mjs|json)$")
        private val JSON = Json { ignoreUnknownKeys = true }

        fun sha256Of(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    digest.update(buffer, 0, n)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
        }
    }
}
