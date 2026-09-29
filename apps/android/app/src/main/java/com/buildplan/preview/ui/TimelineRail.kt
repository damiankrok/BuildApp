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

/**
 * The construction timeline at the foot of the 3D: the folding rule under the
 * house, and one line that says what the 3D is showing.
 *
 * Collapsed, it is a header and the rule. The header says NOW in the owner's
 * words ("43% · Dach", "Teraz: montaż więźby") or, while the cursor is
 * elsewhere, says so first ("Podgląd: Ściany") with "Wróć do teraz" beside
 * it — the actual state is repeated at the top of the screen, never replaced.
 * Expanded, the stages are named in a strip under the rule, each with its
 * state in words and a mark that is not only a colour. Scrubbing only moves
 * the cursor; the saved progress is edited in Etapy and nowhere else.
 */
@Composable
fun TimelineRail(
    view: ProgressView,
    expanded: Boolean,
    onToggle: () -> Unit,
    onPreviewStop: (Int) -> Unit,
    onReturnToNow: () -> Unit,
    onSetProgress: () -> Unit,
    /** Opens the stage sheet from the header that shows the recorded state: the record is read here and edited there. */
    onEditProgress: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    /** Measures the header and the rule only: a row set above them never moves the camera's frame. */
    ruleModifier: Modifier = Modifier,
    /** A row inside the same glass, above the header (the chosen element): one panel, never two stacked. */
    top: (@Composable () -> Unit)? = null,
) {
    val motion = LocalMotionPolicy.current
    val stages = view.stages
    val summary = view.summary
    val frame = view.frame
    val previewStop = view.previewStop
    val nowStop = view.nowStop
    val stopNames = stopNames(stages)
    val chevron by animateFloatAsState(if (expanded) 180f else 0f, motion.settle(), label = "railChevron")

    GlassSurface(modifier = modifier, shape = RoundedCornerShape(Radius.sheet)) {
        Column(Modifier.padding(bottom = Space.s)) {
            AnimatedVisibility(visible = top != null, enter = motion.unfoldEnter(), exit = motion.unfoldExit()) {
                Column {
                    top?.invoke()
                    PanelRule()
                }
            }
            Column(ruleModifier) {
                // Header: what the 3D shows, full width, and under it the one action that matters here —
                // never beside the title, where a longer stage name or a larger font would cut it.
                Row(
                    verticalAlignment = Alignment.Top,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .padding(start = Space.l, end = Space.xs, top = Space.xs),
                ) {
                    AnimatedContent(
                        targetState = previewStop,
                        transitionSpec = { fadeIn(motion.enterDelayed()) togetherWith fadeOut(motion.exit()) },
                        label = "railHeader",
                        // No live region: the rule speaks its own new state as it moves, once.
                        modifier = Modifier.weight(1f).padding(top = Space.xs),
                    ) { stop ->
                        if (stop != null) {
                            PreviewHeader(stop, stopNames, frame.stageWithoutGeometry, stages.size, onReturnToNow)
                        } else {
                            NowHeader(
                                summary.unset, summary.percentText, summary.currentStage, summary.lastDone, summary.currentTask, summary.currentStageCompletionPercent,
                                problem = progressProblemText(view.problem),
                                onSetProgress = onSetProgress.takeIf { summary.unset && summary.availability == ProgressAvailability.EDITABLE },
                                onEdit = onEditProgress.takeIf { !summary.unset },
                            )
                        }
                    }
                    val toggle = stringResource(if (expanded) R.string.timeline_collapse else R.string.timeline_expand)
                    IconButton(onClick = onToggle, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = toggle }) {
                        Icon(ShellIcons.chevronUp, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.icon).rotate(chevron))
                    }
                }

                FoldingRule(
                    stages = stages,
                    nowStop = nowStop,
                    previewStop = previewStop,
                    onScrub = onPreviewStop,
                    onReturnToNow = if (previewStop != null) onReturnToNow else null,
                    returnToNowLabel = stringResource(R.string.timeline_return_now),
                    description = stringResource(R.string.timeline_rule_description),
                    stateText = previewStop?.let { stringResource(R.string.timeline_preview_of, stopNames[it]) }
                        ?: nowStateText(summary.unset, summary.percentText, summary.currentStage),
                    stopName = { stopNames[it] },
                    // A gap under the header's action, so a low tap on "Wróć do teraz" never scrubs.
                    modifier = Modifier.padding(horizontal = Space.l).padding(top = Space.s),
                )
            }

            AnimatedVisibility(visible = expanded, enter = motion.unfoldEnter(), exit = motion.unfoldExit()) {
                StageStrip(stages, nowStop, previewStop, stopNames, onPreviewStop)
            }
        }
    }
}

