package com.buildplan.preview.analyzer.local

import com.buildplan.preview.analyzer.AnalysisSummary
import com.buildplan.preview.analyzer.AnalyzerJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject

/**
 * The events the embedded analyzer program writes, one JSON object per line
 * (`apps/local-analyzer/src/program.ts`, protocol [PROTOCOL]).
 *
 * Transport classes only: the phone shows what the program reported and
 * checks the scene it wrote against the hashes it reported. Every field has a
 * default, so a member the program adds later never turns a readable line
 * into a failure.
 */
object LocalProtocol {
    /** The protocol this build speaks; `hello` must carry the same. */
    const val PROTOCOL = 1

    const val SUMMARY_FILE = "result.json"
    const val SCENE_FILE = "scene.json"
}

@Serializable
data class LocalRuntimeFacts(
    val node: String = "",
    val v8: String = "",
    val icu: String? = null,
    val platform: String = "",
    val arch: String = "",
    val cpus: Int = 0,
    val totalMemoryBytes: Long = 0,
    val collatorLocale: String = "",
)

@Serializable
data class LocalMemory(
    val rssBytes: Long = 0,
    /** The process's peak resident set, from the kernel (`VmHWM`) where readable. */
    val peakRssBytes: Long = 0,
    val peakSource: String = "",
    val heapUsedBytes: Long = 0,
    val arrayBuffersBytes: Long = 0,
)

/** Where the time of a finished run went (`AnalysisTimings`), milliseconds. */
@Serializable
data class LocalTimings(
    val acquisitionMs: Long = 0,
    val observationMs: Long = 0,
    val metricExtractionMs: Long = 0,
    val reconstructionMs: Long = 0,
    val compileMs: Long = 0,
    val verificationMs: Long = 0,
    val totalMs: Long = 0,
)

@Serializable
data class LocalMetrics(
    val elapsedMs: Long = 0,
    val memory: LocalMemory = LocalMemory(),
    val timings: LocalTimings? = null,
    val sceneBytes: Long? = null,
)

/** One report of the pipeline's position (`AnalysisProgress`). */
@Serializable
data class LocalProgress(
    val stage: String = "",
    val stageIndex: Int = 0,
    val stageCount: Int = 0,
    val stageFraction: Double = 0.0,
    val progress: Double = 0.0,
    val detail: String? = null,
)

@Serializable
data class LocalAnalyzerVersions(val service: String = "", val solver: String = "")

sealed interface LocalEvent {
    data class Hello(val protocol: Int, val jobId: String, val pid: Int, val runtime: LocalRuntimeFacts, val analyzer: LocalAnalyzerVersions) : LocalEvent

    data class Progress(val event: LocalProgress, val elapsedMs: Long, val rssBytes: Long) : LocalEvent

    /** The run finished; its four files are in the job's output folder. `sources` lists the hashes of what it read. */
    data class Done(val summary: AnalysisSummary, val metrics: LocalMetrics, val sources: JsonElement?) : LocalEvent

    data class Failed(val code: String, val message: String, val metrics: LocalMetrics) : LocalEvent

    data class Cancelled(val metrics: LocalMetrics) : LocalEvent

    /** A line that is not an event this build reads. Never fatal on its own. */
    data class Unreadable(val reason: String) : LocalEvent

    val isTerminal: Boolean get() = this is Done || this is Failed || this is Cancelled

    companion object {
        fun parse(line: String): LocalEvent {
            val obj: JsonObject = try {
                AnalyzerJson.parseToJsonElement(line).jsonObject
            } catch (e: Exception) {
                return Unreadable("not a JSON object")
            }
            val type = (obj["type"] as? JsonPrimitive)?.contentOrNull
            return try {
                when (type) {
                    "hello" -> Hello(
                        protocol = (obj["protocol"] as? JsonPrimitive)?.contentOrNull?.toIntOrNull() ?: -1,
                        jobId = (obj["jobId"] as? JsonPrimitive)?.contentOrNull.orEmpty(),
                        pid = (obj["pid"] as? JsonPrimitive)?.contentOrNull?.toIntOrNull() ?: 0,
                        runtime = obj["runtime"]?.let { AnalyzerJson.decodeFromJsonElement<LocalRuntimeFacts>(it) } ?: LocalRuntimeFacts(),
                        analyzer = obj["analyzer"]?.let { AnalyzerJson.decodeFromJsonElement<LocalAnalyzerVersions>(it) } ?: LocalAnalyzerVersions(),
                    )
                    "progress" -> Progress(
                        event = AnalyzerJson.decodeFromJsonElement(obj.getValue("event")),
                        elapsedMs = (obj["elapsedMs"] as? JsonPrimitive)?.contentOrNull?.toLongOrNull() ?: 0,
                        rssBytes = (obj["rssBytes"] as? JsonPrimitive)?.contentOrNull?.toLongOrNull() ?: 0,
                    )
                    "done" -> Done(
                        summary = AnalyzerJson.decodeFromJsonElement(obj.getValue("summary")),
                        metrics = obj["metrics"]?.let { AnalyzerJson.decodeFromJsonElement<LocalMetrics>(it) } ?: LocalMetrics(),
                        sources = obj["sources"],
                    )
                    "failed" -> Failed(
                        code = (obj["code"] as? JsonPrimitive)?.contentOrNull?.ifBlank { null } ?: "FAILED",
                        message = (obj["message"] as? JsonPrimitive)?.contentOrNull?.ifBlank { null } ?: "the analyzer did not say why",
                        metrics = obj["metrics"]?.let { AnalyzerJson.decodeFromJsonElement<LocalMetrics>(it) } ?: LocalMetrics(),
                    )
                    "cancelled" -> Cancelled(metrics = obj["metrics"]?.let { AnalyzerJson.decodeFromJsonElement<LocalMetrics>(it) } ?: LocalMetrics())
                    else -> Unreadable("unknown event type ${type ?: "(none)"}")
                }
            } catch (e: Exception) {
                Unreadable("a $type event this build cannot read")
            }
        }
    }
}
