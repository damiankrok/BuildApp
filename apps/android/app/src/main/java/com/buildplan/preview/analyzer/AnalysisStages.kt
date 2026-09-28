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

    /**
     * The app's own Polish words for the stages it knows. The server's label
     * (English, from the analyzer) is shown only for a stage this build does
     * not know; the server stays the authority on each stage's STATE.
     */
    val DEFAULT_LABELS: Map<String, String> = mapOf(
        "ACQUIRING_SOURCE" to "Pobieram stronę projektu i rysunki",
        "CLASSIFYING_SOURCES" to "Rozpoznaję rzuty, elewacje, przekroje i wizualizacje",
        "EXTRACTING_OBSERVATIONS" to "Czytam rysunki",
        "REGISTERING_VIEWS" to "Zestawiam widoki w jednym układzie",
        "SOLVING_TOPOLOGY" to "Odtwarzam bryłę, dach, schody i pomieszczenia",
        "SOLVING_METRICS" to "Ustalam wymiary otworów, dachu i elewacji",
        "BUILDING_MODEL" to "Buduję i sprawdzam model domu",
        "COMPILING_SCENE" to "Przygotowuję model 3D",
        "VERIFYING" to "Sprawdzam wynik",
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
     * order, in the app's own words, each with the state the server gave it,
     * followed by any stage this build does not know (a newer service), in
     * the server's words and order.
     */
    fun rows(status: JobStatus?): List<StageRow> {
        val records = status?.stages.orEmpty().filter { it.id.isNotBlank() }
        val byId = records.associateBy { it.id }
        val known = AnalysisStages.PIPELINE.map { id ->
            val record = byId[id]
            StageRow(
                id = id,
                label = AnalysisStages.DEFAULT_LABELS.getValue(id),
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
