package com.buildplan.preview.analyzer

import com.buildplan.preview.analyzer.local.LocalRuntimeFacts
import com.buildplan.preview.analyzer.local.LocalTimings
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * What one analysis on this phone cost, as measured on this phone: the
 * runtime it ran on, how long it took and where the time went, how much
 * memory its process needed at the peak, how large the scene is, and how it
 * ended. Shown on the Analyzer screen and kept in the local run log so the
 * numbers can be read (and screenshotted) after the fact.
 *
 * Every number comes from the analyzer process itself (elapsed time on its
 * monotonic clock, memory from the kernel's accounting of that process).
 * Nothing is estimated here.
 */
@Serializable
data class LocalRunReport(
    val jobId: String = "",
    val sourceUrl: String = "",
    /** `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` or `INTERRUPTED`. */
    val outcome: String = OUTCOME_RUNNING,
    /** The failure's code when it failed, e.g. `SOURCE_UNREACHABLE` or `RUNTIME_STOPPED`. */
    val code: String? = null,
    /** The ABI of the runtime library the phone loaded, e.g. `arm64-v8a`. */
    val abi: String = "",
    val runtime: LocalRuntimeFacts? = null,
    val analyzerService: String = "",
    val analyzerSolver: String = "",
    val elapsedMs: Long = 0,
    /** Resident memory of the analyzer process at the last report. */
    val rssBytes: Long = 0,
    /** Peak resident memory of the analyzer process, when the run reported it. */
    val peakRssBytes: Long? = null,
    val peakSource: String? = null,
    val timings: LocalTimings? = null,
    val sceneBytes: Long? = null,
    val sceneSha256: String? = null,
    val modelHash: String? = null,
    val candidateHash: String? = null,
    val startedAtMs: Long = 0,
    val cancelRequested: Boolean = false,
    /** True when the process had to be ended because it did not stop on its own after a cancel. */
    val forcedStop: Boolean = false,
    /** The hashes (never the bytes) of the page and drawings the run read, as the analyzer listed them. */
    val sources: JsonElement? = null,
) {
    companion object {
        const val OUTCOME_RUNNING = "RUNNING"
        const val OUTCOME_COMPLETED = "COMPLETED"
        const val OUTCOME_FAILED = "FAILED"
        const val OUTCOME_CANCELLED = "CANCELLED"
        const val OUTCOME_INTERRUPTED = "INTERRUPTED"
    }
}
