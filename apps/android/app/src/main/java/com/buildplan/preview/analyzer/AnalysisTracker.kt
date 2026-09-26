package com.buildplan.preview.analyzer

import com.buildplan.preview.scene.AnalysisOrigin
import com.buildplan.preview.scene.AnalysisRecord
import com.buildplan.preview.scene.DownloadedSceneEntry
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.SaveResult
import com.buildplan.preview.scene.SceneRejection

/** What to offer after a failure. */
enum class RetryAction {
    /** Nothing sensible to repeat as is: the link has to change, or the app does. */
    NONE,

    /** Submit the same link again as a new analysis. */
    RESUBMIT,

    /** Fetch the finished job's summary and scene again. */
    REFINISH,
}

/**
 * Where one analysis is, as the Analyzer screen shows it.
 *
 * Every value here comes from the service's answers; nothing is estimated on
 * the phone. In particular the progress is the server's `progress`, shown as
 * sent, and it only changes when a new status record arrives.
 */
sealed interface AnalysisState {
    data object Idle : AnalysisState

    data class Submitting(val sourceUrl: String) : AnalysisState

    /** A job exists; its status is polled until it ends. `status` is null until the first answer. */
    data class Polling(
        val jobId: String,
        val sourceUrl: String,
        val status: JobStatus? = null,
        val consecutiveFailures: Int = 0,
        val lastFailure: AnalyzerFailure? = null,
        /** Set when the job runs on this phone: the runtime and what the run has cost so far. */
        val local: LocalRunReport? = null,
    ) : AnalysisState {
        val connectionLost: Boolean get() = consecutiveFailures > 0
    }

    /** The job is COMPLETED: fetching the summary, downloading and verifying the scene. */
    data class Finishing(
        val jobId: String,
        val sourceUrl: String,
        val status: JobStatus,
        val consecutiveFailures: Int = 0,
        val lastFailure: AnalyzerFailure? = null,
        val local: LocalRunReport? = null,
    ) : AnalysisState {
        val connectionLost: Boolean get() = consecutiveFailures > 0
    }

    /** Stored and verified; ready to open. */
    data class Completed(
        val jobId: String,
        val sourceUrl: String,
        val summary: AnalysisSummary,
        val entry: DownloadedSceneEntry,
        val status: JobStatus?,
        val local: LocalRunReport? = null,
    ) : AnalysisState

    data class Failed(
        val failure: AnalyzerFailure,
        val retry: RetryAction,
        val sourceUrl: String?,
        val jobId: String? = null,
        val status: JobStatus? = null,
        val local: LocalRunReport? = null,
    ) : AnalysisState

    data class Cancelled(val jobId: String, val sourceUrl: String, val status: JobStatus?, val local: LocalRunReport? = null) : AnalysisState
}

/**
 * What the store records for a finished analysis, from its summary: the same
 * for a scene downloaded from the service and one made on this phone.
 */
fun recordOf(summary: AnalysisSummary, jobId: String, fallbackUrl: String, fallbackCompletedAt: String, origin: String): AnalysisRecord = AnalysisRecord(
    title = summary.title,
    label = summary.label,
    sceneSha256 = summary.sceneSha256,
    sceneContentHash = summary.sceneContentHash,
    candidateHash = summary.candidateHash,
    modelHash = summary.modelHash,
    sourceUrl = summary.sourceUrl.ifBlank { fallbackUrl },
    jobId = jobId,
    analyzedAt = summary.completedAt.ifBlank { fallbackCompletedAt },
    qualityL0 = summary.quality.levels.l0,
    qualityL1 = summary.quality.levels.l1,
    qualityL2 = summary.quality.levels.l2,
    unresolvedCount = summary.unresolved.size,
    warningsCount = summary.warnings.size,
    visionMode = summary.vision.mode,
    origin = origin,
)

/** The next state, and how long to wait before the next [AnalysisTracker.step]; null once nothing is left to do. */
data class Step(val state: AnalysisState, val delayMs: Long?)

/** What a cancel request came to. */
sealed interface CancelOutcome {
    data class Cancelled(val state: AnalysisState.Cancelled) : CancelOutcome

    /** The job had already ended (409); poll once more to learn how. */
    data object AlreadyFinished : CancelOutcome

    data class Failed(val failure: AnalyzerFailure) : CancelOutcome
}

/**
 * The analysis lifecycle as a plain state machine: submit, poll until the job
 * ends, then fetch the summary, download the scene, verify and store it.
 *
 * Each call does one round of network work and returns the next state and
 * the delay the caller should wait before calling again. There is no clock or
 * thread in here — the ViewModel owns the loop, tests drive it step by step.
 * A lost connection never loses the job: the job id is kept, the delay grows,
 * and the next answer resets it.
 */