@Composable
private fun NowHeader(
    unset: Boolean,
    percent: String?,
    current: ConstructionStageKey?,
    lastDone: ConstructionStageKey?,
    task: String?,
    stagePercent: Int?,
    problem: String?,
    onSetProgress: (() -> Unit)?,
    /** The recorded state is the way to the stage sheet: the whole header is the handle, with a chevron. */
    onEdit: (() -> Unit)? = null,
) {
    val editLabel = stringResource(R.string.timeline_edit_progress)
    Column(
        verticalArrangement = Arrangement.spacedBy(1.dp),
        modifier = if (onEdit != null) {
            Modifier
                .fillMaxWidth()
                .heightIn(min = Sizes.touch)
                .clickable(role = Role.Button, onClickLabel = editLabel, onClick = onEdit)
        } else {
            Modifier
        },
    ) {
        // Why the record is not what the owner left, when it is not (cycle 3, C3-04); the full sentence is in Etapy.
        problem?.let { ProblemLine(it, style = MaterialTheme.typography.bodySmall, maxLines = 3) }
        if (unset || percent == null) {
            Text(stringResource(R.string.progress_unset), style = MaterialTheme.typography.titleSmall, color = Palette.Ink)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                Text(stringResource(R.string.timeline_hint_scrub), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, modifier = Modifier.weight(1f))
                if (onSetProgress != null) {
                    LineButton(stringResource(R.string.progress_set_action), onClick = onSetProgress, borderColor = Palette.Ink)
                }
            }
        } else {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                Text(percent, style = Measure.inline, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val stageName = (current ?: lastDone)?.let { stringResource(it.labelRes()) } ?: ""
                Text(stageName, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (onEdit != null) {
                    Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall).padding(bottom = 2.dp))
                }
            }
            val second = when {
                task != null -> stringResource(R.string.progress_now_task, task)
                current != null && stagePercent != null -> stringResource(R.string.progress_stage_in_progress, stagePercent)
                lastDone != null -> stringResource(R.string.progress_last_done, stringResource(lastDone.labelRes()))
                else -> null
            }
            second?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis) }
        }
    }
}

@Composable
private fun PreviewHeader(stop: Int, names: List<String>, withoutGeometry: Boolean, stageCount: Int, onReturnToNow: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
            PreviewMark()
            Text(stringResource(R.string.timeline_preview_of, names[stop]), style = MaterialTheme.typography.titleSmall, color = Palette.Ink)
        }
        val second = when {
            stop >= stageCount -> stringResource(R.string.timeline_target_detail)
            withoutGeometry -> stringResource(R.string.timeline_no_geometry)
            else -> stringResource(R.string.timeline_stop_position, names[stop])
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
            Text(second, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, modifier = Modifier.weight(1f))
            // Back to the actual state: an action like any other, so ink — the yellow belongs to measured progress.
            LineButton(stringResource(R.string.timeline_return_now), onClick = onReturnToNow, borderColor = Palette.Ink)
        }
    }
}

/** The hollow tag of the rule, beside the words: the same mark in two places. */
@Composable
fun PreviewMark(modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(width = 11.dp, height = 11.dp)
            .border(1.4.dp, Palette.Rule, RoundedCornerShape(2.dp)),
    )
}

/** The expanded strip: every stop named, with its state in words and a mark. */
@Composable
private fun StageStrip(
    stages: List<ConstructionStageProgress>,
    nowStop: Int?,
    previewStop: Int?,
    names: List<String>,
    onPreviewStop: (Int) -> Unit,
) {
    val list = rememberLazyListState()
    val focus = previewStop ?: nowStop ?: 0
    LaunchedEffect(focus) { list.animateScrollToItem((focus - 1).coerceAtLeast(0)) }
    LazyRow(
        state = list,
        contentPadding = PaddingValues(horizontal = Space.l),
        horizontalArrangement = Arrangement.spacedBy(Space.s),
        modifier = Modifier.fillMaxWidth().padding(top = Space.s),
    ) {
        itemsIndexed(names) { stop, name ->
            val stage = stages.getOrNull(stop)
            val selected = stop == previewStop
            val stateWord = when {
                stage == null -> stringResource(R.string.timeline_target_short)
                stage.status == StageStatus.DONE -> stringResource(R.string.stage_status_done)
                stage.status == StageStatus.IN_PROGRESS -> stringResource(R.string.stage_status_in_progress_percent, (stage.completion * 100).toInt())
                else -> stringResource(R.string.stage_status_not_started)
            }
            val isNow = stop == nowStop
            val nowWord = stringResource(R.string.timeline_state_now)
            Column(
                modifier = Modifier
                    .widthIn(min = 96.dp, max = 132.dp)
                    .heightIn(min = 56.dp)
                    // Stops on the rule's own glass, not cards: only the previewed one is marked out.
                    .then(
                        if (selected) {
                            Modifier.background(Palette.Well, RoundedCornerShape(Radius.control)).border(1.dp, Palette.Ink, RoundedCornerShape(Radius.control))
                        } else {
                            Modifier
                        },
                    )
                    .selectable(selected = selected, onClick = { onPreviewStop(stop) }, role = Role.Tab)
                    .semantics { stateDescription = if (isNow) nowWord.format(stateWord) else stateWord }
                    .padding(horizontal = Space.m, vertical = Space.s),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.xs)) {
                    StageMark(stage?.status, stage?.completion ?: 0.0, isTarget = stage == null)
                    Text(
                        if (stage == null) "" else "${stop + 1}",
                        style = Measure.numeral,
                        color = Palette.InkFaint,
                    )
                }
                Text(name, style = MaterialTheme.typography.labelLarge, color = Palette.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(stateWord, style = MaterialTheme.typography.labelSmall, color = Palette.InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
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

@Composable
private fun nowStateText(unset: Boolean, percent: String?, current: ConstructionStageKey?): String = when {
    unset || percent == null -> stringResource(R.string.progress_unset)
    current != null -> stringResource(R.string.progress_state_spoken, percent, stringResource(current.labelRes()))
    else -> percent
}

/** The stop of a stage on the rule (the rule's stops follow the timeline's). */
fun stopOf(stage: ConstructionStageKey): Int = ConstructionTimeline.STOPS.indexOf(TimelineCursor.Stage(stage))
