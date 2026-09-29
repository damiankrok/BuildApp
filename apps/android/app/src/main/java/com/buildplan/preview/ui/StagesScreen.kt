package com.buildplan.preview.ui

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
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
 * `Etapy`: the owner's account of the build, and the only place it is edited.
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
fun StagesScreen(progress: ProgressViewModel, sceneTitle: String?, onShowInModel: (ConstructionStageKey?) -> Unit) {
    val view = progress.view
    // A wide window centres the list at a readable measure instead of stretching its rows.
    Column(Modifier.fillMaxSize().wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = Sizes.contentMax).statusBarsPadding()) {
        if (view == null) {
            Column(Modifier.padding(Space.l)) {
                Text(stringResource(R.string.stages_title), style = MaterialTheme.typography.headlineSmall, color = Palette.Ink)
                Text(stringResource(R.string.house_loading), style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
            }
        } else {
            StageList(view, progress, sceneTitle, onShowInModel)
        }
    }
}

@Composable
private fun StageList(view: ProgressView, progress: ProgressViewModel, sceneTitle: String?, onShowInModel: (ConstructionStageKey?) -> Unit) {
    var openStage by rememberSaveable { mutableStateOf(view.summary.currentStage?.let { "stage-${it.key}" }) }
    val editable = view.summary.availability == ProgressAvailability.EDITABLE

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
        LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = Space.xxl)) {
            item { Header(view, sceneTitle) }
            item { Problems(view) }
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

@Composable
private fun Header(view: ProgressView, sceneTitle: String?) {
    val summary = view.summary
    Column(Modifier.fillMaxWidth().padding(horizontal = Space.l).padding(top = Space.l, bottom = Space.s)) {
        Text(
            stringResource(R.string.stages_title),
            style = MaterialTheme.typography.headlineSmall,
            color = Palette.Ink,
            modifier = Modifier.semantics { heading() },
        )
        sceneTitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis) }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Space.s), modifier = Modifier.padding(top = Space.m)) {
            if (summary.percent != null) {
                Text(StageProgressMetric.format(summary.percent), style = Measure.inline.copy(fontSize = Measure.inline.fontSize * 1.4f), color = Palette.Ink)
                Text(stringResource(R.string.progress_metric_label), style = MaterialTheme.typography.labelLarge, color = Palette.Ink, modifier = Modifier.padding(bottom = 3.dp))
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
private fun Problems(view: ProgressView) {
    val text = when {
        view.summary.availability == ProgressAvailability.PREVIEW_ONLY -> stringResource(R.string.progress_preview_only_body)
        else -> when (val p = view.problem) {
            is ProgressProblem.RecoveredFromCorruption -> stringResource(R.string.progress_problem_corrupt)
            is ProgressProblem.NewerSchema -> stringResource(R.string.progress_problem_newer, p.schemaVersion)
            is ProgressProblem.SaveFailed -> stringResource(R.string.progress_problem_save_failed)
            null -> null
        }
    } ?: return
    Row(
        Modifier.fillMaxWidth().padding(horizontal = Space.l, vertical = Space.s),
        horizontalArrangement = Arrangement.spacedBy(Space.s),
    ) {
        Icon(ShellIcons.caution, contentDescription = null, tint = Palette.Error, modifier = Modifier.size(Sizes.iconSmall))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
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
    Column(
        Modifier
            .fillMaxWidth()
            .background(if (open) Palette.Raised else androidx.compose.ui.graphics.Color.Transparent),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clickable(role = Role.Button, onClick = onToggle)
                .semantics(mergeDescendants = true) { stateDescription = openState }
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
                Text(state, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
            }
            Icon(
                ShellIcons.chevronRight,
                contentDescription = null,
                tint = Palette.InkMuted,
                modifier = Modifier.size(Sizes.iconSmall).rotate(if (open) 90f else 0f),
            )
        }
        AnimatedVisibility(visible = open) {
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

@Composable
private fun CompletionEditor(stage: ConstructionStageProgress, progress: ProgressViewModel) {
    var value by remember(stage.stageId, stage.completion) { mutableFloatStateOf(stage.completion.toFloat()) }
    val percent = (value * 100).roundToInt()
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.stage_completion), style = MaterialTheme.typography.labelLarge, color = Palette.Ink, modifier = Modifier.weight(1f))
            Text(StageProgressMetric.format(percent.coerceIn(0, 100)), style = Measure.inline, color = Palette.Ink)
        }
        Slider(
            value = value,
            onValueChange = { value = it },
            onValueChangeFinished = { progress.setCompletion(stage.stageId, (value * 20).roundToInt() / 20.0) },
            steps = 19,
            colors = SliderDefaults.colors(
                thumbColor = Palette.Rule,
                activeTrackColor = Palette.Rule,
                inactiveTrackColor = Palette.Hairline,
                activeTickColor = Palette.OnRule,
                inactiveTickColor = Palette.RuleEmpty,
            ),
            modifier = Modifier.semantics { stateDescription = "$percent%" },
        )
        Text(stringResource(R.string.stage_completion_hint), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
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
    val other = view.stages.firstOrNull { it.status == StageStatus.IN_PROGRESS && it.stageId != stage.stageId }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s), verticalArrangement = Arrangement.spacedBy(Space.s)) {
        if (editable) {
            when (stage.status) {
                StageStatus.NOT_STARTED -> {
                    InkButton(stringResource(R.string.stage_make_current), onClick = { progress.startStage(stage.stageId) }, enabled = other == null)
                    LineButton(stringResource(R.string.stage_mark_done), onClick = { progress.markDone(stage.stageId) })
                }
                StageStatus.IN_PROGRESS -> {
                    InkButton(stringResource(R.string.stage_mark_done), onClick = { progress.markDone(stage.stageId) })
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
