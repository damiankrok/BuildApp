package com.buildplan.preview.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.PRODUCT_LOCALE
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.AnalysisStages
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalysisSummary
import com.buildplan.preview.analyzer.AnalyzerAddress
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.AnalyzerMessages
import com.buildplan.preview.analyzer.JobStatus
import com.buildplan.preview.analyzer.LocalRunReport
import com.buildplan.preview.analyzer.RetryAction
import com.buildplan.preview.analyzer.StageChecklist
import com.buildplan.preview.analyzer.StageRow
import com.buildplan.preview.analyzer.StageState
import com.buildplan.preview.analyzer.LivenessTracker
import com.buildplan.preview.analyzer.Liveness
import com.buildplan.preview.analyzer.local.LocalAnalysis
import com.buildplan.preview.analyzer.local.NodeRuntime
import com.buildplan.preview.analyzer.local.OcrSelfTestState
import com.buildplan.preview.scene.DownloadedSceneEntry
import android.os.SystemClock
import java.net.URI
import java.text.SimpleDateFormat
import java.util.Date
import kotlin.math.roundToInt
import kotlinx.coroutines.delay

/**
 * Adding a house from a link: paste the project page, watch the analysis,
 * open the model it made.
 *
 * The link comes first; where the analysis runs (this phone or the service)
 * and the service's address are settings, folded away. While it runs, the
 * page shows the analyzer's own progress and its stages in plain Polish. A
 * finished analysis says "Model gotowy" or, when the analyzer left anything
 * unresolved or warned, "Model gotowy z ograniczeniami" — a partial result is
 * never presented as complete. Hashes, counts, timings and the analyzer's own
 * English sentences are under "Szczegóły analizy": for checking, not reading.
 * The houses on this phone are the house menu's; removing one is the source
 * sheet's (INTEGRATION-004A) — this task only adds.
 *
 * Everything shown is what the analyzer reported; there is no reference
 * model, benchmark or expected value anywhere here.
 */
@Composable
fun AnalyzerScreen(model: AnalyzerViewModel, onBack: () -> Unit, onOpenScene: (key: String) -> Unit) {
    var settingsOpen by rememberSaveable { mutableStateOf(false) }
    // The task keeps clear of the status bar, the navigation bar, the cutout and the keyboard (cycle 3, P-03).
    Column(Modifier.fillMaxSize().background(Palette.Ground).safeDrawingPadding().wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = Sizes.contentMax)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = Space.xs, vertical = Space.xs), verticalAlignment = Alignment.CenterVertically) {
            val back = stringResource(R.string.analyzer_back)
            IconButton(onClick = onBack, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = back }) {
                Icon(ShellIcons.back, contentDescription = null, tint = Palette.Ink)
            }
            Text(
                stringResource(R.string.analyzer_title),
                style = MaterialTheme.typography.titleMedium,
                color = Palette.Ink,
                modifier = Modifier.semantics { heading() },
            )
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Space.l)
                .padding(bottom = Space.xxl),
            verticalArrangement = Arrangement.spacedBy(Space.m),
        ) {
            if (!model.isConfigured) {
                NotConfigured(model)
            } else {
                Text(stringResource(R.string.analyzer_intro), style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
                LinkForm(model)
                model.notice?.let { StatusText(it, color = Palette.Ink) }
                // A notice nothing waits on leaves by itself.
                LaunchedEffect(model.notice) {
                    if (model.notice != null) {
                        delay(NOTICE_MS)
                        model.clearNotice()
                    }
                }
                JobSection(model, onOpenScene)
            }
            Foldout(
                title = stringResource(R.string.analyzer_settings),
                open = settingsOpen,
                onToggle = { settingsOpen = !settingsOpen },
            ) {
                ModeRow(model)
                if (model.mode == AnalyzerMode.SERVICE && model.isConfigured) ServiceRow(model)
                if (model.localRuns.isNotEmpty()) LocalRuns(model.localRuns)
                if (model.localAvailability.available) OcrSelfTestRow(model)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Settings: where the analysis runs
// ---------------------------------------------------------------------------

@Composable
private fun ModeRow(model: AnalyzerViewModel) {
    val local = model.mode == AnalyzerMode.LOCAL
    Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
        Text(
            stringResource(if (local) R.string.analyzer_mode_local else R.string.analyzer_mode_service),
            style = MaterialTheme.typography.titleSmall,
            color = Palette.Ink,
        )
        if (local) {
            Body(stringResource(R.string.analyzer_mode_local_body))
        } else if (!model.localAvailability.available) {
            Body(stringResource(R.string.analyzer_local_unavailable, model.localAvailability.reason ?: "—"))
        } else {
            Body(stringResource(R.string.analyzer_mode_service_body))
        }
        LineButton(
            stringResource(if (local) R.string.analyzer_use_service else R.string.analyzer_use_local),
            onClick = { model.selectMode(if (local) AnalyzerMode.SERVICE else AnalyzerMode.LOCAL) },
            enabled = !model.runtimeBusy && (local || model.localAvailability.available),
        )
    }
}

@Composable
private fun NotConfigured(model: AnalyzerViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(Space.s)) {
        Text(stringResource(R.string.analyzer_not_configured_title), style = MaterialTheme.typography.titleMedium, color = Palette.Ink, modifier = Modifier.semantics { heading() })
        val builtIn = model.builtInAddress.trim()
        if (builtIn.isNotEmpty()) {
            (AnalyzerAddress.check(builtIn) as? AnalyzerAddress.Check.Invalid)?.reason?.let { Body(stringResource(R.string.analyzer_builtin_invalid, it)) }
        }
        Body(stringResource(R.string.analyzer_not_configured_body))
        AddressEditor(model, initial = model.serviceAddress, onDone = {})
    }
}

@Composable
private fun ServiceRow(model: AnalyzerViewModel) {
    var editing by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
        val base = model.effectiveBaseUrl.orEmpty()
        val own = AnalyzerAddress.normalize(model.serviceAddress) != null
        Body(stringResource(if (own) R.string.analyzer_service_own else R.string.analyzer_service_builtin, hostOf(base)))
        TextButton(onClick = { editing = !editing }, enabled = !model.isRunning, modifier = Modifier.heightIn(min = Sizes.touch)) {
            Text(stringResource(if (editing) R.string.analyzer_close else R.string.analyzer_change), color = Palette.Ink)
        }
        if (editing && !model.isRunning) {
            AddressEditor(model, initial = model.serviceAddress.ifEmpty { base }, onDone = { editing = false })
            if (model.serviceAddress.isNotEmpty() && AnalyzerAddress.normalize(model.builtInAddress) != null) {
                TextButton(onClick = { model.saveServiceAddress(""); editing = false }, modifier = Modifier.heightIn(min = Sizes.touch)) {
                    Text(stringResource(R.string.analyzer_builtin_address), color = Palette.Ink)
                }
            }
        }
    }
}

