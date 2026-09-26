package com.buildplan.preview.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.buildplan.preview.BuildConfig
import com.buildplan.preview.analyzer.ActiveJob
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalysisTracker
import com.buildplan.preview.analyzer.AnalyzerAddress
import com.buildplan.preview.analyzer.AnalyzerClient
import com.buildplan.preview.analyzer.AnalyzerMessages
import com.buildplan.preview.analyzer.AnalyzerSettings
import com.buildplan.preview.analyzer.CancelOutcome
import com.buildplan.preview.analyzer.HttpTransport
import com.buildplan.preview.analyzer.HttpUrlConnectionTransport
import com.buildplan.preview.analyzer.ProjectLinks
import com.buildplan.preview.analyzer.RetryAction
import com.buildplan.preview.scene.DownloadedSceneEntry
import com.buildplan.preview.scene.DownloadedScenes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The Analyzer screen's state: which service, which link, where the job is,
 * and what has been downloaded.
 *
 * The loop that polls a job lives here and nowhere else. It waits the delay
 * the [AnalysisTracker] asks for between rounds — the progress bar moves only
 * when a new status record arrives, never on a timer. The running job's id is
 * saved as soon as it exists, so closing and reopening the app resumes the
 * same job instead of starting another.
 */
class AnalyzerViewModel(application: Application) : AndroidViewModel(application) {

    private val settings = AnalyzerSettings(application)
    private val transport: HttpTransport = HttpUrlConnectionTransport()
    val store = DownloadedScenes(java.io.File(application.filesDir, ANALYSES_DIR))

    /** The address compiled into this build (`ANALYZER_API_BASE_URL`), possibly empty. */
    val builtInAddress: String = BuildConfig.ANALYZER_API_BASE_URL

    var serviceAddress by mutableStateOf(settings.serviceAddress)
        private set

    var link by mutableStateOf(settings.lastLink)
        private set

    var linkProblem by mutableStateOf<String?>(null)
        private set

    var state by mutableStateOf<AnalysisState>(AnalysisState.Idle)
        private set

    /** A short note that is not a failure of the job, e.g. a cancel request that did not get through. */
    var notice by mutableStateOf<String?>(null)
        private set

    var downloads by mutableStateOf<List<DownloadedSceneEntry>>(emptyList())
        private set

    /** A cancel request is on its way; the Cancel button waits for its answer. */
    var cancelling by mutableStateOf(false)
        private set

    private var loop: Job? = null
    private var jobBaseUrl: String? = null

    /**
     * The address requests go to: the one typed on the phone when there is a
     * valid one, else the build's own. Null when neither is a valid https URL.
     */
    val effectiveBaseUrl: String?
        get() = AnalyzerAddress.normalize(serviceAddress) ?: AnalyzerAddress.normalize(builtInAddress)

    val isConfigured: Boolean get() = effectiveBaseUrl != null

    /** Whether a job is being submitted, polled or finished right now. */
    val isRunning: Boolean
        get() = state is AnalysisState.Submitting || state is AnalysisState.Polling || state is AnalysisState.Finishing

    init {
        refreshDownloads()
        settings.activeJob?.let { resume(it) }
    }

    fun onLinkChange(value: String) {
        link = value
        linkProblem = null
    }

    /** Save the service address typed on the phone. Returns the problem with it, or null when saved. */
    fun saveServiceAddress(raw: String): String? {
        val text = raw.trim()
        if (text.isEmpty()) {
            settings.serviceAddress = ""
            serviceAddress = ""
            return null
        }
        return when (val check = AnalyzerAddress.check(text)) {
            is AnalyzerAddress.Check.Valid -> {
                settings.serviceAddress = check.baseUrl
                serviceAddress = check.baseUrl
                null
            }
            is AnalyzerAddress.Check.Invalid -> "That address can't be used: ${check.reason}."
            AnalyzerAddress.Check.Empty -> null
        }
    }

    fun analyze() {
        if (isRunning) return
        val base = effectiveBaseUrl ?: run {
            state = AnalysisState.Idle
            return
        }
        val url = link.trim()
        ProjectLinks.problem(url)?.let { linkProblem = it; return }
        linkProblem = null
        notice = null
        settings.lastLink = url
        startSubmit(base, url)
    }

