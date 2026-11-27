package com.buildplan.preview.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.border
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalView
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.buildplan.preview.R
import com.buildplan.preview.progress.ConstructionProgressState
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionStageProgress
import com.buildplan.preview.progress.EditOutcome
import com.buildplan.preview.progress.ProgressAvailability
import com.buildplan.preview.progress.ProgressProblem
import com.buildplan.preview.progress.ProgressRejection
import com.buildplan.preview.progress.ProgressView
import com.buildplan.preview.progress.StageProgressMetric
import com.buildplan.preview.progress.StageStatus
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

/**
 * The stages: the owner's account of the build, and the only place it is
 * edited — a sheet over the house since INTEGRATION-004A, not a page.
 *
 * The seventeen starter stages in order, each with its state as a mark and
 * in words. Tapping a stage opens it in place: the current stage takes its
 * completion and "what we are doing now"; any stage can be made current,
 * marked done or put back. Nothing is done on the owner's behalf: starting a
 * later stage marks nothing earlier as done, and only one stage is current —
 * the app says so and asks the owner to finish or put back the other one,
 * rather than repairing history. The percentage is the same one Dom and 3D
 * show, and it says what it is: progress by stages, not money.
 */
@Composable
fun StagesScreen(
    progress: ProgressViewModel,
    onShowInModel: (ConstructionStageKey?) -> Unit,
    modifier: Modifier = Modifier,
    /** The house as a line drawing, inked by the progress, at the head of the list. */
    drawing: (@Composable () -> Unit)? = null,
    /**
     * Inside the Etapy panel (variant C): the panel's own head says the title and what is saved, and its axis
     * stands above the list, so the list starts with the stages themselves.
     */
    compact: Boolean = false,
) {
    val view = progress.view
    // A wide window centres the list at a readable measure instead of stretching its rows.
    Column(modifier.fillMaxWidth().wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = Sizes.contentMax)) {
        if (view == null) {
            Column(Modifier.padding(Space.l)) {
                Text(stringResource(R.string.stages_title), style = MaterialTheme.typography.headlineSmall, color = Palette.Ink)
                Text(stringResource(R.string.house_loading), style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
            }
        } else {
            StageList(view, progress, onShowInModel, drawing, compact)
        }
    }
}

@Composable
private fun StageList(view: ProgressView, progress: ProgressViewModel, onShowInModel: (ConstructionStageKey?) -> Unit, drawing: (@Composable () -> Unit)?, compact: Boolean) {
    var openStage by rememberSaveable { mutableStateOf(view.summary.currentStage?.let { "stage-${it.key}" }) }
    val editable = view.summary.availability == ProgressAvailability.EDITABLE
    // The sheet opens on the stage the owner tapped the header for: the current one, brought into view once.
    val list = rememberLazyListState()
    LaunchedEffect(Unit) {
        val current = view.stages.indexOfFirst { it.stageId == openStage }
        if (current > 0) list.scrollToItem((if (compact) HEADER_ITEMS - 1 else HEADER_ITEMS) + current)
    }

    // A refusal or a failed save is said where the owner is looking — at the foot of the screen,
    // announced, gone by itself — not as a list item scrolled away from the edit that caused it.
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val outcome = progress.lastOutcome
    val refusedText = outcome?.let { outcomeMessage(it, view) }
    LaunchedEffect(outcome) {
        if (outcome == null) return@LaunchedEffect
        progress.consumeOutcome(outcome)
        // Shown from the screen's scope: consuming the outcome changes this effect's key, and a
        // snackbar shown from inside the effect was cancelled the instant it appeared.
        if (refusedText != null) scope.launch { snackbar.showSnackbar(refusedText, duration = SnackbarDuration.Short) }
    }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), state = list, contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = Space.xxl)) {
            if (!compact) item { Header(view, drawing) }
            item { Problems(view, development = progress.developmentOnly) }
            if (compact && view.summary.unset && editable) {
                // The stage sheet's guide, where the panel's list begins: how a record is started, and that nothing is assumed.
                item {
                    Text(
                        stringResource(R.string.stages_unset_guide),
                        style = MaterialTheme.typography.bodySmall,
                        color = Palette.Ink,
                        modifier = Modifier.padding(horizontal = Space.l, vertical = Space.s),
                    )
                }
            }
            itemsIndexed(view.stages, key = { _, s -> s.stageId }) { index, stage ->
                StageRow(
                    index = index,
                    stage = stage,
                    open = openStage == stage.stageId,
                    view = view,
                    editable = editable,
                    hasGeometry = stage.stageKey?.let { progress.session?.projection?.hasGeometry(it) } ?: false,
                    onToggle = { openStage = if (openStage == stage.stageId) null else stage.stageId },
                    progress = progress,
                    onShowInModel = onShowInModel,
                )
            }
            item { Footer() }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(Space.s)) { data ->
            Snackbar(data, containerColor = Palette.Sheet, contentColor = Palette.Ink, shape = RoundedCornerShape(Radius.panel))
        }
    }
}