@Composable
private fun AddressEditor(model: AnalyzerViewModel, initial: String, onDone: () -> Unit) {
    var text by rememberSaveable { mutableStateOf(initial) }
    var problem by remember { mutableStateOf<String?>(null) }
    val enter = stringResource(R.string.analyzer_address_empty)
    val save = {
        problem = if (text.isBlank()) enter else model.saveServiceAddress(text)
        if (problem == null) onDone()
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it; problem = null },
        label = { Text(stringResource(R.string.analyzer_address)) },
        placeholder = { Text("https://analyzer.example.com") },
        singleLine = true,
        isError = problem != null,
        supportingText = { Text(problem ?: stringResource(R.string.analyzer_address_hint)) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done, autoCorrectEnabled = false),
        keyboardActions = KeyboardActions(onDone = { save() }),
        colors = fieldColors(),
        modifier = Modifier.fillMaxWidth(),
    )
    InkButton(stringResource(R.string.analyzer_save_address), onClick = { save() })
}

// ---------------------------------------------------------------------------
// The link and the job
// ---------------------------------------------------------------------------

@Composable
private fun LinkForm(model: AnalyzerViewModel) {
    // Starting the analysis puts the keyboard away: what follows is progress to watch, not text to type.
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = LocalFocusManager.current
    val start = {
        focus.clearFocus()
        keyboard?.hide()
        model.analyze()
    }
    Column(verticalArrangement = Arrangement.spacedBy(Space.s)) {
        OutlinedTextField(
            value = model.link,
            onValueChange = model::onLinkChange,
            label = { Text(stringResource(R.string.analyzer_link)) },
            placeholder = { Text("https://www.archon.pl/projekty-domow/…") },
            singleLine = true,
            enabled = !model.runtimeBusy,
            isError = model.linkProblem != null,
            supportingText = model.linkProblem?.let { problem -> { Text(problem) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go, autoCorrectEnabled = false),
            keyboardActions = KeyboardActions(onGo = { start() }),
            colors = fieldColors(),
            modifier = Modifier.fillMaxWidth(),
        )
        // With a result on the screen, opening it is the one filled action; a new link is second (cycle 3, C3-09).
        if (model.state is AnalysisState.Completed) {
            LineButton(
                stringResource(R.string.analyzer_analyze),
                onClick = start,
                enabled = !model.runtimeBusy && model.link.isNotBlank(),
                borderColor = Palette.Ink,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            InkButton(
                stringResource(R.string.analyzer_analyze),
                onClick = start,
                enabled = !model.runtimeBusy && model.link.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (model.isRunning) StatusText(stringResource(R.string.analyzer_analyze_disabled))
        else if (model.runtimeBusy) StatusText(stringResource(R.string.analyzer_selftest_busy))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun JobSection(model: AnalyzerViewModel, onOpenScene: (String) -> Unit) {
    when (val state = model.state) {
        AnalysisState.Idle -> Unit
        is AnalysisState.Submitting -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.m)) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Palette.InkMuted)
            Body(stringResource(if (model.mode == AnalyzerMode.LOCAL) R.string.analyzer_preparing_local else R.string.analyzer_sending))
        }
        is AnalysisState.Polling -> JobProgress(
            status = state.status,
            headline = null,
            note = if (model.mode == AnalyzerMode.LOCAL) stringResource(R.string.analyzer_running_note_local) else null,
            connectionLost = state.connectionLost,
            lastFailure = state.lastFailure,
            cancelling = model.cancelling,
            onCancel = { model.cancel() },
        )
        is AnalysisState.Finishing -> JobProgress(
            status = state.status,
            headline = stringResource(if (state.local != null) R.string.analyzer_finishing_local else R.string.analyzer_finishing_service),
            note = null,
            connectionLost = state.connectionLost,
            lastFailure = state.lastFailure,
            cancelling = false,
            onCancel = null,
        )
        is AnalysisState.Completed -> Result(state.summary, state.entry, state.local, onOpen = { onOpenScene(state.entry.key) })
        is AnalysisState.Failed -> {
            val context = LocalContext.current
            val share = model.diagnosticsShareIntent(state.failure)
            val chooser = stringResource(R.string.analyzer_share_diagnostics)
            Failure(
                failure = state.failure,
                retry = state.retry,
                status = state.status,
                local = state.local,
                onRetry = { model.retry() },
                onDismiss = { model.dismiss() },
                onShare = share?.let { intent -> { context.startActivity(android.content.Intent.createChooser(intent, chooser)) } },
            )
        }
        is AnalysisState.Cancelled -> Column(verticalArrangement = Arrangement.spacedBy(Space.s)) {
            Text(
                stringResource(R.string.analyzer_cancelled),
                style = MaterialTheme.typography.titleSmall,
                color = Palette.Ink,
                modifier = Modifier.semantics { heading(); liveRegion = LiveRegionMode.Polite },
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s), verticalArrangement = Arrangement.spacedBy(Space.s)) {
                InkButton(stringResource(R.string.analyzer_again), onClick = { model.analyze() }, enabled = model.link.isNotBlank())
                LineButton(stringResource(R.string.analyzer_dismiss), onClick = { model.dismiss() })
            }
        }
    }
}

@Composable
private fun JobProgress(
    status: JobStatus?,
    headline: String?,
    note: String?,
    connectionLost: Boolean,
    lastFailure: AnalyzerFailure?,
    cancelling: Boolean,
    onCancel: (() -> Unit)?,
) {
    // Exactly the analyzer's value. It is never animated or advanced here, and a run that has not
    // ended never reads 100 %, whatever an older analyzer sent (005A).
    val progress = (status?.progress ?: 0.0).coerceIn(0.0, RUNNING_PROGRESS_MAX).toFloat()
    val percent = (progress * 100).roundToInt()
    val stage = status?.stage
    Column(verticalArrangement = Arrangement.spacedBy(Space.s)) {
        Text(
            headline ?: when {
                status == null -> stringResource(R.string.analyzer_asking)
                status.status == LocalAnalysis.STARTING -> stringResource(R.string.analyzer_starting_local)
                status.status == AnalysisStages.QUEUED -> stringResource(R.string.analyzer_queued)
                stage != null -> AnalysisStages.DEFAULT_LABELS[stage.id] ?: stage.label.ifBlank { stage.id }
                else -> stringResource(R.string.analyzer_working)
            },
            style = MaterialTheme.typography.titleSmall,
            color = Palette.Ink,
        )
        LinearProgressIndicator(
            progress = { progress },
            color = Palette.Ink,
            trackColor = Palette.Hairline,
            modifier = Modifier.fillMaxWidth().semantics { stateDescription = "$percent%" },
        )
        StatusText(
            if (stage != null && stage.count > 0) stringResource(R.string.analyzer_progress_stage, percent, stage.index + 1, stage.count)
            else stringResource(R.string.analyzer_progress, percent),
        )
        AnalyzerActivity(status)
        note?.let { StatusText(it) }
        if (connectionLost) {
            Column(
                Modifier.fillMaxWidth().background(Palette.Raised, RoundedCornerShape(Radius.panel)).padding(Space.m),
                verticalArrangement = Arrangement.spacedBy(Space.xxs),
            ) {
                Text(stringResource(R.string.analyzer_connection_lost), style = MaterialTheme.typography.titleSmall, color = Palette.Ink)
                lastFailure?.let { StatusText(AnalyzerMessages.describe(it)) }
                StatusText(stringResource(R.string.analyzer_connection_lost_detail))
            }
        }
        Checklist(StageChecklist.rows(status))
        if (onCancel != null) {
            LineButton(stringResource(if (cancelling) R.string.analyzer_cancelling else R.string.analyzer_cancel), onClick = onCancel, enabled = !cancelling)
        }
    }
}

/** Telemetry phase id → what the person reads. An id this build does not know shows nothing rather than a code. */
private val PHASE_NAMES: Map<String, Int> = mapOf(
    "ACQUIRE_PAGE" to R.string.analyzer_phase_acquire_page,
    "ACQUIRE_ASSETS" to R.string.analyzer_phase_acquire_assets,
    "CLASSIFY" to R.string.analyzer_phase_classify,
    "OBSERVE_ASSETS" to R.string.analyzer_phase_observe_assets,
    "DECODE_RASTERS" to R.string.analyzer_phase_decode_rasters,
    "METRIC_FRAMES" to R.string.analyzer_phase_metric_frames,
    "REGISTER_VIEWS" to R.string.analyzer_phase_register_views,
    "PLAN_RESOLUTION" to R.string.analyzer_phase_plan_resolution,
    "SOLVE_TOPOLOGY" to R.string.analyzer_phase_solve_topology,
    "SOLVE_METRICS" to R.string.analyzer_phase_solve_metrics,
    "BUILD_MODEL" to R.string.analyzer_phase_build_model,
    "COMPILE_SCENE" to R.string.analyzer_phase_compile_scene,
    "VERIFY" to R.string.analyzer_phase_verify,
)

/**
 * What the analyzer is doing inside its stage (005A): the phase in words, the
 * real count ("arkusz 3 z 10"), the step inside it, how long this step has
 * run, and — when the counts stop moving or the analyzer stops answering —
 * which of those it is. Nothing here is estimated: every number is one the
 * analyzer sent, and every duration is measured on this phone.
 */
@Composable
private fun AnalyzerActivity(status: JobStatus?) {
    val activity = status?.activity ?: return
    val phase = PHASE_NAMES[activity.phaseId] ?: return
    val tracker = remember(status.jobId) { LivenessTracker() }
    LaunchedEffect(status) { tracker.observe(status, SystemClock.elapsedRealtime()) }
    // A clock for the "N s" lines: they move each second even when no event arrives.
    val now by produceState(SystemClock.elapsedRealtime()) {
        while (true) {
            value = SystemClock.elapsedRealtime()
            delay(1_000)
        }
    }
    val resources = LocalContext.current.resources
    fun count(done: Int?, total: Int?, res: Int): String? = if (done != null && total != null && total > 0) resources.getString(res, done.coerceIn(1, total), total) else null
    val counted = when (activity.unit) {
        "FRAME" -> count(activity.assetIndex, activity.assetTotal, R.string.analyzer_count_frame)
        "ASSET" -> count(activity.assetIndex ?: (activity.workDone + 1).toInt(), activity.assetTotal ?: activity.workTotal?.toInt(), R.string.analyzer_count_asset)
        "ADDRESS" -> count((activity.workDone + 1).toInt(), activity.workTotal?.toInt(), R.string.analyzer_count_address)
        "CANDIDATE" -> count(activity.candidateIndex, activity.candidateTotal, R.string.analyzer_count_candidate)
        else -> null
    }
    val counters = activity.diagnosticCounters
    val step = when (activity.subphaseId) {
        "OCR" -> count(counters["tokenGroups"]?.toInt(), counters["tokenGroupsTotal"]?.toInt(), R.string.analyzer_step_ocr)
        "OCR_LATTICE" -> count(counters["label"]?.toInt(), counters["labelsTotal"]?.toInt(), R.string.analyzer_step_ocr_lattice)
        // 005H: the external recogniser reading the same labels in its worker
        "OCR_EXTERNAL" -> count(counters["label"]?.toInt(), counters["labelsTotal"]?.toInt(), R.string.analyzer_step_ocr_external)
        "CALLOUT_RINGS" -> count(counters["rings"]?.toInt(), counters["ringsTotal"]?.toInt(), R.string.analyzer_step_callouts)
        "CAMERAS" -> count(counters["cameras"]?.toInt(), counters["camerasTotal"]?.toInt(), R.string.analyzer_step_cameras)
        "ORIENTATION" -> count(counters["chains"]?.toInt(), counters["chainsTotal"]?.toInt(), R.string.analyzer_step_orientation)
        "SCALE" -> count(counters["hypothesis"]?.toInt(), counters["hypothesesTotal"]?.toInt(), R.string.analyzer_step_scale)
        "EXTENT" -> count(counters["extent"]?.toInt(), counters["extentsTotal"]?.toInt(), R.string.analyzer_step_extent)
        "BOUNDARY" -> count(counters["lines"]?.toInt(), counters["linesTotal"]?.toInt(), R.string.analyzer_step_boundary)
        "BOUNDARY_GAPS" -> count(counters["gaps"]?.toInt(), counters["gapsTotal"]?.toInt(), R.string.analyzer_step_boundary_gaps)
        else -> null
    }
    Column(verticalArrangement = Arrangement.spacedBy(Space.xxs)) {
        Text(
            listOfNotNull(stringResource(phase), counted).joinToString(" · "),
            style = MaterialTheme.typography.bodyMedium,
            color = Palette.Ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        step?.let { StatusText(it, maxLines = 1) }
        tracker.stepElapsedMs(now)?.let { ms -> StatusText(stringResource(R.string.analyzer_step_elapsed, stepDuration(ms)), maxLines = 1) }
        val verdict = tracker.verdict(now)
        // The last sign of life, counted on this phone; a silence long enough to matter has its own card below.
        if (verdict !is Liveness.NoResponse) tracker.sinceHeartbeatMs(now)?.let { ms -> StatusText(stringResource(R.string.analyzer_last_activity, (ms / 1000).toInt()), maxLines = 1) }
        when (verdict) {
            is Liveness.HeavyStep -> StatusText(stringResource(R.string.analyzer_liveness_heavy), modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = Palette.Ink)
            is Liveness.Waiting -> StatusText(stringResource(R.string.analyzer_liveness_waiting, (verdict.forMs / 1000).toInt()), modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }, color = Palette.Ink)
            is Liveness.NoResponse -> Column(
                Modifier.fillMaxWidth().background(Palette.Raised, RoundedCornerShape(Radius.panel)).padding(Space.m).semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
                verticalArrangement = Arrangement.spacedBy(Space.xxs),
            ) {
                Text(stringResource(R.string.analyzer_liveness_silent, (verdict.silentForMs / 1000).toInt()), style = MaterialTheme.typography.titleSmall, color = Palette.Ink)
                StatusText(stringResource(R.string.analyzer_liveness_silent_hint))
            }
            Liveness.Healthy -> Unit
        }
    }
}

/** "42 s", "1 min 42 s": how long, in the words the progress lines use. */
@Composable
private fun stepDuration(ms: Long): String {
    val seconds = (ms / 1000).coerceAtLeast(0).toInt()
    return if (seconds < 60) stringResource(R.string.analyzer_duration_seconds, seconds)
    else stringResource(R.string.analyzer_duration_minutes, seconds / 60, seconds % 60)
}

@Composable
private fun Checklist(rows: List<StageRow>) {
    Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
        for (row in rows) {
            val stateWord = stringResource(
                when (row.state) {
                    StageState.PENDING -> R.string.analyzer_state_pending
                    StageState.RUNNING -> R.string.analyzer_state_running
                    StageState.DONE -> R.string.analyzer_state_done
                    StageState.FAILED -> R.string.analyzer_state_failed
                    StageState.CANCELLED -> R.string.analyzer_state_cancelled
                },
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.m),
                modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) { stateDescription = stateWord },
            ) {
                Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                    when (row.state) {
                        StageState.DONE -> Icon(ShellIcons.check, null, tint = Palette.Ink, modifier = Modifier.size(18.dp))
                        StageState.RUNNING -> CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = Palette.Ink)
                        StageState.FAILED -> Icon(ShellIcons.caution, null, tint = Palette.Error, modifier = Modifier.size(18.dp))
                        StageState.CANCELLED -> Icon(ShellIcons.close, null, tint = Palette.InkMuted, modifier = Modifier.size(18.dp))
                        StageState.PENDING -> Box(Modifier.size(10.dp).border(1.2.dp, Palette.RuleEmpty, CircleShape))
                    }
                }
                Text(
                    row.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (row.state == StageState.PENDING) Palette.InkMuted else Palette.Ink,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Failure(
    failure: AnalyzerFailure,
    retry: RetryAction,
    status: JobStatus?,
    local: LocalRunReport?,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
    onShare: (() -> Unit)?,
) {
    val failed = failure as? AnalyzerFailure.JobFailed
    val details = failed?.details
    var open by rememberSaveable { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    Column(verticalArrangement = Arrangement.spacedBy(Space.s)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
            Icon(ShellIcons.caution, null, tint = Palette.Error, modifier = Modifier.size(Sizes.iconSmall))
            Text(
                AnalyzerMessages.title(failure),
                style = MaterialTheme.typography.titleMedium,
                color = Palette.Ink,
                modifier = Modifier.semantics { heading(); liveRegion = LiveRegionMode.Polite },
            )
        }
        Text(AnalyzerMessages.describe(failure), style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
        details?.stoppedAt()?.let { DataRow(stringResource(R.string.analyzer_stopped_at), it) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s), verticalArrangement = Arrangement.spacedBy(Space.s)) {
            if (retry != RetryAction.NONE) {
                InkButton(stringResource(if (retry == RetryAction.REFINISH) R.string.analyzer_download_again else R.string.analyzer_retry), onClick = onRetry)
            }
            LineButton(stringResource(R.string.analyzer_dismiss), onClick = onDismiss)
        }
        Foldout(stringResource(R.string.analyzer_details), open, onToggle = { open = !open }) {
            if (failed != null) {
                DataRow(stringResource(R.string.analyzer_code), failed.diagnosticCode)
                Body(failed.message)
                details?.countLines()?.forEach { Body("· $it") }
                details?.detailLines()?.takeIf { it.isNotEmpty() }?.let { lines ->
                    Column(Modifier.fillMaxWidth().background(Palette.Raised, RoundedCornerShape(Radius.control)).padding(Space.m)) {
                        for (line in lines) Mono(line)
                    }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                    val copyLabel = stringResource(R.string.analyzer_copy_code_description, failed.diagnosticCode)
                    TextButton(
                        onClick = { clipboard.setText(AnnotatedString(failed.diagnosticCode)) },
                        modifier = Modifier.heightIn(min = Sizes.touch).semantics { contentDescription = copyLabel },
                    ) { Text(stringResource(R.string.analyzer_copy_code), color = Palette.Ink) }
                    if (onShare != null) {
                        TextButton(onClick = onShare, modifier = Modifier.heightIn(min = Sizes.touch)) { Text(stringResource(R.string.analyzer_share_diagnostics), color = Palette.Ink) }
                    }
                }
            }
            local?.let { LocalCost(it) }
            status?.let { Checklist(StageChecklist.rows(it)) }
        }
    }
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

@Composable
private fun Result(summary: AnalysisSummary, entry: DownloadedSceneEntry, local: LocalRunReport?, onOpen: () -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    val limited = summary.unresolved.isNotEmpty() || summary.limitingWarnings.isNotEmpty()
    Column(verticalArrangement = Arrangement.spacedBy(Space.s)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
            Icon(if (limited) ShellIcons.caution else ShellIcons.check, null, tint = Palette.Ink, modifier = Modifier.size(Sizes.iconSmall))
            Text(
                stringResource(if (limited) R.string.analyzer_result_limited else R.string.analyzer_result_ready),
                style = MaterialTheme.typography.titleMedium,
                color = Palette.Ink,
                // The end of a job minutes long is said as it happens, not found later (cycle 3, C3-06).
                modifier = Modifier.semantics { heading(); liveRegion = LiveRegionMode.Polite },
            )
        }
        Text(summary.title.ifBlank { entry.title }, style = MaterialTheme.typography.bodyLarge, color = Palette.Ink)
        val c = summary.counts
        Body(
            stringResource(
                R.string.analyzer_result_found,
                pluralStringResource(R.plurals.count_masses, c.masses, c.masses),
                pluralStringResource(R.plurals.count_openings, c.openings, c.openings),
                pluralStringResource(R.plurals.count_rooms, c.rooms, c.rooms),
            ),
        )
        if (limited) {
            Body(
                listOfNotNull(
                    summary.unresolved.size.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.count_unresolved, it, it) },
                    summary.limitingWarnings.size.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.count_warnings, it, it) },
                ).joinToString(" · "),
            )
            Body(stringResource(R.string.analyzer_result_limited_body))
        }
        InkButton(stringResource(R.string.house_open_3d), onClick = onOpen, icon = ShellIcons.cube, modifier = Modifier.fillMaxWidth())
        Foldout(stringResource(R.string.analyzer_details), open, onToggle = { open = !open }) {
            AnalysisDiagnostics(summary)
            local?.let { LocalCost(it) }
        }
    }
}

