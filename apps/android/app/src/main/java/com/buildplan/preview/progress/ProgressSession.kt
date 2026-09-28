package com.buildplan.preview.progress

import com.buildplan.preview.scene.ModelScene

/**
 * One open house's construction progress, as the screens use it: the saved
 * record, the timeline cursor, and the frame the 3D shows — apart from any
 * Android type, so every rule the owner relies on is an ordinary unit test.
 *
 * The three concepts of the product stay three:
 *
 * - the target design is the [scene], only read;
 * - the actual progress is [state], changed only by the edit methods here and
 *   saved by the [store] before it is shown — a failed save leaves the
 *   previous record on screen and on disk, and says so;
 * - the preview is [cursor]: view state, never saved, and [frame] is computed
 *   from it and the saved record, so moving the cursor can never write
 *   anything and [returnToNow] re-reads nothing but what was saved.
 *
 * A house whose bundle names no model id has no durable identity: its
 * progress is [ProgressAvailability.PREVIEW_ONLY] and nothing is edited.
 */
class ProgressSession(
    val scene: ModelScene,
    private val store: ProgressStore?,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    val houseId: HouseId? = HouseId.of(scene)
    val projection: StageProjection = StageProjection(scene)
    private val timeline = ConstructionTimeline(projection)

    /** The saved record, or null while nothing was ever saved for this house (progress unset). */
    var state: ConstructionProgressState? = null
        private set

    var availability: ProgressAvailability = ProgressAvailability.PREVIEW_ONLY
        private set

    /** What the last load or save found, for the screen to say; null when all is well. */
    var problem: ProgressProblem? = null
        private set

    var cursor: TimelineCursor = TimelineCursor.Now
        private set

    init {
        reload()
    }

    /** Read this house's record from the store again (an app restart does exactly this). */
    fun reload() {
        val id = houseId
        if (id == null || store == null) {
            state = null
            availability = ProgressAvailability.PREVIEW_ONLY
            problem = null
            return
        }
        when (val load = store.load(id)) {
            ProgressLoad.Missing -> {
                state = null
                availability = ProgressAvailability.EDITABLE
                problem = null
            }
            is ProgressLoad.Loaded -> {
                state = load.state
                availability = ProgressAvailability.EDITABLE
                problem = null
            }
            is ProgressLoad.Corrupt -> {
                // Moved aside by the store, never deleted: the owner starts again and is told so.
                state = null
                availability = ProgressAvailability.EDITABLE
                problem = ProgressProblem.RecoveredFromCorruption(load.keptAs?.name)
            }
            is ProgressLoad.Unsupported -> {
                state = null
                availability = ProgressAvailability.READ_ONLY_NEWER_SCHEMA
                problem = ProgressProblem.NewerSchema(load.schemaVersion)
            }
        }
    }

    // -----------------------------------------------------------------------
    // What every screen reads
    // -----------------------------------------------------------------------

    /** The stages as the rule and Etapy list them: the saved record's, or the starter list while unset. */
    val stages: List<ConstructionStageProgress>
        get() = state?.stages ?: STARTER_VIEW

    val summary: ProgressSummary
        get() {
            val s = state
            val unset = s == null || s.isUnset
            val current = s?.currentStage
            return ProgressSummary(
                unset = unset,
                percent = if (unset || s == null) null else StageProgressMetric.percent(s),
                currentStage = current?.stageKey,
                currentStageCompletionPercent = current?.let { StageProgressMetric.percentOf(it.completion) },
                currentTask = s?.currentTaskLabel,
                doneCount = s?.stages?.count { it.status == StageStatus.DONE } ?: 0,
                stageCount = stages.size,
                lastDone = s?.stages?.lastOrNull { it.status == StageStatus.DONE }?.stageKey,
                availability = availability,
            )
        }

    /** What the 3D shows for the cursor, and how it must be captioned. */
    val frame: TimelineFrame get() = timeline.frame(cursor, state)

    /** The objects standing today by the owner's account, or null (the whole design) while progress is unset. */
    val actualVisible: Set<String>? get() = timeline.frame(TimelineCursor.Now, state).visible

    /** The object ids that first stand at a stage: the part of the house a stage adds. */
    fun introducedAt(stage: ConstructionStageKey): Set<String> = projection.introducedAt(stage)

    /** The starter stage a scene object first stands at, or null when no rule places it. */
    fun stageOf(objectId: String): ConstructionStageKey? {
        val group = projection.groups[objectId] ?: return null
        return StageSemanticRules.introducedAt[group]
    }

    // -----------------------------------------------------------------------
    // The cursor: looking, never editing
    // -----------------------------------------------------------------------

    fun preview(cursor: TimelineCursor) {
        this.cursor = cursor
    }

    fun returnToNow() {
        cursor = TimelineCursor.Now
    }

    /** The rail's stops with the cursor's index among them; `Now` sits on no stop. */
    fun stopIndexOf(cursor: TimelineCursor): Int? = ConstructionTimeline.STOPS.indexOf(cursor).takeIf { it >= 0 }

    /** Everything a screen reads, as one immutable snapshot. */
    fun view(): ProgressView {
        val stages = stages
        val frame = frame
        return ProgressView(
            stages = stages,
            summary = summary,
            cursor = cursor,
            frame = frame,
            previewStop = if (frame.isPreview) stopIndexOf(cursor) else null,
            nowStop = nowStopOf(stages),
            problem = problem,
        )
    }

    // -----------------------------------------------------------------------
    // Edits: the only way the saved record changes
    // -----------------------------------------------------------------------

    fun startStage(stageId: String, completion: Double = 0.0): EditOutcome = edit { it.startStage(stageId, completion, clock()) }

    fun setCompletion(stageId: String, completion: Double): EditOutcome = edit { it.setCompletion(stageId, completion, clock()) }

    fun markDone(stageId: String): EditOutcome = edit { it.markDone(stageId, clock()) }

    fun resetStage(stageId: String): EditOutcome = edit { it.resetStage(stageId, clock()) }

    fun setCurrentTask(label: String?): EditOutcome = edit { it.setCurrentTask(label, clock()) }

    /**
     * Apply one edit to the saved record (or to the starter list, the first
     * time) and save it. The record on screen changes only after the store
     * has it; a refusal or a failed save changes nothing.
     */
    private fun edit(change: (ConstructionProgressState) -> ProgressEdit): EditOutcome {
        val id = houseId
        if (id == null || store == null || availability != ProgressAvailability.EDITABLE) return EditOutcome.NotEditable
        val base = state ?: ConstructionProgressState.starter(id, clock())
        return when (val result = change(base)) {
            is ProgressEdit.Rejected -> EditOutcome.Refused(result.reason)
            is ProgressEdit.Applied -> when (val saved = store.save(result.state)) {
                ProgressSave.Saved -> {
                    state = result.state
                    problem = null
                    EditOutcome.Saved
                }
                is ProgressSave.Failed -> {
                    problem = ProgressProblem.SaveFailed(saved.reason)
                    EditOutcome.SaveFailed(saved.reason)
                }
            }
        }
    }

    private companion object {
        /** What the rule shows before anything is saved: the starter stages, none started. */
        val STARTER_VIEW: List<ConstructionStageProgress> =
            ConstructionProgressState.starter(HouseId("starter-view"), 0L).stages
    }
}