/**
 * The head of the stage sheet: the title, the house drawn in ink by this
 * record, the one monumental figure of the app with what it is and when it
 * was last changed, the static rule, and the guide while nothing is set.
 * The house's name is not repeated: the top context above the sheet says it.
 */
@Composable
private fun Header(view: ProgressView, drawing: (@Composable () -> Unit)?) {
    val summary = view.summary
    Column(Modifier.fillMaxWidth().padding(horizontal = Space.l).padding(top = Space.l, bottom = Space.s)) {
        Text(
            stringResource(R.string.stages_title),
            style = MaterialTheme.typography.headlineSmall,
            color = Palette.Ink,
            modifier = Modifier.semantics { heading() },
        )
        drawing?.invoke()
        val spoken = summary.percent?.let { pluralStringResource(R.plurals.progress_metric_spoken, it, it) }
        Row(
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(Space.m),
            modifier = Modifier.fillMaxWidth().padding(top = Space.m).then(if (spoken != null) Modifier.semantics(mergeDescendants = true) { stateDescription = spoken } else Modifier),
        ) {
            if (summary.percent != null) {
                Text(StageProgressMetric.format(summary.percent), style = Measure.monumental, color = Palette.Ink)
                Column(Modifier.weight(1f).padding(bottom = Space.s)) {
                    Text(stringResource(R.string.progress_metric_label), style = MaterialTheme.typography.labelLarge, color = Palette.Ink)
                    Text(stringResource(R.string.progress_done_of, summary.doneCount, summary.stageCount), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
                    summary.savedAtEpochMs?.let {
                        Text(stringResource(R.string.progress_saved_on, savedDate(it)), style = MaterialTheme.typography.bodySmall, color = Palette.InkFaint)
                    }
                }
            } else {
                Text(stringResource(R.string.progress_unset), style = MaterialTheme.typography.titleMedium, color = Palette.Ink)
            }
        }
        Text(stringResource(R.string.progress_explain), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, modifier = Modifier.padding(top = Space.xs, bottom = Space.m))
        FoldingRule(view.stages, nowStop = view.nowStop, previewStop = null, height = RuleDefaults.StaticHeight)
        if (summary.unset && summary.availability == ProgressAvailability.EDITABLE) {
            Text(stringResource(R.string.stages_unset_guide), style = MaterialTheme.typography.bodyMedium, color = Palette.Ink, modifier = Modifier.padding(top = Space.m))
        }
    }
}

/** A problem with the saved record, said once, in words, where the edits are. */
@Composable
private fun Problems(view: ProgressView, development: Boolean = false) {
    val previewOnly = if (development) R.string.progress_development_body else R.string.progress_preview_only_body
    val text = progressProblemText(view.problem)
        ?: stringResource(previewOnly).takeIf { view.summary.availability == ProgressAvailability.PREVIEW_ONLY }
        ?: return
    ProblemLine(text, Modifier.padding(horizontal = Space.l, vertical = Space.s))
}

/**
 * What is wrong with this house's saved record, in words, or null. Dom, the
 * 3D header and Etapy say the same sentence (cycle 3, C3-04): a record that
 * was set aside or written by a newer app is never shown as a plain "unset".
 */
@Composable
internal fun progressProblemText(problem: ProgressProblem?): String? = when (problem) {
    is ProgressProblem.RecoveredFromCorruption -> stringResource(R.string.progress_problem_corrupt)
    is ProgressProblem.NewerSchema -> stringResource(R.string.progress_problem_newer, problem.schemaVersion)
    is ProgressProblem.SaveFailed -> stringResource(R.string.progress_problem_save_failed)
    null -> null
}

/** The problem sentence with its mark: never said by colour alone. */
@Composable
internal fun ProblemLine(text: String, modifier: Modifier = Modifier, style: TextStyle = MaterialTheme.typography.bodyMedium, maxLines: Int = Int.MAX_VALUE) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Space.s)) {
        Icon(ShellIcons.caution, contentDescription = null, tint = Palette.Error, modifier = Modifier.size(Sizes.iconSmall))
        Text(text, style = style, color = Palette.Ink, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StageRow(
    index: Int,
    stage: ConstructionStageProgress,
    open: Boolean,
    view: ProgressView,
    editable: Boolean,
    hasGeometry: Boolean,
    onToggle: () -> Unit,
    progress: ProgressViewModel,
    onShowInModel: (ConstructionStageKey?) -> Unit,
) {
    val name = stage.stageKey?.let { stringResource(it.labelRes()) } ?: stage.definitionKey
    val state = when (stage.status) {
        StageStatus.DONE -> stringResource(R.string.stage_status_done)
        StageStatus.IN_PROGRESS -> stringResource(R.string.stage_status_in_progress_percent, StageProgressMetric.percentOf(stage.completion))
        StageStatus.NOT_STARTED -> stringResource(R.string.stage_status_not_started)
    }
    val openState = stringResource(if (open) R.string.state_expanded else R.string.state_collapsed)
    val motion = LocalMotionPolicy.current
    // The row opens like the editor under it: the well and the chevron settle, they do not snap (round D).
    val well by animateColorAsState(if (open) Palette.Well else androidx.compose.ui.graphics.Color.Transparent, motion.settle(), label = "stageWell")
    val turn by animateFloatAsState(if (open) 90f else 0f, motion.settle(), label = "stageChevron")
    Column(
        Modifier
            .fillMaxWidth()
            .background(well),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clickable(role = Role.Button, onClick = onToggle)
                // The status is spoken once: from its visible word where there is one, in the state where there is not.
                .semantics(mergeDescendants = true) { stateDescription = if (stage.status == StageStatus.NOT_STARTED) "$state, $openState" else openState }
                .padding(horizontal = Space.l, vertical = Space.s),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.m),
        ) {
            Text((index + 1).toString(), style = Measure.numeral, color = Palette.InkFaint, modifier = Modifier.width(18.dp))
            StageMark(stage.status, stage.completion)
            Column(Modifier.weight(1f)) {
                Text(
                    name,
                    style = MaterialTheme.typography.bodyLarge,
                    color = Palette.Ink,
                    fontWeight = if (stage.status == StageStatus.IN_PROGRESS) androidx.compose.ui.text.font.FontWeight.SemiBold else null,
                )
                // A stage not started says nothing: its empty mark and the spoken state carry it (no wall of
                // "Nierozpoczęty"); done and in-progress stages say so in words.
                if (stage.status != StageStatus.NOT_STARTED) {
                    Text(state, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
                }
            }
            Icon(
                ShellIcons.chevronRight,
                contentDescription = null,
                tint = Palette.InkMuted,
                modifier = Modifier.size(Sizes.iconSmall).rotate(turn),
            )
        }
        AnimatedVisibility(visible = open, enter = motion.foldEnter(), exit = motion.foldExit()) {
            Column(Modifier.fillMaxWidth().padding(start = Space.l, end = Space.l, bottom = Space.l), verticalArrangement = Arrangement.spacedBy(Space.m)) {
                if (!hasGeometry) {
                    Text(stringResource(R.string.stage_no_geometry), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
                }
                if (stage.status == StageStatus.IN_PROGRESS && editable) {
                    CompletionEditor(stage, progress)
                    TaskEditor(view.summary.currentTask, progress)
                }
                StageActions(stage, view, editable, progress, onShowInModel)
            }
        }
        Box(Modifier.fillMaxWidth().padding(start = Space.l).height(1.dp).background(Palette.Hairline))
    }
}

/**
 * The stage's completion, changed by steps of 5 % and saved by its own button
 * (variant C). A slider in a scrolling list moved under a finger that only
 * meant to scroll, and saved on release; here nothing is saved until the
 * owner presses "Zapisz", and "Cofnij" puts the draft back to what is saved.
 */
@Composable
private fun CompletionEditor(stage: ConstructionStageProgress, progress: ProgressViewModel) {
    val saved = StageProgressMetric.percentOf(stage.completion)
    // Saveable: an unsaved draft survives a scroll of the list and a turn of the phone (round D).
    var draft by rememberSaveable(stage.stageId, saved) { mutableIntStateOf(saved) }
    val changed = draft != saved
    Column(verticalArrangement = Arrangement.spacedBy(Space.s)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.stage_completion), style = MaterialTheme.typography.labelLarge, color = Palette.Ink, modifier = Modifier.weight(1f))
            if (changed) {
                Text(stringResource(R.string.stage_completion_saved_value, StageProgressMetric.format(saved)), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, modifier = Modifier.padding(end = Space.s))
            }
            Text(StageProgressMetric.format(draft), style = Measure.inline, color = Palette.Ink, modifier = Modifier.semantics { stateDescription = "$draft%" })
        }
        CompletionTrack(draft / 100f, steps = 19)
        // A quarter at a tap; the ±5 steps below for the rest. Nothing is saved until "Zapisz".
        Row(horizontalArrangement = Arrangement.spacedBy(Space.xs), modifier = Modifier.fillMaxWidth().selectableGroup()) {
            for (quick in listOf(0, 25, 50, 75, 100)) {
                val chosen = draft == quick
                val shape = RoundedCornerShape(Radius.pill)
                Box(
                    Modifier
                        .weight(1f)
                        .heightIn(min = Sizes.touch)
                        .background(if (chosen) Palette.AccentWash else Palette.CardFill, shape)
                        .border(if (chosen) 1.5.dp else 1.dp, if (chosen) Palette.Accent else Palette.GlassRimHigh, shape)
                        .selectable(selected = chosen, onClick = { draft = quick }, role = Role.RadioButton),
                    contentAlignment = Alignment.Center,
                ) {
                    // Chosen is said by more than colour: a heavier figure in the accent ink, and the radio state.
                    Text(
                        StageProgressMetric.format(quick),
                        style = Measure.numeral.copy(fontSize = if (chosen) 17.sp else 15.sp),
                        color = if (chosen) Palette.Accent else Palette.Ink,
                        textDecoration = if (chosen) androidx.compose.ui.text.style.TextDecoration.Underline else null,
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s), verticalAlignment = Alignment.CenterVertically) {
            val less = stringResource(R.string.stage_completion_less)
            val more = stringResource(R.string.stage_completion_more)
            LineButton("−5", onClick = { draft = (draft - STEP).coerceAtLeast(0) }, enabled = draft > 0, modifier = Modifier.semantics { contentDescription = less })
            LineButton("+5", onClick = { draft = (draft + STEP).coerceAtMost(100) }, enabled = draft < 100, modifier = Modifier.semantics { contentDescription = more })
            Box(Modifier.weight(1f))
            if (changed) {
                TextButton(onClick = { draft = saved }, modifier = Modifier.heightIn(min = Sizes.touch)) {
                    Text(stringResource(R.string.stage_completion_cancel), color = Palette.InkMuted)
                }
            }
        }
        if (changed) {
            val host = LocalView.current
            InkButton(stringResource(R.string.stage_completion_save, StageProgressMetric.format(draft)), onClick = { progress.setCompletion(stage.stageId, draft / 100.0).confirm(host) })
        }
        // Said only where it matters: at 100 %, which does not close the stage by itself.
        if (draft == 100) Text(stringResource(R.string.stage_completion_hint), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
    }
}

/** One step of the completion: 5 %. */
private const val STEP = 5

/** The completion as a short rule: graduations at every step, the done share in yellow. */
@Composable
private fun CompletionTrack(fraction: Float, steps: Int) {
    Canvas(Modifier.fillMaxWidth().height(8.dp)) {
        val corner = CornerRadius(Radius.tick.toPx())
        drawRoundRect(Palette.Hairline, cornerRadius = corner)
        // The range reads as the rule's "not started": an outline, not a faint fill alone (finish review, F-06).
        drawRoundRect(Palette.RuleEmpty, cornerRadius = corner, style = Stroke(width = 1.2.dp.toPx()))
        drawRoundRect(Palette.Rule, size = Size(size.width * fraction, size.height), cornerRadius = corner)
        val segments = steps + 1
        val stroke = 1.dp.toPx()
        for (i in 1 until segments) {
            val x = size.width * i / segments
            drawLine(
                if (x <= size.width * fraction) Palette.OnRule else Palette.RuleEmpty,
                Offset(x, size.height * 0.25f),
                Offset(x, size.height * 0.75f),
                strokeWidth = stroke,
            )
        }
    }
}

@Composable
private fun TaskEditor(current: String?, progress: ProgressViewModel) {
    var text by rememberSaveable(current) { mutableStateOf(current.orEmpty()) }
    val changed = text.trim() != current.orEmpty()
    // Saved means done typing: the keyboard goes, and with it the places come back.
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = LocalFocusManager.current
    val save: () -> Unit = {
        progress.setCurrentTask(text)
        focus.clearFocus()
        keyboard?.hide()
    }
    Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
        OutlinedTextField(
            value = text,
            onValueChange = { if (it.length <= ConstructionProgressState.MAX_TEXT) text = it },
            label = { Text(stringResource(R.string.stage_task_label)) },
            placeholder = { Text(stringResource(R.string.stage_task_placeholder)) },
            // The limit is said before it is met, not discovered by a keystroke that does nothing (C3-11).
            supportingText = if (text.length >= ConstructionProgressState.MAX_TEXT - TASK_COUNTER_FROM) {
                { Text(stringResource(R.string.stage_task_counter, text.length, ConstructionProgressState.MAX_TEXT)) }
            } else {
                null
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (changed) save() }),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Palette.Ink,
                unfocusedBorderColor = Palette.RuleEmpty,
                focusedLabelColor = Palette.Ink,
                cursorColor = Palette.Ink,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        if (changed) {
            LineButton(stringResource(R.string.stage_task_save), onClick = save)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StageActions(
    stage: ConstructionStageProgress,
    view: ProgressView,
    editable: Boolean,
    progress: ProgressViewModel,
    onShowInModel: (ConstructionStageKey?) -> Unit,
) {
    var confirmReset by remember { mutableStateOf(false) }
    val host = LocalView.current
    val other = view.stages.firstOrNull { it.status == StageStatus.IN_PROGRESS && it.stageId != stage.stageId }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s), verticalArrangement = Arrangement.spacedBy(Space.s)) {
        if (editable) {
            when (stage.status) {
                StageStatus.NOT_STARTED -> {
                    InkButton(stringResource(R.string.stage_make_current), onClick = { progress.startStage(stage.stageId).confirm(host) }, enabled = other == null)
                    LineButton(stringResource(R.string.stage_mark_done), onClick = { progress.markDone(stage.stageId).confirm(host) })
                }
                StageStatus.IN_PROGRESS -> {
                    // Finishing a stage and starting the next is one deliberate action, the common one (round D);
                    // finishing alone stays beside it for the last stage or a planned gap.
                    val next = view.stages.filter { it.order > stage.order && it.status == StageStatus.NOT_STARTED }.minByOrNull { it.order }
                    if (next != null) {
                        val nextName = next.stageKey?.let { stringResource(it.labelRes()) } ?: next.definitionKey
                        InkButton(stringResource(R.string.stage_finish_and_start, nextName), onClick = {
                            if (progress.markDone(stage.stageId) == EditOutcome.Saved) progress.startStage(next.stageId).confirm(host)
                        })
                        LineButton(stringResource(R.string.stage_mark_done), onClick = { progress.markDone(stage.stageId).confirm(host) })
                    } else {
                        InkButton(stringResource(R.string.stage_mark_done), onClick = { progress.markDone(stage.stageId).confirm(host) })
                    }
                    // Everything before the current stage finished, in one deliberate edit that says how many it touches.
                    val earlier = view.stages.count { it.order < stage.order && it.status != StageStatus.DONE }
                    if (earlier > 0) {
                        LineButton(pluralStringResource(R.plurals.stage_mark_earlier_done, earlier, earlier), onClick = { progress.markDoneBefore(stage.stageId) })
                    }
                    LineButton(stringResource(R.string.stage_reset), onClick = { confirmReset = true })
                }
                StageStatus.DONE -> {
                    LineButton(stringResource(R.string.stage_reopen), onClick = { progress.startStage(stage.stageId, 1.0) }, enabled = other == null)
                    LineButton(stringResource(R.string.stage_reset), onClick = { confirmReset = true })
                }
            }
        }
        LineButton(
            stringResource(if (stage.status == StageStatus.IN_PROGRESS) R.string.stage_show_now else R.string.stage_show_in_3d),
            onClick = { onShowInModel(if (stage.status == StageStatus.IN_PROGRESS) null else stage.stageKey) },
            icon = ShellIcons.cube,
        )
    }
    if (other != null && stage.status != StageStatus.IN_PROGRESS && editable) {
        Text(
            stringResource(R.string.stage_other_current, other.stageKey?.let { stringResource(it.labelRes()) } ?: other.definitionKey),
            style = MaterialTheme.typography.bodySmall,
            color = Palette.InkMuted,
        )
    }
    if (confirmReset) {
        AlertDialog(
            onDismissRequest = { confirmReset = false },
            containerColor = Palette.Sheet,
            title = { Text(stringResource(R.string.stage_reset_title)) },
            text = { Text(stringResource(R.string.stage_reset_body)) },
            confirmButton = {
                TextButton(onClick = { progress.resetStage(stage.stageId); confirmReset = false }, modifier = Modifier.heightIn(min = Sizes.touch)) {
                    Text(stringResource(R.string.stage_reset), color = Palette.Ink)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmReset = false }, modifier = Modifier.heightIn(min = Sizes.touch)) {
                    Text(stringResource(R.string.stage_reset_keep), color = Palette.InkMuted)
                }
            },
        )
    }
}

@Composable
private fun Footer() {
    Text(
        stringResource(R.string.stages_footer),
        style = MaterialTheme.typography.bodySmall,
        color = Palette.InkMuted,
        modifier = Modifier.padding(horizontal = Space.l, vertical = Space.l),
    )
}

/** What a refused or failed edit means, in words; null for a saved one. */
@Composable
private fun outcomeMessage(outcome: EditOutcome, view: ProgressView): String? = when (outcome) {
    EditOutcome.Saved -> null
    EditOutcome.NotEditable -> stringResource(R.string.progress_preview_only_body)
    is EditOutcome.SaveFailed -> stringResource(R.string.progress_problem_save_failed)
    is EditOutcome.Refused -> when (outcome.reason) {
        ProgressRejection.ANOTHER_STAGE_IN_PROGRESS -> {
            val other = view.stages.firstOrNull { it.status == StageStatus.IN_PROGRESS }
            stringResource(R.string.stage_other_current, other?.stageKey?.let { stringResource(it.labelRes()) } ?: "")
        }
        ProgressRejection.STAGE_NOT_IN_PROGRESS -> stringResource(R.string.refused_not_in_progress)
        ProgressRejection.COMPLETION_OUT_OF_RANGE -> stringResource(R.string.refused_completion)
        ProgressRejection.NO_CURRENT_STAGE -> stringResource(R.string.refused_no_current)
        ProgressRejection.TEXT_TOO_LONG -> pluralStringResource(R.plurals.refused_text_too_long, ConstructionProgressState.MAX_TEXT, ConstructionProgressState.MAX_TEXT)
        ProgressRejection.UNKNOWN_STAGE -> stringResource(R.string.refused_unknown_stage)
    }
}

/** The list items before the first stage row: the header and the problem line. */
private const val HEADER_ITEMS = 2

/** How many characters before the limit the task field starts counting them. */
private const val TASK_COUNTER_FROM = 40

/**
 * One confirm tick when a deliberate edit was kept (round D): the finger feels the save land. Never for browsing,
 * scrolling or a refused edit.
 */
private fun EditOutcome.confirm(host: android.view.View) {
    if (this != EditOutcome.Saved) return
    host.performHapticFeedback(
        if (android.os.Build.VERSION.SDK_INT >= 30) android.view.HapticFeedbackConstants.CONFIRM else android.view.HapticFeedbackConstants.VIRTUAL_KEY,
    )
}
