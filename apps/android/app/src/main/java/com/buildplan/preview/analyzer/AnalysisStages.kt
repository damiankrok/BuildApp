package com.buildplan.preview.analyzer

/**
 * The nine pipeline stages and the checklist the Analyzer screen draws.
 *
 * The service is the authority on labels and states: the checklist shows the
 * `stages[]` the server sent, in its words. The copies below only fill a row
 * the server has not described (before the first answer, or an abbreviated
 * record), so the checklist always has nine rows in pipeline order.
 */
object AnalysisStages {
    const val QUEUED = "QUEUED"
    const val COMPLETED = "COMPLETED"
    const val FAILED = "FAILED"
    const val CANCELLED = "CANCELLED"

    val TERMINAL: Set<String> = setOf(COMPLETED, FAILED, CANCELLED)

    /** Pipeline order, as `packages/analysis-service/src/stages.ts` names it. */
    val PIPELINE: List<String> = listOf(
        "ACQUIRING_SOURCE",
        "CLASSIFYING_SOURCES",
        "EXTRACTING_OBSERVATIONS",
        "REGISTERING_VIEWS",
        "SOLVING_TOPOLOGY",
        "SOLVING_METRICS",
        "BUILDING_MODEL",
        "COMPILING_SCENE",
        "VERIFYING",
    )

    /** Fallback wording for a stage the server has not labelled yet. */
    val DEFAULT_LABELS: Map<String, String> = mapOf(
        "ACQUIRING_SOURCE" to "Fetching the project page and its drawings",
        "CLASSIFYING_SOURCES" to "Sorting plans, elevations, sections and renders",
        "EXTRACTING_OBSERVATIONS" to "Reading the drawings",
        "REGISTERING_VIEWS" to "Registering the views to one frame",
        "SOLVING_TOPOLOGY" to "Solving bodies, roof, recesses, stair and rooms",
        "SOLVING_METRICS" to "Sizing openings, roof details and facade assemblies",
        "BUILDING_MODEL" to "Building and verifying the model",
        "COMPILING_SCENE" to "Compiling the 3D scene",
        "VERIFYING" to "Checking replay, hashes and joints",
    )

    fun isTerminal(status: String): Boolean = status in TERMINAL
}

enum class StageState {
    PENDING, RUNNING, DONE, FAILED, CANCELLED;

    companion object {
        /** An unknown state reads as pending: nothing is claimed that the server did not say. */
        fun of(raw: String?): StageState = entries.firstOrNull { it.name == raw } ?: PENDING
    }
}

data class StageRow(val id: String, val label: String, val state: StageState)

object StageChecklist {
    /**
     * The checklist for one status record: the nine known stages in pipeline
     * order, each with the server's label and state when the server described
     * it, followed by any stage this build does not know (a newer service), in
     * the order the server listed them.
     */
    fun rows(status: JobStatus?): List<StageRow> {
        val records = status?.stages.orEmpty().filter { it.id.isNotBlank() }
        val byId = records.associateBy { it.id }
        val known = AnalysisStages.PIPELINE.map { id ->
            val record = byId[id]
            StageRow(
                id = id,
                label = record?.label?.takeIf { it.isNotBlank() } ?: AnalysisStages.DEFAULT_LABELS.getValue(id),
                state = StageState.of(record?.state),
            )
        }
        val extra = records
            .filter { it.id !in AnalysisStages.DEFAULT_LABELS }
            .distinctBy { it.id }
            .map { StageRow(it.id, it.label.ifBlank { it.id }, StageState.of(it.state)) }
        return known + extra
    }
}
