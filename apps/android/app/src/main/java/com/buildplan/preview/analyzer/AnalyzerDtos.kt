package com.buildplan.preview.analyzer

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The analyzer HTTP API (`buildapp.analyzer-api` v1, `docs/ANALYZER_API.md`)
 * as this app reads it.
 *
 * These are transport classes and nothing more. The phone never runs the
 * analyzer and never re-derives anything the service reports: it shows what
 * the service said, and checks the scene it downloads against the hashes the
 * service published. Every field has a default so that a member the service
 * adds later, or leaves out, never turns a readable answer into a crash.
 */
internal val AnalyzerJson = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
}

/** `{"error": {"code": "<CODE>", "message": "<sentence for a person>"}}`. */
@Serializable
data class ErrorEnvelope(val error: ApiError? = null)

@Serializable
data class ApiError(
    val code: String = "",
    val message: String = "",
    /** BUILDAPP-03Y2G: the solver's own reason, where it knew one; absent from an older service. */
    val reasonCode: String? = null,
    val stage: String? = null,
    val substage: String? = null,
    val title: String? = null,
    val diagnostics: Map<String, kotlinx.serialization.json.JsonElement> = emptyMap(),
) {
    /** The structured part, when there is any. */
    val details: FailureDetails?
        get() = if (reasonCode == null && stage == null && title == null && diagnostics.isEmpty()) null else FailureDetails(reasonCode, stage, substage, title, diagnostics)
}

/** `202 Accepted` from `POST /v1/analyses`. */
@Serializable
data class SubmitResponse(
    val jobId: String = "",
    val status: String = "",
    val links: Map<String, String> = emptyMap(),
)

/** `202` from `DELETE /v1/analyses/:jobId`. */
@Serializable
data class CancelResponse(val jobId: String = "", val status: String = "")

/** The stage a running job is in: `null` while queued and after a terminal status. */
@Serializable
data class CurrentStage(
    val id: String = "",
    val label: String = "",
    val index: Int = 0,
    val count: Int = 0,
    val fraction: Double = 0.0,
    val detail: String? = null,
)

/**
 * What the analyzer is doing inside its stage, by counts (005A): the phase,
 * the unit of work and how many of them, and a heartbeat sequence that moves
 * whenever the analyzer crosses a loop boundary. From the embedded program's
 * `telemetry` events, or from a service job record's `activity`.
 */
@Serializable
data class JobActivity(
    val phaseId: String = "",
    val phaseLabel: String = "",
    val subphaseId: String? = null,
    val subphaseLabel: String? = null,
    /** `COMPUTE` while a loop is working, `IO_WAIT` while the run waits on the network or the disk. */
    val activity: String = "COMPUTE",
    val workDone: Long = 0,
    val workTotal: Long? = null,
    val unit: String = "",
    val assetIndex: Int? = null,
    val assetTotal: Int? = null,
    val candidateIndex: Int? = null,
    val candidateTotal: Int? = null,
    val heartbeatSeq: Long = 0,
    val elapsedMs: Long = 0,
    val phaseElapsedMs: Long = 0,
    val diagnosticCounters: Map<String, Long> = emptyMap(),
    /** Service only: how long ago, by the server's clock, the last heartbeat arrived. */
    val heartbeatAgeMs: Long? = null,
) {
    /** What changes only when the work does: a new phase, step or count. A heartbeat alone does not change it. */
    val signature: String get() = "$phaseId|$subphaseId|$workDone|$workTotal|$assetIndex|$candidateIndex|${diagnosticCounters.toSortedMap()}"
}

/** One row of `stages[]`: all nine stages, in pipeline order, with their state. */
@Serializable
data class StageRecord(
    val id: String = "",
    val label: String = "",
    val state: String = "",
    val startedAt: String? = null,
    val completedAt: String? = null,
)

@Serializable
data class QualityLevels(
    @SerialName("L0") val l0: Int = 0,
    @SerialName("L1") val l1: Int = 0,
    @SerialName("L2") val l2: Int = 0,
)

/** The short summary a COMPLETED status record carries in `result`. */
@Serializable
data class ShortResult(
    val title: String = "",
    val label: String = "",
    val candidateHash: String = "",
    val modelHash: String = "",
    val sceneSha256: String = "",
    val sceneContentHash: String = "",
    val sceneBytes: Long = 0,
    val quality: QualityLevels = QualityLevels(),
    val unresolved: Int = 0,
    val warnings: Int = 0,
    val vision: String = "",
)

