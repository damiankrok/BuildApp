package com.buildplan.preview.analyzer

import com.buildplan.preview.BuildConfig
import com.buildplan.preview.scene.AnalysisOrigin
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.time.Instant
import java.util.UUID
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * N7-FIX-01 (Council F-2): which analyzer made a result, kept with the result. A result stored without it cannot be
 * told apart from one an older build made — and "after the fix nothing changed" then proves nothing. Each field is
 * what the phone itself knew when the run ended; nothing is filled in afterwards from the build that shows it. A
 * result stored before this record existed has none and is shown as [VERSION_UNKNOWN], never as the current build.
 *
 * No address of the analysed project is kept here: the record names the run, not the house.
 */
@Serializable
data class RunProvenance(
    /** One run, one id: the job's own id, or a fresh one when the run had none. */
    val analysisRunId: String = "",
    /** When the run ended (ISO-8601), as the analyzer reported it or, failing that, as the phone saw it. */
    val analyzedAt: String = "",
    /** The app that ran (LOCAL) or received (SERVICE) the analysis. */
    val apkVersionCode: Long = 0,
    val apkVersionName: String = "",
    /** [AnalysisOrigin.LOCAL] or [AnalysisOrigin.SERVICE]. */
    val mode: String = "",
    val analyzerService: String = "",
    val solverVersion: String = "",
    /**
     * SHA-256 of the `analyzer.mjs` that ran: on this phone, the installed file checked against the bundle's manifest
     * just before the program started; for a service run the phone cannot see it, and it stays empty.
     */
    val analyzerBundleSha256: String = "",
    /** The model the run built (its canonical hash and the file's sha256), and the base checkpoint a partial preview kept. */
    val modelHash: String = "",
    val modelSha256: String = "",
    val checkpointSha256: String = "",
    /** [STATE_COMPLETE], [STATE_PARTIAL] or [STATE_FAILED] (or [STATE_CANCELLED]). */
    val state: String = "",
    /** The failure's code, for a failed run. */
    val failureCode: String = "",
) {
    /** The record as plain text, one fact per line, for the clipboard. No address of the project is in it. */
    fun copyText(): String = listOf(
        "analysisRunId: $analysisRunId",
        "analyzedAt: $analyzedAt",
        "apk: $apkVersionName ($apkVersionCode)",
        "mode: $mode",
        "analyzer: service ${analyzerService.ifBlank { "?" }} · solver ${solverVersion.ifBlank { "?" }}",
        "analyzer.mjs sha256: ${analyzerBundleSha256.ifBlank { BUNDLE_NOT_VISIBLE }}",
        "model hash: ${modelHash.ifBlank { "—" }}",
        "model sha256: ${modelSha256.ifBlank { "—" }}",
        "checkpoint sha256: ${checkpointSha256.ifBlank { "—" }}",
        "state: $state${if (failureCode.isNotBlank()) " ($failureCode)" else ""}",
    ).joinToString("\n")

    companion object {
        const val STATE_COMPLETE = "COMPLETE"
        const val STATE_PARTIAL = "PARTIAL_3D_PREVIEW"
        const val STATE_FAILED = "FAILED"
        const val STATE_CANCELLED = "CANCELLED"

        /** What a result stored before provenance was kept is said to be: its analyzer is unknown. */
        const val VERSION_UNKNOWN = "VERSION_UNKNOWN"

        /** What a service run's bundle hash is said to be: the phone did not run it and cannot see it. */
        const val BUNDLE_NOT_VISIBLE = "not visible to the phone (service run)"

        fun runIdOf(jobId: String?): String = jobId?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString()

        /** A finished run's provenance, from its summary. */
        fun of(summary: AnalysisSummary, jobId: String?, mode: String, bundleSha256: String, app: AppBuild, now: () -> Instant = Instant::now): RunProvenance = RunProvenance(
            analysisRunId = runIdOf(jobId ?: summary.jobId),
            analyzedAt = summary.completedAt.ifBlank { now().toString() },
            apkVersionCode = app.versionCode,
            apkVersionName = app.versionName,
            mode = mode,
            analyzerService = summary.analyzer.service,
            solverVersion = summary.analyzer.solver,
            analyzerBundleSha256 = if (mode == AnalysisOrigin.LOCAL) bundleSha256 else "",
            modelHash = summary.modelHash,
            modelSha256 = summary.modelSha256,
            checkpointSha256 = summary.preview.partial?.checkpoint?.modelSha256.orEmpty(),
            state = if (summary.preview.isPartial) STATE_PARTIAL else STATE_COMPLETE,
        )

        /** A run that ended without a result: what the phone knew of it. */
        fun failed(jobId: String?, mode: String, failureCode: String, app: AppBuild, analyzerService: String = "", solverVersion: String = "", bundleSha256: String = "", state: String = STATE_FAILED, now: () -> Instant = Instant::now): RunProvenance = RunProvenance(
            analysisRunId = runIdOf(jobId),
            analyzedAt = now().toString(),
            apkVersionCode = app.versionCode,
            apkVersionName = app.versionName,
            mode = mode,
            analyzerService = analyzerService,
            solverVersion = solverVersion,
            analyzerBundleSha256 = if (mode == AnalysisOrigin.LOCAL) bundleSha256 else "",
            state = state,
            failureCode = failureCode,
        )
    }
}

/** The build that is running: what a provenance record names as the app. */
data class AppBuild(val versionCode: Long, val versionName: String) {
    companion object {
        val CURRENT: AppBuild get() = AppBuild(BuildConfig.VERSION_CODE.toLong(), BuildConfig.VERSION_NAME)
    }
}

/**
 * The last [MAX] runs' provenance, whatever their outcome — a failed service run included, which leaves no scene and
 * no other record on the phone. Written atomically; a failure to write changes nothing else.
 */
class RunProvenanceLog(private val file: File) {
    fun record(p: RunProvenance) {
        try {
            val runs = (listOf(p) + runs().filter { it.analysisRunId != p.analysisRunId }).take(MAX)
            file.parentFile?.mkdirs()
            val temp = File(file.parentFile, ".${file.name}.${System.nanoTime()}.tmp")
            try {
                temp.writeText(JSON.encodeToString(ListSerializer(RunProvenance.serializer()), runs))
                Files.move(temp.toPath(), file.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } finally {
                if (temp.exists()) temp.delete()
            }
        } catch (e: IOException) {
            // The log is a record of runs, not the runs: a full or read-only disk (or one that cannot replace a file
            // in one step) loses the line and nothing else.
        }
    }

    /** Newest first. An unreadable log is an empty one, never trusted in part. */
    fun runs(): List<RunProvenance> = try {
        if (file.isFile) JSON.decodeFromString(ListSerializer(RunProvenance.serializer()), file.readText()) else emptyList()
    } catch (e: Exception) {
        emptyList()
    }

    fun find(runId: String): RunProvenance? = runs().firstOrNull { it.analysisRunId == runId }

    companion object {
        const val MAX = 20
        const val FILE = "provenance.json"
        private val JSON = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    }
}
