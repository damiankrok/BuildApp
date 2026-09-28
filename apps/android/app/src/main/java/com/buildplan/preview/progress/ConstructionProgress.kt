package com.buildplan.preview.progress

import com.buildplan.preview.scene.ModelScene

/**
 * The owner's account of how far the build has got: a separate record beside
 * the house, never part of it.
 *
 * Three things are kept apart on purpose:
 *
 * 1. The target design — the scene the analyzer or the reference produced.
 *    Nothing here changes it, and nothing here is derived from it: that a
 *    wall exists in the model does not mean it has been built.
 * 2. The actual progress — this file. It says only what the owner stated,
 *    stage by stage.
 * 3. A preview cursor — which stage a person is looking at in 3D. That is
 *    view state (`StageProjection`), never saved here, so looking at an
 *    earlier stage can never overwrite what was actually built.
 *
 * Money spent, model geometry and analyzer confidence never feed any number
 * in this file.
 */

/**
 * A house's durable identity: the canonical model's own id.
 *
 * The analyzer derives it from the project it read (the publisher's project
 * id, else a hash of the page address) and never from the job, the clock or
 * the content, so analysing the same project again — even with a newer
 * analyzer that changes every hash — keeps it. A scene's content hash, its
 * file name, a download key or a run id would not survive that, and are
 * never used for progress.
 */
@JvmInline
value class HouseId(val value: String) {
    init {
        require(value.isNotBlank()) { "a house id is never blank" }
    }

    override fun toString(): String = value

    companion object {
        /** The scene's canonical model id, or null when the bundle names none (progress is then preview-only). */
        fun of(scene: ModelScene): HouseId? =
            (scene.bundle.generatedFrom.modelId.ifBlank { scene.bundle.scene.modelId }).trim().takeIf { it.isNotEmpty() }?.let(::HouseId)
    }
}

/**
 * The starter sequence of a Polish single-family build (the Master Plan's
 * seventeen stages), in their usual order. The key is stable and English;
 * the Polish name is a UI label. Future stages added or reordered by the
 * owner become [ConstructionStageProgress] entries with their own ids; this
 * enum only seeds the first list.
 */
enum class ConstructionStageKey(val key: String) {
    PLOT_PURCHASE("plot_purchase"),
    DESIGN("design"),
    PERMITS("permits"),
    SITE_PREPARATION("site_preparation"),
    FOUNDATIONS("foundations"),
    WALLS("walls"),
    FLOOR_SLAB("floor_slab"),
    ROOF("roof"),
    JOINERY("joinery"),
    ELECTRICAL("electrical"),
    PLUMBING("plumbing"),
    HEATING("heating"),
    PLASTERING("plastering"),
    SCREED("screed"),
    FACADE("facade"),
    FINISHING("finishing"),
    GARDEN("garden"),
    ;

    companion object {
        private val byKey = entries.associateBy { it.key }

        fun of(key: String): ConstructionStageKey? = byKey[key]
    }
}

enum class StageStatus { NOT_STARTED, IN_PROGRESS, DONE }

/**
 * One stage of one house.
 *
 * Its completion follows its status and nothing else: NOT_STARTED is 0,
 * DONE is 1, IN_PROGRESS is whatever the owner set between them. The weight
 * is how much of the overall figure the stage carries; the starter stages all
 * weigh the same because no validated task or bill-of-quantities weights exist.
 */
data class ConstructionStageProgress(
    val stageId: String,
    /** The starter definition this stage came from ([ConstructionStageKey.key]), or a custom key. */
    val definitionKey: String,
    val order: Int,
    val status: StageStatus,
    val completion: Double,
    val weight: Double = 1.0,
    val note: String? = null,
) {
    init {
        require(stageId.isNotBlank()) { "a stage id is never blank" }
        require(definitionKey.isNotBlank()) { "stage $stageId has no definition key" }
        require(completion.isFinite() && completion in 0.0..1.0) { "stage $stageId: completion $completion is outside 0..1" }
        require(weight.isFinite() && weight > 0.0) { "stage $stageId: weight $weight must be a positive number" }
        when (status) {
            StageStatus.NOT_STARTED -> require(completion == 0.0) { "stage $stageId is not started but has completion $completion" }
            StageStatus.DONE -> require(completion == 1.0) { "stage $stageId is done but has completion $completion" }
            StageStatus.IN_PROGRESS -> Unit
        }
        require(note == null || note.isNotBlank()) { "stage $stageId: a note is either text or absent" }
    }

    val stageKey: ConstructionStageKey? get() = ConstructionStageKey.of(definitionKey)
}

