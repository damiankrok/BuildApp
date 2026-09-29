package com.buildplan.preview.analyzer.local

import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * The diagnostics of failed local analyses, kept after their job folder goes.
 *
 * A failed job's folder is removed as soon as it ends — source images never
 * outlive the analysis that needed them — but a failure on a phone is only
 * useful to the person fixing it if its account survives: the trace, the
 * diagnostics and the plan overlay the program wrote (`<out>/diagnostics`).
 * Those three files, and only those, are copied here before the folder goes.
 * They name the sources by hash and carry no source image.
 *
 * Bounded twice: a file larger than [maxFileBytes] is not kept, and only the
 * [maxBundles] newest bundles are. [zip] packs one for the share sheet.
 */
class DiagnosticsStore(
    private val root: File,
    private val maxBundles: Int = 5,
    private val maxFileBytes: Long = 2L * 1024 * 1024,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    /**
     * Copy a finished job's diagnostics in. `files` are the names the program
     * reported; anything not on the allow list is ignored. Returns the kept
     * bundle's folder, or null when there was nothing to keep.
     */
    fun keep(jobId: String, sourceUrl: String, source: File, files: List<String>): File? {
        if (!JOB_ID.matches(jobId)) return null
        val names = files.filter { it in ALLOWED }.distinct()
        if (names.isEmpty() || !source.isDirectory) return null
        val target = File(root, jobId)
        return try {
            target.deleteRecursively()
            target.mkdirs()
            var kept = 0
            for (name in names) {
                val from = File(source, name)
                if (!from.isFile || from.length() > maxFileBytes) continue
                from.copyTo(File(target, name), overwrite = true)
                kept += 1
            }
            if (kept == 0) {
                target.deleteRecursively()
                return null
            }
            File(target, META_FILE).writeText("""{"jobId":"$jobId","sourceUrl":${jsonString(sourceUrl)},"keptAtMs":${clock()}}""" + "\n")
            prune()
            target
        } catch (e: Exception) {
            target.deleteRecursively()
            null
        }
    }

    /** The kept bundles, newest first. */
    fun bundles(): List<File> = (root.listFiles { f -> f.isDirectory && JOB_ID.matches(f.name) } ?: emptyArray())
        .sortedWith(compareByDescending<File> { keptAt(it) }.thenBy { it.name })

    /** One bundle packed as a zip at `into`, for sharing. Null when the bundle is gone. */
    fun zip(bundle: File, into: File): File? {
        if (!bundle.isDirectory || bundle.parentFile?.canonicalPath != root.canonicalPath) return null
        val entries = (bundle.listFiles { f -> f.isFile && (f.name in ALLOWED || f.name == META_FILE) } ?: emptyArray()).sortedBy { it.name }
        if (entries.isEmpty()) return null
        into.parentFile?.mkdirs()
        ZipOutputStream(into.outputStream()).use { out ->
            for (file in entries) {
                out.putNextEntry(ZipEntry("buildplan-diagnostics-${bundle.name}/${file.name}"))
                file.inputStream().use { it.copyTo(out) }
                out.closeEntry()
            }
        }
        return into
    }

    private fun keptAt(bundle: File): Long = try {
        Regex("\"keptAtMs\":(\\d+)").find(File(bundle, META_FILE).readText())?.groupValues?.get(1)?.toLong() ?: bundle.lastModified()
    } catch (e: Exception) {
        bundle.lastModified()
    }

    private fun prune() {
        for (old in bundles().drop(maxBundles)) old.deleteRecursively()
    }

    private fun jsonString(s: String): String = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").filter { it >= ' ' } + "\""

    companion object {
        /** What the program may leave in `<out>/diagnostics` that is worth keeping. */
        val ALLOWED = setOf("diagnostics.json", "trace.json", "plan-overlay.png", "performance.json")
        const val META_FILE = "kept.json"
        private val JOB_ID = Regex("^[0-9a-f]{32}$")
    }
}
