package com.buildplan.preview.progress

/**
 * Where the construction timeline's cursor is. `Now` follows the saved
 * progress; `Stage` and `Target` are previews. None of them is ever saved.
 */
sealed interface TimelineCursor {
    /** The house as the owner says it stands today. */
    data object Now : TimelineCursor

    /** A preview of the house at the end of one stage, in the planned order. */
    data class Stage(val stage: ConstructionStageKey) : TimelineCursor

    /** A preview of the finished design. */
    data object Target : TimelineCursor
}

/**
 * What the 3D shows for a cursor, and how the screen must caption it so a
 * preview is never mistaken for the real state ("Podgląd: Ściany" vs
 * "Aktualnie: Dach").
 */
data class TimelineFrame(
    val cursor: TimelineCursor,
    /** The construction filter for [com.buildplan.preview.scene.ViewerState.withConstruction]; null shows the whole design. */
    val visible: Set<String>?,
    /** True for every cursor but `Now`: the screen must say it is a preview. */
    val isPreview: Boolean,
    /** `Now` with nothing stated yet: the whole design is shown and the screen must say progress is not set. */
    val progressUnset: Boolean,
    /** The stage previewed has no geometry of its own in this model ("Brak osobnej geometrii 3D dla tego etapu"). */
    val stageWithoutGeometry: Boolean,
)

/**
 * The time machine's rules, apart from any screen: given the scene's
 * projection and the saved progress (read only), what does a cursor show.
 *
 * It holds no progress and has no way to write any. Scrubbing moves the
 * cursor and nothing else, and returning to `Now` re-reads the saved state,
 * so a preview can never leak into what was actually built.
 */
class ConstructionTimeline(private val projection: StageProjection) {
    fun frame(cursor: TimelineCursor, progress: ConstructionProgressState?): TimelineFrame = when (cursor) {
        TimelineCursor.Now -> {
            val unset = progress == null || progress.isUnset
            TimelineFrame(
                cursor = cursor,
                visible = if (unset || progress == null) null else projection.visibleIds(ConstructionView.Actual(progress)),
                isPreview = false,
                progressUnset = unset,
                stageWithoutGeometry = false,
            )
        }
        is TimelineCursor.Stage -> TimelineFrame(
            cursor = cursor,
            visible = projection.visibleIds(ConstructionView.AtStage(cursor.stage)),
            isPreview = true,
            progressUnset = progress == null || progress.isUnset,
            stageWithoutGeometry = !projection.hasGeometry(cursor.stage),
        )
        TimelineCursor.Target -> TimelineFrame(
            cursor = cursor,
            visible = null,
            isPreview = true,
            progressUnset = progress == null || progress.isUnset,
            stageWithoutGeometry = false,
        )
    }

    companion object {
        /** The stops of the rail, in order: every starter stage, then the finished design. */
        val STOPS: List<TimelineCursor> = ConstructionStageKey.entries.map { TimelineCursor.Stage(it) } + TimelineCursor.Target

        /**
         * The stop nearest to a position along the rail (0 = first stage,
         * 1 = the finished design): scrubbing snaps to stages, never to a
         * fraction of one.
         */
        fun snap(position: Double): TimelineCursor {
            require(position.isFinite()) { "a rail position is a finite number" }
            val index = Math.round(position.coerceIn(0.0, 1.0) * (STOPS.size - 1)).toInt()
            return STOPS[index]
        }
    }
}