    fun retry() {
        val failed = state as? AnalysisState.Failed ?: return
        notice = null
        when (failed.retry) {
            RetryAction.NONE -> Unit
            RetryAction.RESUBMIT -> {
                val base = effectiveBaseUrl ?: return
                val url = failed.sourceUrl ?: link.trim()
                if (ProjectLinks.problem(url) == null) startSubmit(base, url)
            }
            RetryAction.REFINISH -> {
                val jobId = failed.jobId ?: return
                val base = jobBaseUrl ?: effectiveBaseUrl ?: return
                val status = failed.status
                if (status != null) {
                    startLoop(base, AnalysisState.Finishing(jobId, failed.sourceUrl.orEmpty(), status))
                } else {
                    startLoop(base, AnalysisState.Polling(jobId, failed.sourceUrl.orEmpty()))
                }
            }
        }
    }

    /** Back to the empty form; a finished job's result stays in the downloads list. */
    fun dismiss() {
        if (isRunning) return
        state = AnalysisState.Idle
        notice = null
    }

    fun cancel() {
        val current = state
        val (jobId, sourceUrl, status) = when (current) {
            is AnalysisState.Polling -> Triple(current.jobId, current.sourceUrl, current.status)
            is AnalysisState.Finishing -> Triple(current.jobId, current.sourceUrl, current.status)
            else -> return
        }
        val base = jobBaseUrl ?: return
        if (cancelling) return
        cancelling = true
        notice = null
        // Polling stops while the request is out, so a late status cannot overwrite the answer.
        loop?.cancel()
        val tracker = trackerFor(base)
        loop = viewModelScope.launch {
            val outcome = try {
                withContext(Dispatchers.IO) { tracker.cancel(jobId, sourceUrl, status) }
            } finally {
                cancelling = false
            }
            when (outcome) {
                is CancelOutcome.Cancelled -> publish(base, outcome.state)
                CancelOutcome.AlreadyFinished -> {
                    notice = "The analysis had already finished."
                    startLoop(base, AnalysisState.Polling(jobId, sourceUrl, status))
                }
                is CancelOutcome.Failed -> {
                    notice = "Could not cancel: ${AnalyzerMessages.describe(outcome.failure)}"
                    startLoop(base, current)
                }
            }
        }
    }

    fun deleteDownload(key: String) {
        store.delete(key)
        refreshDownloads()
    }

    fun refreshDownloads() {
        downloads = store.list()
    }

    private fun resume(job: ActiveJob) {
        if (job.sourceUrl.isNotBlank() && link.isBlank()) link = job.sourceUrl
        startLoop(job.baseUrl, AnalysisState.Polling(job.jobId, job.sourceUrl))
    }

    private fun trackerFor(base: String) = AnalysisTracker(AnalyzerClient(base, transport), store)

    private fun startSubmit(base: String, url: String) {
        loop?.cancel()
        jobBaseUrl = base
        state = AnalysisState.Submitting(url)
        val tracker = trackerFor(base)
        loop = viewModelScope.launch {
            val next = withContext(Dispatchers.IO) { tracker.submit(url) }
            if (!isActive) return@launch
            publish(base, next)
            if (next is AnalysisState.Polling) runLoop(base, tracker, next)
        }
    }

    private fun startLoop(base: String, initial: AnalysisState) {
        loop?.cancel()
        jobBaseUrl = base
        publish(base, initial)
        val tracker = trackerFor(base)
        loop = viewModelScope.launch { runLoop(base, tracker, initial) }
    }

    private suspend fun runLoop(base: String, tracker: AnalysisTracker, initial: AnalysisState) {
        var current = initial
        while (true) {
            val step = withContext(Dispatchers.IO) { tracker.step(current) }
            current = step.state
            publish(base, current)
            val wait = step.delayMs ?: break
            if (wait > 0) delay(wait)
        }
    }

    private fun publish(base: String, next: AnalysisState) {
        state = next
        when (next) {
            is AnalysisState.Polling -> settings.saveActiveJob(ActiveJob(next.jobId, base, next.sourceUrl))
            is AnalysisState.Finishing -> settings.saveActiveJob(ActiveJob(next.jobId, base, next.sourceUrl))
            is AnalysisState.Completed -> {
                settings.clearActiveJob()
                refreshDownloads()
            }
            is AnalysisState.Failed, is AnalysisState.Cancelled -> settings.clearActiveJob()
            else -> Unit
        }
    }

    private companion object {
        const val ANALYSES_DIR = "analyses"
    }
}
