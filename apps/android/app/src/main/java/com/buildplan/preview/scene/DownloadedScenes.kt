package com.buildplan.preview.scene

import java.io.File
import java.io.IOException
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * What the phone knows about one analysis it downloaded: enough to list it,
 * find its file and check that file again, and nothing it would have to
 * interpret. The scene itself is `<sceneSha256>.json` next to the index.
 */
@Serializable
data class DownloadedSceneEntry(
    val key: String = "",
    /** The project's title as the analyzer read it. */
    val title: String = "",
    /** What the selector shows: "<title> (analysis)". */
    val label: String = "",
    val subtitle: String = "",
    val sceneSha256: String = "",
    val sceneContentHash: String = "",
    val candidateHash: String = "",
    val modelHash: String = "",
    val sourceUrl: String = "",
    val jobId: String = "",
    /** When the analyzer finished, as it reported it (ISO-8601). */
    val analyzedAt: String = "",
    /** Epoch milliseconds of the last time this scene was stored or opened. */
    val lastUsedAt: Long = 0,
    val sizeBytes: Long = 0,
    val qualityL0: Int = 0,
    val qualityL1: Int = 0,
    val qualityL2: Int = 0,
    val unresolvedCount: Int = 0,
    val warningsCount: Int = 0,
    val visionMode: String = "",
)

/**
 * The facts about one finished analysis that the store records next to its
 * scene. `sceneSha256` and `sceneContentHash` are what the downloaded bytes
 * are checked against; the rest is shown, never interpreted.
 */
data class AnalysisRecord(
    val title: String,
    val label: String,
    val sceneSha256: String,
    val sceneContentHash: String,
    val candidateHash: String,
    val modelHash: String,
    val sourceUrl: String,
    val jobId: String,
    val analyzedAt: String,
    val qualityL0: Int,
    val qualityL1: Int,
    val qualityL2: Int,
    val unresolvedCount: Int,
    val warningsCount: Int,
    val visionMode: String,
)

/** Why a downloaded scene was not kept. Nothing was written in any of these cases. */
sealed interface SceneRejection {
    data class TooLarge(val limitBytes: Long, val actualBytes: Long) : SceneRejection
    data class HashMismatch(val what: String, val expected: String, val actual: String) : SceneRejection
    data class InvalidScene(val message: String) : SceneRejection
    data class StorageFailed(val message: String) : SceneRejection
}

sealed interface SaveResult {
    data class Saved(val entry: DownloadedSceneEntry, val reusedFile: Boolean) : SaveResult
    data class Rejected(val reason: SceneRejection) : SaveResult
}

/**
 * Analyses downloaded from the analyzer service, kept in the app's private
 * storage (`filesDir/analyses`) so they open again offline and after a
 * restart.
 *
 * A scene is kept only after three checks: its sha256 is the one the
 * service's summary names (and the `X-Content-SHA256` header, when sent),
 * it parses as a `buildapp.mobile-scene-bundle` this build reads, and its
 * `contentHash` is the summary's `sceneContentHash`. Then it is written to a
 * temporary file and atomically renamed into place, and the index is written
 * the same way — so an interrupted or refused download leaves neither a file
 * nor an entry behind.
 *
 * File names come ONLY from the verified sha256; no name or path the service
 * sent is ever used on disk. Keys live in the `analysis-` namespace, so a
 * downloaded scene can never take the key of a scene that ships in the APK —
 * and the APK's own assets are read-only regardless.
 */