enum class ProgressAvailability {
    /** A durable house id and a store: the owner can record progress. */
    EDITABLE,

    /** No durable identity for this model: progress cannot be kept, so it is not offered. */
    PREVIEW_ONLY,

    /** A newer app wrote this house's record: shown as unset here, never overwritten. */
    READ_ONLY_NEWER_SCHEMA,
}

sealed interface ProgressProblem {
    data class RecoveredFromCorruption(val keptAs: String?) : ProgressProblem
    data class NewerSchema(val schemaVersion: Int) : ProgressProblem
    data class SaveFailed(val reason: String) : ProgressProblem
}

sealed interface EditOutcome {
    data object Saved : EditOutcome
    data class Refused(val reason: ProgressRejection) : EditOutcome
    data class SaveFailed(val reason: String) : EditOutcome
    data object NotEditable : EditOutcome
}

/**
 * The one reading of the progress every screen shows — Dom, 3D and Etapy take
 * their numbers and words from here and nowhere else.
 */
data class ProgressSummary(
    val unset: Boolean,
    /** "Postęp wg etapów", whole percent rounded down; null while unset. */
    val percent: Int?,
    val currentStage: ConstructionStageKey?,
    val currentStageCompletionPercent: Int?,
    val currentTask: String?,
    val doneCount: Int,
    val stageCount: Int,
    /** The last stage in order marked done, for "Ostatnio zakończony". */
    val lastDone: ConstructionStageKey?,
    val availability: ProgressAvailability,
) {
    val percentText: String? get() = percent?.let(StageProgressMetric::format)
}

/**
 * One reading of a house's progress and of the cursor, for the screens: they
 * draw this and call the session's methods; they never hold a mutable record.
 */
data class ProgressView(
    val stages: List<ConstructionStageProgress>,
    val summary: ProgressSummary,
    val cursor: TimelineCursor,
    val frame: TimelineFrame,
    /** The rule's stop the 3D previews; null while it shows now. */
    val previewStop: Int?,
    /** The stop NOW stands on: the stage in progress, else the last stage done; null while unset. */
    val nowStop: Int?,
    val problem: ProgressProblem?,
) {
    val stopCount: Int get() = stages.size + 1
}

/** The stop NOW stands on: the stage in progress, else the last stage done; null while nothing is started. */
fun nowStopOf(stages: List<ConstructionStageProgress>): Int? {
    val inProgress = stages.indexOfFirst { it.status == StageStatus.IN_PROGRESS }
    if (inProgress >= 0) return inProgress
    return stages.indexOfLast { it.status == StageStatus.DONE }.takeIf { it >= 0 }
}
