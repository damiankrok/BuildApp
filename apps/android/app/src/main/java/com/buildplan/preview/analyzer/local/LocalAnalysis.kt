package com.buildplan.preview.analyzer.local

import com.buildplan.preview.analyzer.AnalysisStages
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalysisSummary
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.AnalyzerJson
import com.buildplan.preview.analyzer.CurrentStage
import com.buildplan.preview.analyzer.JobStatus
import com.buildplan.preview.analyzer.LocalRunReport
import com.buildplan.preview.analyzer.RetryAction
import com.buildplan.preview.analyzer.StageRecord
import com.buildplan.preview.analyzer.recordOf
import com.buildplan.preview.scene.AnalysisOrigin
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.SaveResult
import com.buildplan.preview.scene.SceneRejection
import java.io.File

/** Timers and hand-offs on the thread that owns the analysis state (the main thread in the app). */
interface Scheduler {
    fun post(action: () -> Unit)

    /** Run `action` after `delayMs`; the returned function cancels it. */
    fun postDelayed(delayMs: Long, action: () -> Unit): () -> Unit
}

/**
 * One analysis on this phone, from the link to a scene in the analyses store.
 *
 *   start(url) ─► install the bundle, create the job's folders and journal
 *              ─► the host starts a fresh `:analyzer` process running the
 *                 PRODUCTION analyzer program (analyzer.mjs) on the link
 *              ─► hello, progress … ─► done | failed | cancelled
 *              ─► the process is ended; on done the scene is verified and
 *                 stored exactly as a downloaded one is (sha256, schema,
 *                 contentHash, atomic write); the job's folder is removed
 *              ─► the final state is published and the run is logged.
 *
 * The phone's code decides nothing about the building: it passes a link in
 * and bytes out, and checks the bytes against the hashes the analyzer
 * reported. Every state is an [AnalysisState], so the Analyzer screen shows a
 * local job with the same checklist, result card and failures as a service
 * job.
 *
 * Invariants the tests hold it to:
 *  - one job at a time; a second start while one runs is refused;
 *  - a terminal state is published only after the job's folder is gone (and,
 *    when the process had to be ended, after it is gone), so "cancelled" and
 *    "failed" never leave scratch behind;
 *  - a cancel is asked for first (the program stops at its next checkpoint,
 *    at once inside a download) and enforced after [cancelGraceMs] by ending
 *    the process — a stage that is computing cannot delay it;
 *  - the process ends however the job ends, so the next job gets a fresh one;
 *  - a process that dies without a terminal event is a failure, never a result.
 *
 * Not thread-safe by design: every method and every listener call runs on the
 * [scheduler]'s thread; file work runs on [io] and comes back through it.
 */
