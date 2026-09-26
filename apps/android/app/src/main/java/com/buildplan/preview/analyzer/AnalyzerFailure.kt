package com.buildplan.preview.analyzer

/**
 * Everything that can stop an analysis from reaching the viewer, as a value.
 *
 * Each case says what happened in terms a person can act on; [describe] turns
 * it into the sentence the Analyzer screen shows. None of them carries a
 * stack, a path or a secret — there is no secret to carry.
 */
sealed interface AnalyzerFailure {
    /** The service could not be reached at all: no connection, no DNS, a timeout, a failed TLS handshake. */
    data class Offline(val detail: String) : AnalyzerFailure

    /** Any HTTP refusal not named below, with the service's own code and sentence when it sent them. */
    data class Http(val status: Int, val code: String?, val message: String?) : AnalyzerFailure

    /** `429 RATE_LIMITED`: this phone submitted (or polled) too often; `Retry-After` in seconds when sent. */
    data class RateLimited(val retryAfterSeconds: Long?) : AnalyzerFailure

    /** `503 QUEUE_FULL`: the service's bounded queue is full; `Retry-After` in seconds when sent. */
    data class QueueFull(val retryAfterSeconds: Long?) : AnalyzerFailure

    /** The link was refused as an address (not https, credentials, a local host, ...). */
    data class InvalidUrl(val message: String) : AnalyzerFailure

    /** No publisher the service registers understands this site. */
    data class UnsupportedPublisher(val message: String) : AnalyzerFailure

    /** The job ran and ended `FAILED`, with the service's code and sentence. */
    data class JobFailed(val code: String, val message: String) : AnalyzerFailure

    /** The downloaded scene is not the one the summary names. `what` says which check failed. */
    data class HashMismatch(val what: String, val expected: String, val actual: String) : AnalyzerFailure

    /** The scene is larger than this app keeps. */
    data class TooLarge(val limitBytes: Long) : AnalyzerFailure

    /** The scene's bytes are the right ones but not a bundle this build can show. */
    data class InvalidScene(val message: String) : AnalyzerFailure

    /** The service answered with something that is not the contract (malformed JSON, a bad job id). */
    data class BadResponse(val message: String) : AnalyzerFailure

    /** The verified scene could not be written to the phone's storage. */
    data class StorageFailed(val message: String) : AnalyzerFailure

    /** This build has no analyzer address, or it is not a usable https address. */
    data object NotConfigured : AnalyzerFailure

    /**
     * The analyzer on this phone could not run or did not finish, for a
     * reason outside the pipeline: the runtime is missing for this device,
     * its process stopped (e.g. ended by Android for memory), the app was
     * closed while it ran, or it spoke a protocol this build does not.
     */
    data class LocalRuntime(val code: String, val message: String) : AnalyzerFailure

    /**
     * Whether trying the same request again later can succeed without anyone
     * changing anything: a lost connection, a busy or restarting service.
     */
    val isTransient: Boolean
        get() = when (this) {
            is Offline, is RateLimited, is QueueFull -> true
            is Http -> status == 408 || status == 502 || status == 503 || status == 504
            else -> false
        }

    /** A suggested wait before trying again, from `Retry-After`, if the service sent one. */
    val retryAfterMs: Long?
        get() = when (this) {
            is RateLimited -> retryAfterSeconds?.times(1000)
            is QueueFull -> retryAfterSeconds?.times(1000)
            else -> null
        }
}

object AnalyzerMessages {
    /** The sentence the Analyzer screen shows for a failure. */
    fun describe(failure: AnalyzerFailure): String = when (failure) {
        is AnalyzerFailure.Offline ->
            "Can't reach the analyzer service: ${failure.detail}. Check the phone's connection and try again."
        is AnalyzerFailure.RateLimited ->
            "The analyzer has had too many requests from this phone recently." +
                (failure.retryAfterSeconds?.let { " Try again in ${waitText(it)}." } ?: " Try again in a few minutes.")
        is AnalyzerFailure.QueueFull ->
            "The analyzer is busy with other projects and its queue is full." +
                (failure.retryAfterSeconds?.let { " Try again in ${waitText(it)}." } ?: " Try again shortly.")
        is AnalyzerFailure.InvalidUrl ->
            "That link can't be analyzed: ${failure.message.trimEnd('.')}. Paste the https address of a project page."
        is AnalyzerFailure.UnsupportedPublisher ->
            "The analyzer doesn't read projects from this site yet. ${failure.message}".trim()
        is AnalyzerFailure.JobFailed ->
            "The analysis stopped (${failure.code}): ${failure.message}"
        is AnalyzerFailure.HashMismatch ->
            "The downloaded model is not the one the analyzer described (${failure.what} differs), so it was not kept."
        is AnalyzerFailure.TooLarge ->
            "The model is larger than this app keeps (${failure.limitBytes / (1024 * 1024)} MB), so it was not downloaded."
        is AnalyzerFailure.InvalidScene ->
            "The analyzer sent a model this version of the app can't open: ${failure.message}"
        is AnalyzerFailure.BadResponse ->
            "The analyzer answered with something this app can't read (${failure.message})."
        is AnalyzerFailure.StorageFailed ->
            "The model was verified but could not be saved on this phone: ${failure.message}"
        is AnalyzerFailure.NotConfigured ->
            "No analyzer service is configured in this build."
        is AnalyzerFailure.LocalRuntime ->
            "The analysis on this phone stopped (${failure.code}): ${failure.message}"
        is AnalyzerFailure.Http -> when {
            failure.status == 404 -> "The analyzer no longer has this analysis (it may have expired). Analyze the link again."
            failure.message != null -> "The analyzer refused the request (${failure.code ?: failure.status}): ${failure.message}"
            else -> "The analyzer answered with an error (HTTP ${failure.status})."
        }
    }

    private fun waitText(seconds: Long): String = when {
        seconds < 90 -> "$seconds seconds"
        else -> "${(seconds + 59) / 60} minutes"
    }
}
