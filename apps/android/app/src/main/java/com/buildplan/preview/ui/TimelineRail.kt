package com.buildplan.preview.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionStageProgress
import com.buildplan.preview.progress.ConstructionTimeline
import com.buildplan.preview.progress.ProgressAvailability
import com.buildplan.preview.progress.ProgressView
import com.buildplan.preview.progress.StageStatus
import com.buildplan.preview.progress.TimelineCursor

/*
 * The construction axis's shared marks (variant C): the hollow preview tag,
 * a stage's state as a small rule segment, and the names of the stops. The
 * axis itself stands in the Etapy panel (`Dock.kt`); until APK 1355 it was a
 * timeline at the foot of the 3D.
 */

/** The hollow tag of the rule, beside the words: the same mark in two places. */
@Composable
fun PreviewMark(modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(width = 11.dp, height = 11.dp)
            .border(1.4.dp, Palette.Rule, RoundedCornerShape(2.dp)),
    )
}

/**
 * A stage's state as a small rule segment: filled (done), part-filled and
 * outlined in yellow (in progress), a grey outline (not started) — the rule's
 * own grammar, so the state reads by shape as well as colour.
 */
@Composable
fun StageMark(status: StageStatus?, completion: Double, modifier: Modifier = Modifier, isTarget: Boolean = false) {
    val shape = RoundedCornerShape(1.5.dp)
    val base = modifier.size(width = 18.dp, height = 8.dp)
    when {
        isTarget -> Box(base.border(1.2.dp, Palette.InkMuted, shape))
        status == StageStatus.DONE -> Box(base.background(Palette.Rule, shape))
        status == StageStatus.IN_PROGRESS -> Box(base.border(1.2.dp, Palette.Rule, shape)) {
            Box(Modifier.size(width = (18 * completion.coerceIn(0.0, 1.0)).dp, height = 8.dp).background(Palette.Rule, shape))
        }
        else -> Box(base.border(1.2.dp, Palette.RuleEmpty, shape))
    }
}

/** The name of every stop: each stage, then the finished design. */
@Composable
fun stopNames(stages: List<ConstructionStageProgress>): List<String> {
    val names = stages.map { stage -> stage.stageKey?.let { stringResource(it.labelRes()) } ?: stage.definitionKey }
    return names + stringResource(R.string.timeline_target)
}

/** The stop of a stage on the rule (the rule's stops follow the timeline's). */
fun stopOf(stage: ConstructionStageKey): Int = ConstructionTimeline.STOPS.indexOf(TimelineCursor.Stage(stage))