class LocalAnalysis(
    private val jobs: LocalJobs,
    private val scenes: DownloadedScenes,
    private val host: LocalRuntimeHost,
    private val install: () -> InstalledRuntime,
    private val abi: String,
    private val io: (() -> Unit) -> Unit,
    private val scheduler: Scheduler,
    private val publish: (AnalysisState) -> Unit,
    private val onFinished: (LocalRunReport) -> Unit = {},
    private val clock: () -> Long = System::currentTimeMillis,
    private val cancelGraceMs: Long = CANCEL_GRACE_MS,
    private val processGoneWaitMs: Long = PROCESS_GONE_WAIT_MS,
    private val maxSceneBytes: Long = DownloadedScenes.MAX_SCENE_BYTES,
    /** Which installed program to start. Production: the bundle's own entry, `main.mjs`. */
    private val program: (InstalledRuntime) -> File = { it.entry },
) {
    private var active: Run? = null
    private var starting = false
    private var closed = false

    /** A job is being prepared, is running, or is being finished. */
    val isBusy: Boolean get() = starting || active != null

    /** Whether a cancel is on its way for the running job. */
    val isCancelling: Boolean get() = active?.cancelRequested == true && active?.terminal == false

    fun start(sourceUrl: String): Boolean {
        if (closed || isBusy) return false
        starting = true
        publish(AnalysisState.Submitting(sourceUrl))
        io {
            val prepared: Result<Pair<InstalledRuntime, LocalJob>> = runCatching { install() to jobs.create(sourceUrl) }
            scheduler.post {
                starting = false
                prepared.fold(
                    onSuccess = { (runtime, job) -> if (closed) jobs.finish(job) else begin(runtime, job) },
                    onFailure = { e ->
                        val failure = AnalyzerFailure.LocalRuntime("RUNTIME_INSTALL_FAILED", e.message ?: "the analyzer could not be prepared on this phone")
                        publish(AnalysisState.Failed(failure, RetryAction.RESUBMIT, sourceUrl))
                    },
                )
            }
        }
        return true
    }

    fun cancel() {
        val run = active ?: return
        if (run.terminal || run.cancelRequested) return
        run.cancelRequested = true
        run.report = run.report.copy(cancelRequested = true)
        run.handle?.cancel()
        run.publishProgress()
        run.cancelTimer = scheduler.postDelayed(cancelGraceMs) {
            if (!run.terminal) {
                // It did not stop on its own in time: it is computing. End the process.
                run.report = run.report.copy(forcedStop = true)
                run.finish(Ending.Cancelled)
            }
        }
    }

    /**
     * The owner is going away (the Analyzer's ViewModel is cleared): no job may
     * outlive it. The process is ended now and the folder removed; a folder
     * that cannot be removed this instant is removed at the next start.
     */
    fun shutdown() {
        closed = true
        val run = active ?: return
        active = null
        run.terminal = true
        run.cancelTimer?.invoke()
        run.handle?.terminate()
        jobs.finish(run.job)
        onFinished(run.report.copy(outcome = LocalRunReport.OUTCOME_CANCELLED, code = "APP_CLOSED"))
    }

    private fun begin(runtime: InstalledRuntime, job: LocalJob) {
        val run = Run(job, LocalRunReport(jobId = job.jobId, sourceUrl = job.sourceUrl, abi = abi, startedAtMs = clock()))
        active = run
        run.publishProgress()
        val request = LocalRunRequest(
            program = program(runtime).absolutePath,
            arguments = listOf("--job", job.jobId, "--url", job.sourceUrl, "--work", job.workDir.absolutePath, "--out", job.outDir.absolutePath),
            environment = listOf("TMPDIR=${job.workDir.absolutePath}", "HOME=${job.dir.absolutePath}"),
        )
        run.handle = host.start(request, run)
    }

    private sealed interface Ending {
        data class Done(val event: LocalEvent.Done) : Ending
        data class Failed(val failure: AnalyzerFailure, val code: String) : Ending
        data object Cancelled : Ending
    }

    private inner class Run(val job: LocalJob, var report: LocalRunReport) : LocalRunListener {
        var handle: LocalRunHandle? = null
        var progress: LocalProgress? = null
        var terminal = false
        var cancelRequested = false
        var cancelTimer: (() -> Unit)? = null
        private var ending: Ending? = null
        private var processGone = false
        private var cleaned = false
        private var goneFallback: (() -> Unit)? = null

        private val current: Boolean get() = active === this

        fun publishProgress() {
            if (!current || terminal) return
            publish(AnalysisState.Polling(job.jobId, job.sourceUrl, statusOf(progress, null), local = report))
        }

        override fun onStarted(pid: Int) = Unit

        override fun onLine(line: String) {
            if (!current || terminal) return
            when (val event = LocalEvent.parse(line)) {
                is LocalEvent.Hello -> {
                    if (event.protocol != LocalProtocol.PROTOCOL || event.jobId != job.jobId) {
                        finish(Ending.Failed(AnalyzerFailure.LocalRuntime("RUNTIME_PROTOCOL", "the embedded analyzer does not speak this app's protocol"), "RUNTIME_PROTOCOL"))
                        return
                    }
                    report = report.copy(runtime = event.runtime, analyzerService = event.analyzer.service, analyzerSolver = event.analyzer.solver)
                    publishProgress()
                }
                is LocalEvent.Progress -> {
                    progress = event.event
                    report = report.copy(elapsedMs = event.elapsedMs, rssBytes = event.rssBytes)
                    publishProgress()
                }
                is LocalEvent.Done -> {
                    report = report.withMetrics(event.metrics).copy(
                        sceneSha256 = event.summary.sceneSha256,
                        modelHash = event.summary.modelHash,
                        candidateHash = event.summary.candidateHash,
                        sources = event.sources,
                    )
                    publish(AnalysisState.Finishing(job.jobId, job.sourceUrl, statusOf(progress, AnalysisStages.COMPLETED), local = report))
                    finish(Ending.Done(event))
                }
                is LocalEvent.Failed -> {
                    report = report.withMetrics(event.metrics)
                    finish(Ending.Failed(AnalyzerFailure.JobFailed(event.code, event.message), event.code))
                }
                is LocalEvent.Cancelled -> {
                    report = report.withMetrics(event.metrics)
                    finish(Ending.Cancelled)
                }
                is LocalEvent.Unreadable -> Unit
            }
        }

        override fun onExited(code: Int) {
            if (!terminal) finish(Ending.Failed(AnalyzerFailure.LocalRuntime("RUNTIME_EXITED", "the analyzer program ended without a result (exit code $code)"), "RUNTIME_EXITED"))
        }

        override fun onStartFailed(code: String, message: String) {
            if (!terminal) finish(Ending.Failed(AnalyzerFailure.LocalRuntime(code, message), code))
        }

        override fun onProcessGone() {
            processGone = true
            if (!terminal) {
                if (cancelRequested) {
                    finish(Ending.Cancelled)
                } else {
                    val message = "the analyzer process stopped before it finished — Android may have ended it because the phone ran short of memory"
                    finish(Ending.Failed(AnalyzerFailure.LocalRuntime("RUNTIME_STOPPED", message), "RUNTIME_STOPPED"))
                }
            }
            if (terminal) cleanUp()
        }

        /** The job is over: end the process, and clean up once it is gone (or after a short wait). */
        fun finish(how: Ending) {
            if (terminal) return
            terminal = true
            ending = how
            cancelTimer?.invoke()
            handle?.terminate()
            if (processGone) cleanUp() else goneFallback = scheduler.postDelayed(processGoneWaitMs) { cleanUp() }
        }

        private fun cleanUp() {
            if (cleaned) return
            cleaned = true
            goneFallback?.invoke()
            val how = ending ?: return
            io {
                val outcome: AnalysisState = when (how) {
                    is Ending.Done -> importScene(how.event)
                    is Ending.Failed -> AnalysisState.Failed(how.failure, RetryAction.RESUBMIT, job.sourceUrl, job.jobId, statusOf(progress, AnalysisStages.FAILED))
                    Ending.Cancelled -> AnalysisState.Cancelled(job.jobId, job.sourceUrl, statusOf(progress, AnalysisStages.CANCELLED))
                }
                val removed = jobs.finish(job)
                scheduler.post {
                    val finalReport = when (outcome) {
                        is AnalysisState.Completed -> report.copy(outcome = LocalRunReport.OUTCOME_COMPLETED)
                        is AnalysisState.Cancelled -> report.copy(outcome = LocalRunReport.OUTCOME_CANCELLED)
                        is AnalysisState.Failed -> report.copy(outcome = LocalRunReport.OUTCOME_FAILED, code = codeOf(outcome.failure))
                        else -> report
                    }
                    report = finalReport
                    if (active === this) active = null
                    if (!removed) {
                        // Not expected: the next start's recovery removes whatever is left.
                        report = report.copy(code = report.code ?: "SCRATCH_NOT_REMOVED")
                    }
                    onFinished(report)
                    if (!closed) publish(withReport(outcome, report))
                }
            }
        }

        private fun importScene(done: LocalEvent.Done): AnalysisState {
            fun failed(failure: AnalyzerFailure) = AnalysisState.Failed(failure, RetryAction.RESUBMIT, job.sourceUrl, job.jobId, statusOf(progress, AnalysisStages.FAILED))
            val summaryFile = File(job.outDir, LocalProtocol.SUMMARY_FILE)
            val sceneFile = File(job.outDir, LocalProtocol.SCENE_FILE)
            if (!summaryFile.isFile || !sceneFile.isFile) {
                return failed(AnalyzerFailure.LocalRuntime("RESULT_MISSING", "the analyzer reported a result but its files are not there"))
            }
            if (sceneFile.length() > maxSceneBytes) return failed(AnalyzerFailure.TooLarge(maxSceneBytes))
            val summary: AnalysisSummary = try {
                AnalyzerJson.decodeFromString(AnalysisSummary.serializer(), summaryFile.readText())
            } catch (e: Exception) {
                return failed(AnalyzerFailure.BadResponse("the analyzer's result file is not a readable summary"))
            }
            if (summary.sceneSha256 != done.summary.sceneSha256 || summary.candidateHash != done.summary.candidateHash) {
                return failed(AnalyzerFailure.HashMismatch("result file", done.summary.sceneSha256, summary.sceneSha256))
            }
            val bytes = try {
                sceneFile.readBytes()
            } catch (e: Exception) {
                return failed(AnalyzerFailure.StorageFailed("the scene the analyzer wrote could not be read"))
            }
            val record = recordOf(summary, job.jobId, job.sourceUrl, "", AnalysisOrigin.LOCAL)
            return when (val saved = scenes.save(bytes, null, record)) {
                is SaveResult.Saved -> AnalysisState.Completed(job.jobId, job.sourceUrl, summary, saved.entry, statusOf(progress, AnalysisStages.COMPLETED))
                is SaveResult.Rejected -> failed(
                    when (val reason = saved.reason) {
                        is SceneRejection.TooLarge -> AnalyzerFailure.TooLarge(reason.limitBytes)
                        is SceneRejection.HashMismatch -> AnalyzerFailure.HashMismatch(reason.what, reason.expected, reason.actual)
                        is SceneRejection.InvalidScene -> AnalyzerFailure.InvalidScene(reason.message)
                        is SceneRejection.StorageFailed -> AnalyzerFailure.StorageFailed(reason.message)
                    },
                )
            }
        }
    }

    private fun LocalRunReport.withMetrics(metrics: LocalMetrics): LocalRunReport = copy(
        elapsedMs = metrics.elapsedMs,
        rssBytes = metrics.memory.rssBytes,
        peakRssBytes = metrics.memory.peakRssBytes.takeIf { it > 0 },
        peakSource = metrics.memory.peakSource.ifBlank { null },
        timings = metrics.timings ?: timings,
        sceneBytes = metrics.sceneBytes ?: sceneBytes,
    )

    companion object {
        /** How long a cancelled program gets to stop on its own before its process is ended. */
        const val CANCEL_GRACE_MS = 1_500L

        /** How long to wait for an ended process to be reported gone before cleaning up anyway. */
        const val PROCESS_GONE_WAIT_MS = 3_000L

        fun codeOf(failure: AnalyzerFailure): String = when (failure) {
            is AnalyzerFailure.JobFailed -> failure.code
            is AnalyzerFailure.LocalRuntime -> failure.code
            is AnalyzerFailure.HashMismatch -> "HASH_MISMATCH"
            is AnalyzerFailure.TooLarge -> "TOO_LARGE"
            is AnalyzerFailure.InvalidScene -> "INVALID_SCENE"
            is AnalyzerFailure.StorageFailed -> "STORAGE_FAILED"
            is AnalyzerFailure.BadResponse -> "BAD_RESULT"
            else -> "FAILED"
        }

        private fun withReport(state: AnalysisState, report: LocalRunReport): AnalysisState = when (state) {
            is AnalysisState.Completed -> state.copy(local = report)
            is AnalysisState.Failed -> state.copy(local = report)
            is AnalysisState.Cancelled -> state.copy(local = report)
            else -> state
        }

        /**
         * The checklist record for a local job, built from the program's last
         * progress event: the stages before it done, it running (or how the
         * job ended), the rest pending. Nothing is guessed: a stage the
         * program has not reached is pending.
         */
        fun statusOf(progress: LocalProgress?, outcome: String?): JobStatus {
            val pipeline = AnalysisStages.PIPELINE
            val index = progress?.let { pipeline.indexOf(it.stage) } ?: -1
            val stages = pipeline.mapIndexed { i, id ->
                val state = when {
                    outcome == AnalysisStages.COMPLETED -> "DONE"
                    index < 0 -> "PENDING"
                    i < index -> "DONE"
                    i == index -> when (outcome) {
                        AnalysisStages.FAILED -> "FAILED"
                        AnalysisStages.CANCELLED -> "CANCELLED"
                        else -> "RUNNING"
                    }
                    else -> "PENDING"
                }
                StageRecord(id = id, label = AnalysisStages.DEFAULT_LABELS.getValue(id), state = state)
            }
            val stage = if (index >= 0 && outcome == null) {
                CurrentStage(
                    id = pipeline[index],
                    label = AnalysisStages.DEFAULT_LABELS.getValue(pipeline[index]),
                    index = index,
                    count = pipeline.size,
                    fraction = progress?.stageFraction ?: 0.0,
                    detail = progress?.detail,
                )
            } else {
                null
            }
            return JobStatus(
                status = outcome ?: progress?.stage ?: STARTING,
                progress = if (outcome == AnalysisStages.COMPLETED) 1.0 else (progress?.progress ?: 0.0),
                stage = stage,
                stages = stages,
            )
        }

        /** Status of a local job before the program's first progress report. */
        const val STARTING = "STARTING"
    }
}
