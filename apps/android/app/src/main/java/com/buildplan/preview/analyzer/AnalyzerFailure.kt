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

    /**
     * The job ran and ended `FAILED`, with the analyzer's code and sentence, and
     * (BUILDAPP-03Y2G) its reason code, stage and counts when it sent them.
     * `diagnosticsBundle` is the folder this phone kept the run's diagnostics
     * in, for sharing, when there is one.
     */
    data class JobFailed(val code: String, val message: String, val details: FailureDetails? = null, val diagnosticsBundle: String? = null) : AnalyzerFailure {
        /** The most specific code there is: the solver's reason, else the analyzer's family. */
        val diagnosticCode: String get() = details?.reasonCode ?: code
    }

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
    /** The sentence the analyzer page shows for a failure: what happened, and what to do. */
    fun describe(failure: AnalyzerFailure): String = when (failure) {
        is AnalyzerFailure.Offline ->
            "Nie mogę połączyć się z usługą analizy. Sprawdź połączenie telefonu i spróbuj ponownie."
        is AnalyzerFailure.RateLimited ->
            "Usługa analizy dostała ostatnio zbyt wiele zapytań z tego telefonu." +
                (failure.retryAfterSeconds?.let { " Spróbuj ponownie za ${waitText(it)}." } ?: " Spróbuj ponownie za kilka minut.")
        is AnalyzerFailure.QueueFull ->
            "Usługa analizy jest zajęta innymi projektami, a jej kolejka jest pełna." +
                (failure.retryAfterSeconds?.let { " Spróbuj ponownie za ${waitText(it)}." } ?: " Spróbuj ponownie za chwilę.")
        is AnalyzerFailure.InvalidUrl ->
            "Tego linku nie da się przeanalizować: ${failure.message.trimEnd('.')}. Wklej adres https strony projektu."
        is AnalyzerFailure.UnsupportedPublisher ->
            "Analiza nie czyta jeszcze projektów z tej strony. Obsługiwane są strony projektów ARCHON."
        is AnalyzerFailure.JobFailed ->
            "Analiza zatrzymała się (${failure.diagnosticCode}): z rysunków tego projektu nie udało się zbudować modelu. Szczegóły są poniżej."
        is AnalyzerFailure.HashMismatch ->
            "Pobrany model nie jest tym, który opisała analiza (różni się: ${failure.what}), więc go nie zapisano."
        is AnalyzerFailure.TooLarge ->
            "Model jest większy, niż ta aplikacja przechowuje (${failure.limitBytes / (1024 * 1024)} MB), więc go nie pobrano."
        is AnalyzerFailure.InvalidScene ->
            "Analiza przysłała model, którego ta wersja aplikacji nie otworzy. Zaktualizuj aplikację."
        is AnalyzerFailure.BadResponse ->
            "Usługa analizy odpowiedziała czymś, czego ta aplikacja nie potrafi odczytać."
        is AnalyzerFailure.StorageFailed ->
            "Model sprawdzono, ale nie udało się go zapisać na tym telefonie. Zwolnij miejsce i pobierz go ponownie."
        is AnalyzerFailure.NotConfigured ->
            "Ta wersja aplikacji nie ma skonfigurowanej usługi analizy."
        is AnalyzerFailure.LocalRuntime ->
            "Analiza na tym telefonie zatrzymała się (${failure.code}). Nic z niej nie zapisano; możesz przeanalizować link ponownie."
        is AnalyzerFailure.Http -> when (failure.status) {
            404, 410 -> "Usługa nie ma już tej analizy (mogła wygasnąć). Przeanalizuj link ponownie."
            else -> "Usługa analizy odmówiła (${failure.code ?: "HTTP ${failure.status}"}). Spróbuj ponownie później."
        }
    }

    /** A short Polish heading for a failure. */
    fun title(failure: AnalyzerFailure): String = when (failure) {
        is AnalyzerFailure.Offline, is AnalyzerFailure.RateLimited, is AnalyzerFailure.QueueFull, is AnalyzerFailure.Http -> "Usługa analizy jest teraz niedostępna"
        is AnalyzerFailure.InvalidUrl, is AnalyzerFailure.UnsupportedPublisher -> "Tego linku nie da się przeanalizować"
        is AnalyzerFailure.JobFailed, is AnalyzerFailure.LocalRuntime -> "Nie udało się zbudować modelu"
        is AnalyzerFailure.HashMismatch, is AnalyzerFailure.TooLarge, is AnalyzerFailure.InvalidScene,
        is AnalyzerFailure.BadResponse, is AnalyzerFailure.StorageFailed -> "Modelu nie zapisano"
        is AnalyzerFailure.NotConfigured -> "Brak usługi analizy"
    }

    /** "45 s", "2 min": Polish, and never a plural form that needs declension. */
    private fun waitText(seconds: Long): String = when {
        seconds < 90 -> "$seconds s"
        else -> "${(seconds + 59) / 60} min"
    }
}