/** Why an edit was refused. The state is never "repaired" around a refusal. */
enum class ProgressRejection {
    UNKNOWN_STAGE,

    /** Only one stage is current at a time: finish or reset it first. */
    ANOTHER_STAGE_IN_PROGRESS,

    /** Completion and the current task belong to the stage in progress. */
    STAGE_NOT_IN_PROGRESS,
    COMPLETION_OUT_OF_RANGE,
    NO_CURRENT_STAGE,
    TEXT_TOO_LONG,
}

sealed interface ProgressEdit {
    data class Applied(val state: ConstructionProgressState) : ProgressEdit

    data class Rejected(val reason: ProgressRejection) : ProgressEdit
}

/**
 * Everything the owner has said about one house's build.
 *
 * Invariants, checked on every construction — a loaded file, an edit, a test
 * fixture alike: at least one stage; stage ids unique; stages listed in
 * strictly increasing order; at most one stage IN_PROGRESS; a current task
 * only while a stage is in progress. The current stage is not a separate
 * field that could disagree with the statuses: it IS the stage in progress.
 *
 * Every edit changes exactly the stage it names. Starting a later stage does
 * not mark earlier ones done, and marking a stage done does not touch any
 * other: construction is not always linear, and history is never rewritten
 * on the owner's behalf.
 */