class DownloadedScenes(
    val root: File,
    private val clock: () -> Long = System::currentTimeMillis,
    private val maxSceneBytes: Long = MAX_SCENE_BYTES,
) : SceneSource {

    private val lock: Any = LOCKS.computeIfAbsent(root.absoluteFile.normalize().path) { Any() }
    private val indexFile = File(root, INDEX)

    override val kind: SceneSourceKind get() = SceneSourceKind.DOWNLOADED

    /** Every stored analysis whose file is present, most recently used first. */
    fun list(): List<DownloadedSceneEntry> = synchronized(lock) { readIndex() }
        .filter { sceneFile(it.sceneSha256).isFile }
        .sortedWith(compareByDescending<DownloadedSceneEntry> { it.lastUsedAt }.thenBy { it.key })

    fun find(key: String): DownloadedSceneEntry? = list().firstOrNull { it.key == key }

    override fun catalog(): List<SceneEntry> = list().map {
        SceneEntry(key = it.key, title = it.label.ifBlank { it.title }, subtitle = it.subtitle, source = SceneSourceKind.DOWNLOADED)
    }

    /**
     * Verify `bytes` against `record` and, only if every check passes, keep
     * them. The same scene downloaded again reuses its file (after checking
     * it) and refreshes its entry.
     */
    fun save(bytes: ByteArray, headerSha256: String?, record: AnalysisRecord): SaveResult {
        if (bytes.size.toLong() > maxSceneBytes) return reject(SceneRejection.TooLarge(maxSceneBytes, bytes.size.toLong()))
        val expected = record.sceneSha256.lowercase()
        if (!SHA256_HEX.matches(expected)) {
            return reject(SceneRejection.InvalidScene("the analyzer's summary does not name a valid scene sha256"))
        }
        val actual = sha256Hex(bytes)
        if (actual != expected) return reject(SceneRejection.HashMismatch("scene sha256", expected, actual))
        if (headerSha256 != null && headerSha256.lowercase() != actual) {
            return reject(SceneRejection.HashMismatch("X-Content-SHA256 header", headerSha256.lowercase(), actual))
        }
        val bundle = when (val parsed = BundleParser.parse(bytes.decodeToString())) {
            is BundleResult.Failure -> return reject(SceneRejection.InvalidScene(parsed.message))
            is BundleResult.Ok -> parsed.bundle
        }
        if (bundle.schema != BundleParser.SCHEMA) return reject(SceneRejection.InvalidScene("unknown scene schema \"${bundle.schema}\""))
        if (bundle.contentHash != record.sceneContentHash) {
            return reject(SceneRejection.HashMismatch("scene contentHash", record.sceneContentHash, bundle.contentHash))
        }

        synchronized(lock) {
            try {
                if (!root.isDirectory && !root.mkdirs()) throw IOException("cannot create the analyses folder")
                sweepTemporaryFiles()
                val entries = readIndex().toMutableList()
                val target = sceneFile(actual)
                val reused = target.isFile && target.length() == bytes.size.toLong() && fileSha256(target) == actual
                val createdFile = !reused
                if (createdFile) writeAtomically(target, bytes)
                try {
                    val existing = entries.firstOrNull { it.sceneSha256 == actual }
                    val key = existing?.key ?: keyFor(actual, entries.map { it.key }.toSet())
                    val entry = DownloadedSceneEntry(
                        key = key,
                        title = displayText(record.title),
                        label = displayText(record.label.ifBlank { "${record.title} (analysis)" }),
                        subtitle = subtitleFor(record.analyzedAt, record.candidateHash),
                        sceneSha256 = actual,
                        sceneContentHash = bundle.contentHash,
                        candidateHash = record.candidateHash,
                        modelHash = record.modelHash,
                        sourceUrl = record.sourceUrl,
                        jobId = record.jobId,
                        analyzedAt = record.analyzedAt,
                        lastUsedAt = clock(),
                        sizeBytes = bytes.size.toLong(),
                        qualityL0 = record.qualityL0,
                        qualityL1 = record.qualityL1,
                        qualityL2 = record.qualityL2,
                        unresolvedCount = record.unresolvedCount,
                        warningsCount = record.warningsCount,
                        visionMode = record.visionMode,
                    )
                    entries.removeAll { it.sceneSha256 == actual }
                    entries.add(entry)
                    writeIndex(entries)
                    return SaveResult.Saved(entry, reusedFile = reused)
                } catch (e: Exception) {
                    // The index did not take the new entry: a file nobody lists is not kept either.
                    if (createdFile) target.delete()
                    throw e
                }
            } catch (e: Exception) {
                sweepTemporaryFiles()
                return reject(SceneRejection.StorageFailed(e.message ?: "the file could not be written"))
            }
        }
    }

    /**
     * Read a stored scene back, checking its sha256 again: a file that changed
     * on disk since it was verified is reported, never rendered.
     */
    override fun load(key: String): SceneLoadResult {
        val entry = find(key) ?: return SceneLoadResult.Failed("The downloaded analysis $key is no longer on this phone.")
        val file = sceneFile(entry.sceneSha256)
        val bytes = try {
            file.readBytes()
        } catch (e: IOException) {
            return SceneLoadResult.Failed("The downloaded analysis ${entry.label} could not be read. Delete it and analyze the link again.")
        }
        if (sha256Hex(bytes) != entry.sceneSha256) {
            return SceneLoadResult.Failed(
                "The downloaded analysis ${entry.label} is damaged: its file no longer matches the hash it was verified with. " +
                    "Delete it and analyze the link again.",
            )
        }
        return when (val parsed = BundleParser.parse(bytes.decodeToString())) {
            is BundleResult.Failure -> SceneLoadResult.Failed("The downloaded analysis ${entry.label} can't be opened: ${parsed.message}")
            is BundleResult.Ok ->
                if (parsed.bundle.contentHash != entry.sceneContentHash) {
                    SceneLoadResult.Failed("The downloaded analysis ${entry.label} does not match its index entry. Delete it and analyze the link again.")
                } else {
                    SceneLoadResult.Ok(ModelScene.from(parsed.bundle, entry.key, entry.label, entry.subtitle))
                }
        }
    }

    /** Record that a scene was opened now, so the list keeps the most recently used first. */
    override fun touch(key: String) {
        synchronized(lock) {
            val entries = readIndex()
            if (entries.none { it.key == key }) return
            try {
                writeIndex(entries.map { if (it.key == key) it.copy(lastUsedAt = clock()) else it })
            } catch (e: IOException) {
                // Ordering is a convenience; failing to record it changes nothing else.
            }
        }
    }

    /** Remove a stored analysis: its file and its index entry. True when there was one. */
    fun delete(key: String): Boolean = synchronized(lock) {
        val entries = readIndex()
        val entry = entries.firstOrNull { it.key == key } ?: return false
        val remaining = entries.filter { it.key != key }
        try {
            writeIndex(remaining)
        } catch (e: IOException) {
            return false
        }
        if (remaining.none { it.sceneSha256 == entry.sceneSha256 }) sceneFile(entry.sceneSha256).delete()
        true
    }

    // -----------------------------------------------------------------------

    private fun reject(reason: SceneRejection) = SaveResult.Rejected(reason)

    private fun sceneFile(sha256: String): File {
        require(SHA256_HEX.matches(sha256)) { "not a sha256" }
        return File(root, "$sha256.json")
    }

    /**
     * The index as stored, keeping only entries this store could have written:
     * a key in the `analysis-` namespace derived from a well-formed sha256.
     * Anything else (a hand-edited or foreign file) is ignored, never trusted.
     */
    private fun readIndex(): List<DownloadedSceneEntry> {
        if (!indexFile.isFile) return emptyList()
        val stored = try {
            JSON.decodeFromString(StoredIndex.serializer(), indexFile.readText())
        } catch (e: Exception) {
            return emptyList()
        }
        return stored.entries
            .filter { SHA256_HEX.matches(it.sceneSha256) && isKeyOf(it.key, it.sceneSha256) }
            .distinctBy { it.key }
    }

    private fun writeIndex(entries: List<DownloadedSceneEntry>) {
        val text = JSON.encodeToString(StoredIndex.serializer(), StoredIndex(entries = entries.sortedBy { it.key }))
        writeAtomically(indexFile, text.encodeToByteArray())
    }

    /** Write to a temporary file in the same folder, then rename it over the target in one step. */
    private fun writeAtomically(target: File, bytes: ByteArray) {
        val temp = File(root, ".${target.name}.${System.nanoTime()}$TEMP_SUFFIX")
        try {
            temp.outputStream().use { out ->
                out.write(bytes)
                out.fd.sync()
            }
            try {
                Files.move(temp.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } catch (e: AtomicMoveNotSupportedException) {
                throw IOException("this storage cannot rename files atomically", e)
            }
        } finally {
            if (temp.exists()) temp.delete()
        }
    }

    /** Leftovers of a write that was interrupted (a killed process). Only ever our own temporary names. */
    private fun sweepTemporaryFiles() {
        root.listFiles { f -> f.isFile && f.name.startsWith(".") && f.name.endsWith(TEMP_SUFFIX) }?.forEach { it.delete() }
    }

    @Serializable
    private data class StoredIndex(
        val schema: String = INDEX_SCHEMA,
        val version: Int = 1,
        val entries: List<DownloadedSceneEntry> = emptyList(),
    )

    companion object {
        /** No downloaded scene larger than this is ever held or kept. */
        const val MAX_SCENE_BYTES: Long = 64L * 1024 * 1024

        const val KEY_PREFIX = "analysis-"
        const val INDEX = "index.json"
        const val INDEX_SCHEMA = "buildplan.downloaded-analyses"
        private const val KEY_HASH_CHARS = 12
        private const val TEMP_SUFFIX = ".tmp"

        private val SHA256_HEX = Regex("^[0-9a-f]{64}$")
        private val LOCKS = ConcurrentHashMap<String, Any>()
        private val JSON = Json { ignoreUnknownKeys = true; coerceInputValues = true; prettyPrint = false }

        private val DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)

        /**
         * `analysis-` and the first 12 hex characters of the scene's sha256.
         * In the (astronomically unlikely) case that another stored scene
         * already has those 12, the prefix grows until it is unique.
         */
        fun keyFor(sceneSha256: String, taken: Set<String> = emptySet()): String {
            var n = KEY_HASH_CHARS
            while (n < sceneSha256.length && "$KEY_PREFIX${sceneSha256.take(n)}" in taken) n += 4
            return "$KEY_PREFIX${sceneSha256.take(n)}"
        }

        /** Whether `key` is a key this store derives from `sceneSha256`. Bundled keys never are. */
        fun isKeyOf(key: String, sceneSha256: String): Boolean {
            if (!key.startsWith(KEY_PREFIX)) return false
            val hex = key.removePrefix(KEY_PREFIX)
            return hex.length >= KEY_HASH_CHARS && sceneSha256.startsWith(hex)
        }

        fun isDownloadedKey(key: String): Boolean = key.startsWith(KEY_PREFIX)

        /** "Analysed <date> · candidate <first 12 of the candidate hash>". */
        fun subtitleFor(analyzedAt: String, candidateHash: String): String {
            val date = try {
                DATE.format(Instant.parse(analyzedAt).atZone(ZoneId.systemDefault()))
            } catch (e: Exception) {
                analyzedAt.take(10).ifBlank { "on an unknown date" }
            }
            return "Analysed $date · candidate ${candidateHash.take(KEY_HASH_CHARS)}"
        }

        fun sha256Hex(bytes: ByteArray): String = hex(MessageDigest.getInstance("SHA-256").digest(bytes))

        private val HEX_DIGITS = "0123456789abcdef".toCharArray()

        private fun hex(digest: ByteArray): String {
            val out = CharArray(digest.size * 2)
            for ((i, b) in digest.withIndex()) {
                val v = b.toInt() and 0xff
                out[i * 2] = HEX_DIGITS[v ushr 4]
                out[i * 2 + 1] = HEX_DIGITS[v and 0x0f]
            }
            return String(out)
        }

        private fun fileSha256(file: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    digest.update(buffer, 0, n)
                }
            }
            return hex(digest.digest())
        }

        /** Server text shown as a title: one line, no control characters, a sane length. */
        private fun displayText(text: String): String {
            val flat = text.filter { !it.isISOControl() }.trim()
            return if (flat.length <= 160) flat else flat.take(159) + "…"
        }
    }
}