class AnalysisTracker(
    private val client: AnalyzerClient,
    private val store: DownloadedScenes,
    private val maxSceneBytes: Long = DownloadedScenes.MAX_SCENE_BYTES,
) {

    fun submit(sourceUrl: String): AnalysisState = when (val r = client.submit(sourceUrl)) {
        is Outcome.Ok -> AnalysisState.Polling(r.value.jobId, sourceUrl.trim())
        is Outcome.Err -> AnalysisState.Failed(r.failure, retryAfterSubmit(r.failure), sourceUrl.trim())
    }

    fun step(state: AnalysisState): Step = when (state) {
        is AnalysisState.Polling -> poll(state)
        is AnalysisState.Finishing -> finish(state)
        else -> Step(state, null)
    }

    fun cancel(jobId: String, sourceUrl: String, status: JobStatus?): CancelOutcome = when (val r = client.cancel(jobId)) {
        is Outcome.Ok -> CancelOutcome.Cancelled(AnalysisState.Cancelled(jobId, sourceUrl, status))
        is Outcome.Err -> {
            val f = r.failure
            if (f is AnalyzerFailure.Http && (f.status == 409 || f.code == "ALREADY_FINISHED")) CancelOutcome.AlreadyFinished
            else CancelOutcome.Failed(f)
        }
    }

    private fun poll(state: AnalysisState.Polling): Step = when (val r = client.status(state.jobId)) {
        is Outcome.Err ->
            if (r.failure.isTransient) {
                val failures = state.consecutiveFailures + 1
                Step(state.copy(consecutiveFailures = failures, lastFailure = r.failure), backoff(failures, r.failure))
            } else {
                Step(AnalysisState.Failed(r.failure, RetryAction.RESUBMIT, state.sourceUrl, state.jobId, state.status), null)
            }
        is Outcome.Ok -> {
            val status = r.value
            val sourceUrl = state.sourceUrl.ifBlank { status.sourceUrl }
            when (status.status) {
                AnalysisStages.COMPLETED -> Step(AnalysisState.Finishing(state.jobId, sourceUrl, status), 0)
                AnalysisStages.FAILED -> {
                    val error = status.error
                    val failure = AnalyzerFailure.JobFailed(
                        code = error?.code?.ifBlank { null } ?: "FAILED",
                        message = error?.message?.ifBlank { null } ?: "the service did not say why",
                    )
                    Step(AnalysisState.Failed(failure, RetryAction.RESUBMIT, sourceUrl, state.jobId, status), null)
                }
                AnalysisStages.CANCELLED -> Step(AnalysisState.Cancelled(state.jobId, sourceUrl, status), null)
                else -> Step(AnalysisState.Polling(state.jobId, sourceUrl, status), POLL_INTERVAL_MS)
            }
        }
    }

    private fun finish(state: AnalysisState.Finishing): Step {
        val summary = when (val r = client.result(state.jobId)) {
            is Outcome.Ok -> r.value
            is Outcome.Err -> return finishFailure(state, r.failure)
        }
        if (summary.sceneBytes > maxSceneBytes) {
            return Step(failed(state, AnalyzerFailure.TooLarge(maxSceneBytes), RetryAction.NONE), null)
        }
        val download = when (val r = client.downloadScene(state.jobId, maxSceneBytes)) {
            is Outcome.Ok -> r.value
            is Outcome.Err -> return finishFailure(state, r.failure)
        }
        val record = recordOf(summary, state.jobId, state.sourceUrl, state.status.completedAt.orEmpty(), AnalysisOrigin.SERVICE)
        return when (val saved = store.save(download.bytes, download.headerSha256, record)) {
            is SaveResult.Saved -> Step(AnalysisState.Completed(state.jobId, state.sourceUrl, summary, saved.entry, state.status), null)
            is SaveResult.Rejected -> {
                val (failure, retry) = when (val reason = saved.reason) {
                    is SceneRejection.TooLarge -> AnalyzerFailure.TooLarge(reason.limitBytes) to RetryAction.NONE
                    is SceneRejection.HashMismatch -> AnalyzerFailure.HashMismatch(reason.what, reason.expected, reason.actual) to RetryAction.REFINISH
                    is SceneRejection.InvalidScene -> AnalyzerFailure.InvalidScene(reason.message) to RetryAction.NONE
                    is SceneRejection.StorageFailed -> AnalyzerFailure.StorageFailed(reason.message) to RetryAction.REFINISH
                }
                Step(failed(state, failure, retry), null)
            }
        }
    }

    private fun finishFailure(state: AnalysisState.Finishing, failure: AnalyzerFailure): Step =
        if (failure.isTransient) {
            val failures = state.consecutiveFailures + 1
            Step(state.copy(consecutiveFailures = failures, lastFailure = failure), backoff(failures, failure))
        } else {
            val retry = when (failure) {
                is AnalyzerFailure.TooLarge, is AnalyzerFailure.InvalidScene -> RetryAction.NONE
                is AnalyzerFailure.Http -> if (failure.status == 404 || failure.status == 410) RetryAction.RESUBMIT else RetryAction.REFINISH
                else -> RetryAction.REFINISH
            }
            Step(failed(state, failure, retry), null)
        }

    private fun failed(state: AnalysisState.Finishing, failure: AnalyzerFailure, retry: RetryAction) =
        AnalysisState.Failed(failure, retry, state.sourceUrl, state.jobId, state.status)

    private fun retryAfterSubmit(failure: AnalyzerFailure): RetryAction = when (failure) {
        is AnalyzerFailure.InvalidUrl, is AnalyzerFailure.UnsupportedPublisher, is AnalyzerFailure.NotConfigured -> RetryAction.NONE
        else -> RetryAction.RESUBMIT
    }

    companion object {
        /** How often a running job is polled; the contract asks for every 1–3 s. */
        const val POLL_INTERVAL_MS = 1_500L

        /** The longest wait between attempts while the connection is lost. */
        const val MAX_BACKOFF_MS = 30_000L

        /**
         * The wait after the n-th consecutive failure: the service's
         * `Retry-After` when it sent one, else 3 s, 6 s, 12 s, 24 s, then 30 s.
         */
        fun backoff(failures: Int, failure: AnalyzerFailure? = null): Long {
            failure?.retryAfterMs?.let { return it.coerceIn(POLL_INTERVAL_MS, 10 * 60_000L) }
            val shift = (failures.coerceAtLeast(1)).coerceAtMost(5)
            return (POLL_INTERVAL_MS shl shift).coerceAtMost(MAX_BACKOFF_MS)
        }
    }
}
