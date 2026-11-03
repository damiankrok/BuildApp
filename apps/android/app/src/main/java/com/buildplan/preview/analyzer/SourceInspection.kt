package com.buildplan.preview.analyzer

import kotlinx.serialization.Serializable

/**
 * SOURCE-01: every picture the page published (`sources`, `packages/analysis-service/src/sources.ts`): what the
 * publisher called it, what its pixels show, what the analyzer did with it and why, and each number read off it —
 * where it is printed, the line it measures, printed or worked out, and what the model made of it.
 *
 * The phone shows what the service said and derives nothing. Absent from a service older than 1.6.0.
 */
@Serializable
data class SourceInspection(
    val classifier: ContentClassifier? = null,
    val sheets: List<SourceSheet> = emptyList(),
    val counts: SourceCounts = SourceCounts(),
)

@Serializable
data class ContentClassifier(val id: String = "", val modelSha256: String = "", val headVersion: String = "")

@Serializable
data class SourceCounts(val sheets: Int = 0, val read: Int = 0, val refusedByContent: Int = 0, val readings: Int = 0, val printedUsed: Int = 0, val derived: Int = 0, val openings: SourceOpenings? = null)

/** SHAPE-LIVE-01: openings reconciled — from the plans (one per opening), elevation readings (several per opening), in the model. */
@Serializable
data class SourceOpenings(val plan: Int = 0, val elevationReadings: Int = 0, val model: Int = 0)

@Serializable
data class SourceSheet(
    val assetId: String = "",
    val url: String = "",
    val width: Int = 0,
    val height: Int = 0,
    val byteHash: String = "",
    val claimed: SourceClaim = SourceClaim(),
    val content: SourceContent? = null,
    val outcome: String = "",
    val reader: String = "",
    val side: String? = null,
    val sideBasis: String? = null,
    val why: String = "",
    val readings: List<SourceReading> = emptyList(),
) {
    companion object {
        const val READ = "READ"
        const val REFUSED_BY_CONTENT = "REFUSED_BY_CONTENT"
        const val NO_READER = "NO_READER"
    }
}

@Serializable
data class SourceClaim(val document: String = "", val storey: String = "", val view: String = "", val annotation: String = "", val projection: String = "", val basis: String = "")

@Serializable
data class SourceContent(val top: String = "", val probability: Double = 0.0, val projection: String = "", val decision: String = "")

@Serializable
data class SourceRect(val x0: Double = 0.0, val y0: Double = 0.0, val x1: Double = 0.0, val y1: Double = 0.0)

@Serializable
data class SourceReading(
    val id: String = "",
    val measure: String = "",
    val rawText: String = "",
    val value: Double = 0.0,
    val unit: String = "",
    val printed: Boolean = false,
    val origin: String = "",
    val box: SourceRect? = null,
    val line: SourceRect? = null,
    val use: String = "",
    val featureId: String? = null,
    /** SHAPE-LIVE-01: the model elements this reading's feature was built into; empty when it went into none. */
    val elementIds: List<String> = emptyList(),
    val why: String = "",
)