/** `GET /v1/analyses/:jobId`: the record a client polls. */
@Serializable
data class JobStatus(
    val jobId: String = "",
    val status: String = "",
    /** 0..1, the position in the pipeline. Moves only when the pipeline moves. */
    val progress: Double = 0.0,
    val stage: CurrentStage? = null,
    val stages: List<StageRecord> = emptyList(),
    val sourceUrl: String = "",
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val startedAt: String? = null,
    val completedAt: String? = null,
    val error: ApiError? = null,
    val result: ShortResult? = null,
    val links: Map<String, String> = emptyMap(),
    /** What the analyzer is doing inside the stage (005A); absent from an older service. */
    val activity: JobActivity? = null,
) {
    val isTerminal: Boolean get() = status in AnalysisStages.TERMINAL
}

@Serializable
data class AdapterInfo(val id: String = "", val version: String = "")

@Serializable
data class AnalysisCounts(
    val assets: Int = 0,
    val assetsByDocument: Map<String, Int> = emptyMap(),
    val observations: Int = 0,
    val frames: Int = 0,
    val metricEvidence: Int = 0,
    val callouts: Int = 0,
    val commands: Int = 0,
    val masses: Int = 0,
    val openings: Int = 0,
    val rooms: Int = 0,
    val balconies: Int = 0,
    val terraces: Int = 0,
    val railings: Int = 0,
    val chimneys: Int = 0,
    val rooflights: Int = 0,
    val meshes: Int = 0,
    val triangles: Int = 0,
)

@Serializable
data class AnalysisQuality(
    /** Solved features by the level they earned: L0 topology only, L1 metric, L2 metric and corroborated. */
    val levels: QualityLevels = QualityLevels(),
    val byFamily: Map<String, Map<String, Int>> = emptyMap(),
)

/** Something the analyzer could not settle, named. */
@Serializable
data class UnresolvedItem(val what: String = "", val reason: String = "", val status: String = "")

@Serializable
data class VisionInfo(
    /** `DETERMINISTIC_ONLY`, `LIVE_PROVIDER` or `REPLAYED_GRAPH`. */
    val mode: String = "",
    val provider: String? = null,
    val attempted: Int = 0,
    val accepted: Int = 0,
)

@Serializable
data class ClosureCounts(val exteriorErrors: Int = 0, val exteriorFindings: Int = 0, val interiorFindings: Int = 0)

@Serializable
data class VerificationInfo(
    val replay: String = "",
    val residuals: Int = 0,
    val residualsOutsideTolerance: Int = 0,
    val closure: ClosureCounts = ClosureCounts(),
)

@Serializable
data class AnalyzerVersions(val service: String = "", val solver: String = "")

/**
 * `GET /v1/analyses/:jobId/result`: the full `LinkAnalysisSummary`
 * (`packages/analysis-service/src/result.ts`) without the candidate, model or
 * scene, which are downloaded separately and checked against these hashes.
 */
@Serializable
data class AnalysisSummary(
    val schema: String = "",
    val schemaVersion: String = "",
    val jobId: String? = null,
    val sourceUrl: String = "",
    val canonicalUrl: String = "",
    val title: String = "",
    val label: String = "",
    val modelId: String = "",
    val publisher: String = "",
    val adapter: AdapterInfo = AdapterInfo(),
    val sourcePackageId: String = "",
    val sourcePackageHash: String = "",
    val observationGraphHash: String = "",
    val metricEvidenceHash: String = "",
    val candidateHash: String = "",
    val modelHash: String = "",
    val modelSha256: String = "",
    val sceneContentHash: String = "",
    val sceneSha256: String = "",
    val sceneBytes: Long = 0,
    val counts: AnalysisCounts = AnalysisCounts(),
    val quality: AnalysisQuality = AnalysisQuality(),
    val unresolved: List<UnresolvedItem> = emptyList(),
    val warnings: List<String> = emptyList(),
    /** 005A: each warning with its severity; absent from an older analyzer. */
    val warningDetails: List<AnalysisWarning> = emptyList(),
    val vision: VisionInfo = VisionInfo(),
    val verification: VerificationInfo = VerificationInfo(),
    val analyzer: AnalyzerVersions = AnalyzerVersions(),
    val startedAt: String = "",
    val completedAt: String = "",
    val links: Map<String, String> = emptyMap(),
) {
    /**
     * The warnings that limit the result. "No vision provider ran" or "a guessed
     * larger copy does not exist" say how the run worked, not what the house
     * lacks. An older analyzer sent no severities, so every warning of it counts.
     */
    val limitingWarnings: List<String>
        get() = if (warningDetails.isEmpty()) warnings else warningDetails.filter { it.severity != AnalysisWarning.INFO }.map { it.message }

    companion object {
        const val SCHEMA = "buildapp.link-analysis-result"
    }
}

/** One warning of a finished run (005A): a code, `INFO` or `LIMITING`, and its sentence. */
@Serializable
data class AnalysisWarning(val code: String = "", val severity: String = "", val message: String = "") {
    companion object {
        const val INFO = "INFO"
    }
}