/** Every diagnostic as labelled rows. Never raw JSON. Shared with the source sheet. */
@Composable
internal fun AnalysisDiagnostics(summary: AnalysisSummary) {
    Column(verticalArrangement = Arrangement.spacedBy(Space.m)) {
        Section(stringResource(R.string.analyzer_unresolved)) {
            if (summary.unresolved.isEmpty()) Body(stringResource(R.string.analyzer_none))
            for (u in summary.unresolved) {
                Column(Modifier.padding(bottom = Space.xs)) {
                    Text(u.what, style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
                    StatusText(if (u.status.isBlank()) u.reason else "${u.reason} (${u.status.lowercase().replace('_', ' ')})")
                }
            }
        }
        Section(stringResource(R.string.analyzer_warnings)) {
            if (summary.warnings.isEmpty()) Body(stringResource(R.string.analyzer_none))
            for (w in summary.warnings) Body("· $w")
        }
        Section(stringResource(R.string.analyzer_levels)) {
            DataRow("L0", "${summary.quality.levels.l0}")
            DataRow("L1", "${summary.quality.levels.l1}")
            DataRow("L2", "${summary.quality.levels.l2}")
            StatusText(stringResource(R.string.analyzer_levels_explained))
            StatusText(visionText(summary))
        }
        Section(stringResource(R.string.analyzer_counts)) {
            val c = summary.counts
            DataRow(stringResource(R.string.analyzer_count_drawings), "${c.assets}")
            for ((document, n) in c.assetsByDocument.toSortedMap()) DataRow("  $document", "$n")
            DataRow(stringResource(R.string.analyzer_count_masses), "${c.masses}")
            DataRow(stringResource(R.string.analyzer_count_openings), "${c.openings}")
            DataRow(stringResource(R.string.analyzer_count_rooms), "${c.rooms}")
            DataRow(stringResource(R.string.analyzer_count_balconies), "${c.balconies}")
            DataRow(stringResource(R.string.analyzer_count_terraces), "${c.terraces}")
            DataRow(stringResource(R.string.analyzer_count_railings), "${c.railings}")
            DataRow(stringResource(R.string.analyzer_count_chimneys), "${c.chimneys}")
            DataRow(stringResource(R.string.analyzer_count_rooflights), "${c.rooflights}")
            DataRow("observations · frames · metric evidence · callouts", "${c.observations} · ${c.frames} · ${c.metricEvidence} · ${c.callouts}")
            DataRow("commands · meshes · triangles", "${c.commands} · ${c.meshes} · ${c.triangles}")
        }
        Section(stringResource(R.string.analyzer_checks)) {
            val v = summary.verification
            DataRow("replay", if (v.replay == "BYTE_IDENTICAL") "byte-identical" else v.replay.lowercase().replace('_', ' '))
            DataRow("source-view checks outside tolerance", "${v.residualsOutsideTolerance} / ${v.residuals}")
            DataRow("exterior joint errors · findings", "${v.closure.exteriorErrors} · ${v.closure.exteriorFindings}")
            DataRow("interior closure findings", "${v.closure.interiorFindings}")
            if (summary.vision.mode == "LIVE_PROVIDER") DataRow("vision readings accepted", "${summary.vision.accepted} / ${summary.vision.attempted}")
        }
        Section(stringResource(R.string.analyzer_source)) {
            DataRow(stringResource(R.string.analyzer_publisher), summary.publisher)
            DataRow(stringResource(R.string.analyzer_page), summary.canonicalUrl.ifBlank { summary.sourceUrl })
            DataRow("adapter", listOf(summary.adapter.id, summary.adapter.version).filter { it.isNotBlank() }.joinToString(" "))
            DataRow("analyzer", "service ${summary.analyzer.service} · solver ${summary.analyzer.solver}")
            DataRow(stringResource(R.string.analyzer_started), summary.startedAt)
            DataRow(stringResource(R.string.analyzer_completed), summary.completedAt)
        }
        Section(stringResource(R.string.analyzer_hashes)) {
            HashRow("source package", summary.sourcePackageHash)
            HashRow("observation graph", summary.observationGraphHash)
            HashRow("metric evidence", summary.metricEvidenceHash)
            HashRow("candidate", summary.candidateHash)
            HashRow("model", summary.modelHash)
            HashRow("model file (sha256)", summary.modelSha256)
            HashRow("scene content", summary.sceneContentHash)
            HashRow("scene file (sha256)", summary.sceneSha256)
        }
    }
}

private fun visionText(summary: AnalysisSummary): String = when (summary.vision.mode) {
    "LIVE_PROVIDER" -> "vision provider: ${summary.vision.provider ?: "—"}"
    "REPLAYED_GRAPH" -> "replayed observation graph, no vision provider"
    else -> "deterministic analyzer, no vision provider"
}

// ---------------------------------------------------------------------------
// What a local run cost
// ---------------------------------------------------------------------------

/** The numbers the owner reads off the phone: status, total time, peak memory, scene size. */
@Composable
private fun LocalCost(report: LocalRunReport) {
    Section(stringResource(R.string.analyzer_local_run)) {
        DataRow(stringResource(R.string.analyzer_status), outcomeText(report))
        DataRow(stringResource(R.string.analyzer_total_time), duration(report.timings?.totalMs ?: report.elapsedMs))
        DataRow(stringResource(R.string.analyzer_peak_memory), report.peakRssBytes?.let { megabytes(it) } ?: "—")
        report.sceneBytes?.let { DataRow(stringResource(R.string.analyzer_scene_size), megabytes(it, decimals = 2)) }
        DataRow("runtime", runtimeText(report))
        report.timings?.let { t ->
            DataRow("acquisition · observation · metrics", "${duration(t.acquisitionMs)} · ${duration(t.observationMs)} · ${duration(t.metricExtractionMs)}")
            DataRow("reconstruction · compile · verify", "${duration(t.reconstructionMs)} · ${duration(t.compileMs)} · ${duration(t.verificationMs)}")
        }
    }
}

@Composable
private fun LocalRuns(runs: List<LocalRunReport>) {
    Section(stringResource(R.string.analyzer_local_runs)) {
        for (run in runs) {
            Column(Modifier.padding(bottom = Space.s)) {
                Text("${outcomeText(run)} · ${hostOf(run.sourceUrl)}", style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
                StatusText(
                    listOfNotNull(
                        RUN_DATE.format(Date(run.startedAtMs)),
                        duration(run.timings?.totalMs ?: run.elapsedMs),
                        run.peakRssBytes?.let { megabytes(it) },
                        run.abi.ifBlank { null },
                    ).joinToString(" · "),
                )
            }
        }
    }
}

private val RUN_DATE = SimpleDateFormat("d MMM yyyy, HH:mm", PRODUCT_LOCALE)

/**
 * 005H: the OCR parity self-test, for the owner — the recogniser the analysis uses, run over a synthetic corpus on this
 * phone, and whether it read it exactly as the desktop did. The record can be copied and sent as text.
 */
@Composable
private fun OcrSelfTestRow(model: AnalyzerViewModel) {
    val clipboard = LocalClipboardManager.current
    Section(stringResource(R.string.analyzer_selftest_title)) {
        Body(stringResource(R.string.analyzer_selftest_body))
        when (val s = model.ocrSelfTest) {
            is OcrSelfTestState.Running -> {
                StatusText(if (s.total > 0) stringResource(R.string.analyzer_selftest_running, s.done.coerceIn(0, s.total), s.total) else stringResource(R.string.analyzer_selftest_preparing), maxLines = 1)
                LineButton(stringResource(R.string.analyzer_cancel), onClick = { model.cancelOcrSelfTest() })
            }
            is OcrSelfTestState.Done -> {
                val verdict = when (s.parity) {
                    "MATCH" -> stringResource(R.string.analyzer_selftest_match)
                    "CORPUS_DIFFERS" -> stringResource(R.string.analyzer_selftest_corpus_differs)
                    else -> stringResource(R.string.analyzer_selftest_mismatch)
                }
                Text(verdict, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                DataRow(stringResource(R.string.analyzer_selftest_exact), "${s.exact} / ${s.labels}")
                DataRow(stringResource(R.string.analyzer_selftest_output), s.outputSha256.take(16))
                DataRow(stringResource(R.string.analyzer_selftest_corpus), s.corpusSha256.take(16))
                DataRow(stringResource(R.string.analyzer_selftest_model), "${s.recogniser} · ${s.modelSha256.take(12)}")
                DataRow("WASM", s.wasmSha256.take(12))
                DataRow(stringResource(R.string.analyzer_selftest_time), "${duration(s.totalMs)} · ${s.perLabelMeanMs} ms")
                DataRow(stringResource(R.string.analyzer_peak_memory), megabytes(s.peakRssBytes))
                LineButton(stringResource(R.string.analyzer_selftest_copy), onClick = { clipboard.setText(AnnotatedString(s.shareText)) })
                LineButton(stringResource(R.string.analyzer_selftest_again), onClick = { model.runOcrSelfTest() }, enabled = !model.isRunning)
            }
            is OcrSelfTestState.Failed -> {
                val why = stringResource(
                    when (s.reason) {
                        OcrSelfTestState.Reason.PREPARE_FAILED -> R.string.analyzer_selftest_failed_prepare
                        OcrSelfTestState.Reason.CANCELLED -> R.string.analyzer_selftest_failed_cancelled
                        OcrSelfTestState.Reason.START_FAILED -> R.string.analyzer_selftest_failed_start
                        OcrSelfTestState.Reason.EXITED -> R.string.analyzer_selftest_failed_exited
                        OcrSelfTestState.Reason.PROCESS_STOPPED -> R.string.analyzer_selftest_failed_stopped
                        OcrSelfTestState.Reason.TEST_FAILED -> R.string.analyzer_selftest_failed_program
                    },
                )
                StatusText(stringResource(R.string.analyzer_selftest_failed, if (s.detail != null) "$why (${s.detail})" else why), maxLines = 3)
                LineButton(stringResource(R.string.analyzer_selftest_run), onClick = { model.runOcrSelfTest() }, enabled = !model.isRunning)
            }
            OcrSelfTestState.Idle -> LineButton(stringResource(R.string.analyzer_selftest_run), onClick = { model.runOcrSelfTest() }, enabled = !model.isRunning)
        }
    }
}

@Composable
private fun outcomeText(report: LocalRunReport): String = when (report.outcome) {
    LocalRunReport.OUTCOME_COMPLETED -> stringResource(R.string.analyzer_outcome_completed)
    LocalRunReport.OUTCOME_CANCELLED -> stringResource(R.string.analyzer_outcome_cancelled)
    LocalRunReport.OUTCOME_FAILED -> stringResource(R.string.analyzer_outcome_failed, report.code ?: "?")
    LocalRunReport.OUTCOME_INTERRUPTED -> stringResource(R.string.analyzer_outcome_interrupted)
    else -> stringResource(R.string.analyzer_outcome_running)
}

private fun runtimeText(report: LocalRunReport): String {
    val node = report.runtime?.node ?: "v${NodeRuntime.NODE_VERSION}"
    return "${NodeRuntime.RUNTIME} $node · ${report.abi.ifBlank { report.runtime?.arch ?: "?" }}"
}

private fun duration(ms: Long): String {
    val seconds = ms / 1000.0
    return if (seconds < 60) String.format(PRODUCT_LOCALE, "%.1f s", seconds) else "${ms / 60_000} min ${(ms / 1000) % 60} s"
}

private fun megabytes(bytes: Long, decimals: Int = 0): String =
    String.format(PRODUCT_LOCALE, "%.${decimals}f MB", bytes / (1024.0 * 1024.0))

// ---------------------------------------------------------------------------
// Analyses kept on this phone
// ---------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

/** A folded section: its title is the button, its state is said in words. */
@Composable
private fun Foldout(title: String, open: Boolean, onToggle: () -> Unit, content: @Composable () -> Unit) {
    val state = stringResource(if (open) R.string.state_expanded else R.string.state_collapsed)
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().padding(top = Space.s).height(1.dp).background(Palette.Hairline))
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = Sizes.touch)
                .clickable(role = Role.Button, onClick = onToggle)
                .semantics(mergeDescendants = true) { stateDescription = state },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, modifier = Modifier.weight(1f))
            Icon(ShellIcons.chevronRight, null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall).rotate(if (open) 90f else 0f))
        }
        val motion = LocalMotionPolicy.current
        AnimatedVisibility(visible = open, enter = motion.foldEnter(), exit = motion.foldExit()) {
            Column(Modifier.fillMaxWidth().padding(bottom = Space.s), verticalArrangement = Arrangement.spacedBy(Space.m)) { content() }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
        Text(title, style = MaterialTheme.typography.labelLarge, color = Palette.InkMuted, modifier = Modifier.semantics { heading() })
        content()
    }
}

@Composable
private fun DataRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}, horizontalArrangement = Arrangement.spacedBy(Space.m)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodySmall, color = Palette.Ink)
    }
}

@Composable
private fun HashRow(label: String, value: String) {
    Column(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
        Mono(value.ifBlank { "—" })
    }
}

/** Monospace only for what is code: hashes and raw diagnostic lines. */
@Composable
private fun Mono(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace, color = Palette.InkMuted)
}

@Composable
private fun Body(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Palette.Ink,
    unfocusedBorderColor = Palette.RuleEmpty,
    focusedLabelColor = Palette.Ink,
    cursorColor = Palette.Ink,
)

private fun hostOf(url: String): String = try {
    URI(url).host ?: url
} catch (e: java.net.URISyntaxException) {
    url
}

private const val NOTICE_MS = 6_000L

/** A running analysis never reads 100 %: that belongs to the finished record. */
private const val RUNNING_PROGRESS_MAX = 0.99