data class ConstructionProgressState(
    val houseId: HouseId,
    val stages: List<ConstructionStageProgress>,
    val currentTaskLabel: String? = null,
    val updatedAtEpochMs: Long,
    val schemaVersion: Int = SCHEMA_VERSION,
) {
    init {
        require(schemaVersion == SCHEMA_VERSION) { "progress schema $schemaVersion is not $SCHEMA_VERSION" }
        require(stages.isNotEmpty()) { "a progress record has at least one stage" }
        require(stages.map { it.stageId }.toSet().size == stages.size) { "stage ids must be unique" }
        require(stages.zipWithNext().all { (a, b) -> a.order < b.order }) { "stages must be listed in strictly increasing order" }
        require(stages.count { it.status == StageStatus.IN_PROGRESS } <= 1) { "at most one stage is in progress" }
        require(currentTaskLabel == null || (currentTaskLabel.isNotBlank() && currentTaskLabel.length <= MAX_TEXT)) { "the current task is blank or too long" }
        require(currentTaskLabel == null || stages.any { it.status == StageStatus.IN_PROGRESS }) { "a current task needs a stage in progress" }
        require(stages.all { (it.note?.length ?: 0) <= MAX_TEXT }) { "a stage note is too long" }
        require(updatedAtEpochMs >= 0) { "updatedAt is a non-negative epoch time" }
    }

    /** The one stage in progress, if any: the current stage. */
    val currentStage: ConstructionStageProgress? get() = stages.firstOrNull { it.status == StageStatus.IN_PROGRESS }

    val currentStageId: String? get() = currentStage?.stageId

    /** True while the owner has said nothing yet: every stage not started and no task. */
    val isUnset: Boolean get() = stages.all { it.status == StageStatus.NOT_STARTED } && currentTaskLabel == null

    fun stage(stageId: String): ConstructionStageProgress? = stages.firstOrNull { it.stageId == stageId }

    /** Make a stage the current one: NOT_STARTED or DONE -> IN_PROGRESS at the given completion. */
    fun startStage(stageId: String, completion: Double = 0.0, nowMs: Long): ProgressEdit {
        val stage = stage(stageId) ?: return rejected(ProgressRejection.UNKNOWN_STAGE)
        if (!completion.isFinite() || completion !in 0.0..1.0) return rejected(ProgressRejection.COMPLETION_OUT_OF_RANGE)
        val other = currentStage
        if (other != null && other.stageId != stageId) return rejected(ProgressRejection.ANOTHER_STAGE_IN_PROGRESS)
        return replace(stage.copy(status = StageStatus.IN_PROGRESS, completion = completion), nowMs)
    }

    /** Set how far the current stage has got. Reaching 100 % does not finish it: that is an explicit step. */
    fun setCompletion(stageId: String, completion: Double, nowMs: Long): ProgressEdit {
        val stage = stage(stageId) ?: return rejected(ProgressRejection.UNKNOWN_STAGE)
        if (stage.status != StageStatus.IN_PROGRESS) return rejected(ProgressRejection.STAGE_NOT_IN_PROGRESS)
        if (!completion.isFinite() || completion !in 0.0..1.0) return rejected(ProgressRejection.COMPLETION_OUT_OF_RANGE)
        return replace(stage.copy(completion = completion), nowMs)
    }

    /** Mark one stage done. If it was the current stage, its task is finished with it. */
    fun markDone(stageId: String, nowMs: Long): ProgressEdit {
        val stage = stage(stageId) ?: return rejected(ProgressRejection.UNKNOWN_STAGE)
        val wasCurrent = stage.status == StageStatus.IN_PROGRESS
        return replace(stage.copy(status = StageStatus.DONE, completion = 1.0), nowMs, clearTask = wasCurrent)
    }

    /** Put one stage back to not started. */
    fun resetStage(stageId: String, nowMs: Long): ProgressEdit {
        val stage = stage(stageId) ?: return rejected(ProgressRejection.UNKNOWN_STAGE)
        val wasCurrent = stage.status == StageStatus.IN_PROGRESS
        return replace(stage.copy(status = StageStatus.NOT_STARTED, completion = 0.0), nowMs, clearTask = wasCurrent)
    }

    /** What is being done now, within the current stage; blank clears it. */
    fun setCurrentTask(label: String?, nowMs: Long): ProgressEdit {
        val text = label?.trim()?.takeIf { it.isNotEmpty() }
        if (text != null && currentStage == null) return rejected(ProgressRejection.NO_CURRENT_STAGE)
        if (text != null && text.length > MAX_TEXT) return rejected(ProgressRejection.TEXT_TOO_LONG)
        return ProgressEdit.Applied(copy(currentTaskLabel = text, updatedAtEpochMs = nowMs))
    }

    fun setNote(stageId: String, note: String?, nowMs: Long): ProgressEdit {
        val stage = stage(stageId) ?: return rejected(ProgressRejection.UNKNOWN_STAGE)
        val text = note?.trim()?.takeIf { it.isNotEmpty() }
        if (text != null && text.length > MAX_TEXT) return rejected(ProgressRejection.TEXT_TOO_LONG)
        return replace(stage.copy(note = text), nowMs)
    }

    private fun replace(stage: ConstructionStageProgress, nowMs: Long, clearTask: Boolean = false): ProgressEdit =
        ProgressEdit.Applied(
            copy(
                stages = stages.map { if (it.stageId == stage.stageId) stage else it },
                currentTaskLabel = if (clearTask) null else currentTaskLabel,
                updatedAtEpochMs = nowMs,
            ),
        )

    private fun rejected(reason: ProgressRejection) = ProgressEdit.Rejected(reason)

    companion object {
        const val SCHEMA_VERSION = 1

        /** Longest current task or stage note, in characters. */
        const val MAX_TEXT = 200

        /** The starter list for a house: every stage not started, equal weights. */
        fun starter(houseId: HouseId, nowMs: Long): ConstructionProgressState = ConstructionProgressState(
            houseId = houseId,
            stages = ConstructionStageKey.entries.mapIndexed { i, key ->
                ConstructionStageProgress(
                    stageId = "stage-${key.key}",
                    definitionKey = key.key,
                    order = i + 1,
                    status = StageStatus.NOT_STARTED,
                    completion = 0.0,
                )
            },
            updatedAtEpochMs = nowMs,
        )
    }
}
