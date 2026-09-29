package com.buildplan.preview.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.buildplan.preview.PRODUCT_LOCALE
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.progress.ProgressAvailability
import com.buildplan.preview.progress.ProgressView
import com.buildplan.preview.progress.StageProgressMetric
import com.buildplan.preview.scene.DownloadedSceneEntry
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneSourceKind
import kotlin.math.roundToInt

/**
 * `Dom`: which house, where it stands, and the way into it.
 *
 * In reading order: the house's name and where its model came from (with its
 * limitations named, never smoothed over); the house itself, as a drawing
 * inked by the owner's progress; the one big figure — "Postęp wg etapów",
 * read off the folding rule beneath it; the current stage and what is being
 * done now; then one filled action, into 3D. Everything else is quieter: the
 * stages, adding a house from a link, the houses on this phone (a sheet
 * behind the house's name), and the technical data at the very end.
 *
 * No invented figure appears here: with nothing recorded, the progress block
 * says "Postęp nieustawiony" and offers to set it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HouseScreen(
    preview: PreviewViewModel,
    analyzer: AnalyzerViewModel,
    progress: ProgressViewModel,
    onOpenModel: () -> Unit,
    onAnalyze: () -> Unit,
    onOpenStages: () -> Unit,
) {
    var housesOpen by rememberSaveable { mutableStateOf(false) }
    BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding(), contentAlignment = Alignment.TopCenter) {
        // A phone on its side, or a wide window: the drawing on one side, the house's words on the
        // other — never a portrait column stretched across, with the figure below the fold.
        val twoPane = maxWidth >= TWO_PANE_WIDTH && maxWidth > maxHeight
        val screen = preview.screen
        // A column that continues below the places bar fades out at its edge, so it never looks complete.
        val scroll = rememberScrollState()
        if (twoPane && screen is ScreenState.Ready) {
            val drawingHeight = maxHeight - Space.l * 2
            Row(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f).fillMaxHeight().padding(Space.l), contentAlignment = Alignment.Center) {
                    Drawing(screen.scene, progress, onOpenModel, drawingHeight)
                }
                // The words scroll; the one filled action stays in view under them (finish review, F-05).
                Column(Modifier.weight(1f).fillMaxHeight().padding(end = Space.l)) {
                    Column(
                        Modifier
                            .weight(1f)
                            .fadeBelowFold(scroll, Palette.Ground)
                            .verticalScroll(scroll)
                            .padding(bottom = Space.l),
                    ) {
                        Words(screen.scene, preview, analyzer, progress, onOpenModel, onAnalyze, onOpenStages, onHouses = { housesOpen = true }, openInline = false)
                    }
                    OpenInThreeD(onOpenModel, Modifier.padding(top = Space.s, bottom = Space.m))
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .widthIn(max = Sizes.contentMax)
                    .fillMaxSize()
                    .fadeBelowFold(scroll, Palette.Ground)
                    .verticalScroll(scroll)
                    .padding(horizontal = Space.l)
                    .padding(bottom = Space.xl),
            ) {
                when (screen) {
                    is ScreenState.Loading -> Loading()
                    is ScreenState.Failed -> Failed(screen, onAnalyze)
                    is ScreenState.Ready -> {
                        Words(screen.scene, preview, analyzer, progress, onOpenModel, onAnalyze, onOpenStages, onHouses = { housesOpen = true }) {
                            Drawing(screen.scene, progress, onOpenModel, DRAWING_HEIGHT, Modifier.padding(top = Space.s))
                        }
                    }
                }
            }
        }
    }

    if (housesOpen) {
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { housesOpen = false },
            sheetState = sheet,
            containerColor = Palette.Sheet,
            contentColor = Palette.Ink,
        ) {
            HousesSheet(
                preview = preview,
                analyzer = analyzer,
                onPick = { preview.open(it); housesOpen = false },
                onAdd = { housesOpen = false; onAnalyze() },
            )
        }
    }
}

/** The house as a line drawing, inked by the owner's progress. */
@Composable
private fun Drawing(scene: ModelScene, progress: ProgressViewModel, onOpenModel: () -> Unit, height: Dp, modifier: Modifier = Modifier) {
    val view = progress.view
    val session = progress.session
    val current = view?.summary?.currentStage
    HouseDrawing(
        sketch = progress.sketch,
        built = if (view == null || view.summary.unset) null else session?.actualVisible,
        current = current?.let { session?.introducedAt(it) }.orEmpty(),
        description = stringResource(R.string.house_drawing_description, scene.title),
        onOpen = onOpenModel,
        modifier = modifier,
        height = height,
    )
}

/**
 * The house in words: its name and source, then (in one column) the drawing,
 * the progress, the analysis line and the ways on.
 */
@Composable
private fun Words(
    scene: ModelScene,
    preview: PreviewViewModel,
    analyzer: AnalyzerViewModel,
    progress: ProgressViewModel,
    onOpenModel: () -> Unit,
    onAnalyze: () -> Unit,
    onOpenStages: () -> Unit,
    onHouses: () -> Unit,
    /** Whether "Otwórz w 3D" follows the words; a two-pane layout keeps it outside the scroll instead. */
    openInline: Boolean = true,
    drawing: @Composable () -> Unit = {},
) {
    val entry = preview.scenes.firstOrNull { it.key == scene.key }
    val download = analyzer.downloads.firstOrNull { it.key == scene.key }
    // The list of what the analysis left open lives only in the analyzer's latest result (the phone keeps
    // the counts): Dom links to it only while that result is this house's (cycle 3, C3-03).
    val resultShown = (analyzer.state as? AnalysisState.Completed)?.entry?.key == scene.key
    Identity(
        title = scene.title,
        source = entry?.source ?: SceneSourceKind.BUNDLED,
        download = download,
        houseCount = preview.scenes.size,
        onHouses = onHouses,
        onAnalysis = onAnalyze.takeIf { resultShown },
    )
    drawing()
    progress.view?.let { ProgressBlock(it, onOpenStages) }
    AnalysisLine(analyzer, onAnalyze)
    if (openInline) OpenInThreeD(onOpenModel, Modifier.padding(top = Space.l))
    // Etapy is one tap away already (the tab, the current stage above); adding a house is
    // a second-order way on — for a new link, not a co-equal button on every visit.
    QuietAction(stringResource(R.string.house_add_action), onClick = onAnalyze, icon = ShellIcons.link, modifier = Modifier.padding(top = Space.s))
    Diagnostics(preview, onAnalyze)
}

/** The one filled action of Dom. */
@Composable
private fun OpenInThreeD(onOpenModel: () -> Unit, modifier: Modifier = Modifier) {
    InkButton(
        text = stringResource(R.string.house_open_3d),
        icon = ShellIcons.cube,
        onClick = onOpenModel,
        modifier = modifier.fillMaxWidth(),
    )
}

/** From this width, a window wider than tall shows Dom in two panes. */
private val TWO_PANE_WIDTH = 600.dp

/** The drawing's height in one column. */
private val DRAWING_HEIGHT = 232.dp

@Composable
private fun Loading() {
    Column(Modifier.padding(top = Space.xxl), verticalArrangement = Arrangement.spacedBy(Space.m)) {
        Text(stringResource(R.string.house_loading), style = MaterialTheme.typography.titleMedium, color = Palette.Ink)
        LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Palette.InkMuted, trackColor = Palette.Hairline)
    }
}

@Composable
private fun Failed(failed: ScreenState.Failed, onAnalyze: () -> Unit) {
    Column(Modifier.padding(top = Space.xxl), verticalArrangement = Arrangement.spacedBy(Space.m)) {
        Text(stringResource(R.string.house_failed), style = MaterialTheme.typography.titleMedium, color = Palette.Ink)
        LoadProblem(failed.problem, failed.message)
        LineButton(stringResource(R.string.house_add_action), onClick = onAnalyze, icon = ShellIcons.link)
    }
}

/** The house's name, and where its model came from — limitations said in words. */
@Composable
private fun Identity(
    title: String,
    source: SceneSourceKind,
    download: DownloadedSceneEntry?,
    houseCount: Int,
    onHouses: () -> Unit,
    onAnalysis: (() -> Unit)?,
) {
    Row(Modifier.fillMaxWidth().padding(top = Space.l), verticalAlignment = Alignment.CenterVertically) {
        Text(
            title,
            style = MaterialTheme.typography.headlineSmall,
            color = Palette.Ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        val housesLabel = stringResource(R.string.house_switch_description, houseCount)
        IconButton(onClick = onHouses, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = housesLabel }) {
            Icon(ShellIcons.houses, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.icon))
        }
    }
    val limited = download != null && (download.unresolvedCount > 0 || download.warningsCount > 0)
    val linked = limited && onAnalysis != null
    val status = when {
        source != SceneSourceKind.DOWNLOADED -> stringResource(R.string.house_status_bundled)
        limited -> stringResource(R.string.house_status_limited)
        else -> stringResource(R.string.house_status_ready)
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = if (linked) Sizes.touch else 0.dp)
            .then(if (linked && onAnalysis != null) Modifier.clickable(role = Role.Button, onClick = onAnalysis) else Modifier),
    ) {
        if (limited) Icon(ShellIcons.caution, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        Column(Modifier.weight(1f)) {
            Text(status, style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
            if (limited && download != null) {
                val unresolved = pluralStringResource(R.plurals.count_unresolved, download.unresolvedCount, download.unresolvedCount)
                Text(
                    when {
                        download.unresolvedCount > 0 && linked -> stringResource(R.string.house_status_limited_detail, unresolved)
                        download.unresolvedCount > 0 -> stringResource(R.string.house_status_limited_kept, unresolved)
                        linked -> stringResource(R.string.house_status_warnings_detail)
                        else -> stringResource(R.string.house_status_warnings_kept)
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = Palette.InkMuted,
                )
            }
        }
        if (linked) Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
    }
}

/** The one big figure, read off the rule, then the current stage and what is being done now. */
@Composable
private fun ProgressBlock(view: ProgressView, onOpenStages: () -> Unit) {
    val percent = view.summary.percent
    Column(Modifier.fillMaxWidth().padding(top = Space.l)) {
        // A record set aside or written by a newer app is said here too, not only in Etapy (cycle 3, C3-04).
        progressProblemText(view.problem)?.let { ProblemLine(it, Modifier.padding(bottom = Space.s)) }
        if (view.summary.unset || percent == null) UnsetProgress(view, onOpenStages) else RecordedProgress(view, percent, onOpenStages)
    }
}

/** Nothing recorded yet: say so, show the empty rule, and offer the one way to start. */
@Composable
private fun UnsetProgress(view: ProgressView, onOpenStages: () -> Unit) {
    val summary = view.summary
    Text(stringResource(R.string.progress_unset), style = MaterialTheme.typography.titleLarge, color = Palette.Ink, modifier = Modifier.semantics { heading() })
    // A newer app's record is explained by the problem line above; "no stable id" would be the wrong reason.
    when (summary.availability) {
        ProgressAvailability.EDITABLE -> R.string.progress_unset_body
        ProgressAvailability.PREVIEW_ONLY -> R.string.progress_preview_only_body
        ProgressAvailability.READ_ONLY_NEWER_SCHEMA -> null
    }?.let {
        Text(
            stringResource(it),
            style = MaterialTheme.typography.bodyMedium,
            color = Palette.InkMuted,
            modifier = Modifier.padding(top = Space.xs),
        )
    }
    Spacer(Modifier.height(Space.m))
    FoldingRule(view.stages, nowStop = null, previewStop = null, height = RuleDefaults.StaticHeight)
    if (summary.availability == ProgressAvailability.EDITABLE) {
        LineButton(stringResource(R.string.progress_set_action), onClick = onOpenStages, borderColor = Palette.Ink, modifier = Modifier.padding(top = Space.m))
    }
}

/** The recorded state: the percentage by stages, the rule, and what is being built now. */
@Composable
private fun RecordedProgress(view: ProgressView, percent: Int, onOpenStages: () -> Unit) {
    val summary = view.summary
    var explain by rememberSaveable { mutableStateOf(false) }
    val spoken = pluralStringResource(R.plurals.progress_metric_spoken, percent, percent)
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Space.m),
        modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) { stateDescription = spoken },
    ) {
        Text(StageProgressMetric.format(percent), style = Measure.monumental, color = Palette.Ink)
        Column(Modifier.weight(1f).padding(bottom = Space.s)) {
            Text(stringResource(R.string.progress_metric_label), style = MaterialTheme.typography.labelLarge, color = Palette.Ink)
            Text(
                stringResource(R.string.progress_done_of, summary.doneCount, summary.stageCount),
                style = MaterialTheme.typography.bodySmall,
                color = Palette.InkMuted,
            )
        }
    }
    FoldingRule(view.stages, nowStop = view.nowStop, previewStop = null, height = RuleDefaults.StaticHeight, modifier = Modifier.padding(top = Space.xs))
    QuietAction(stringResource(if (explain) R.string.progress_explain_hide else R.string.progress_explain_show), onClick = { explain = !explain })
    AnimatedVisibility(visible = explain) {
        Text(
            stringResource(R.string.progress_explain),
            style = MaterialTheme.typography.bodySmall,
            color = Palette.InkMuted,
            modifier = Modifier.padding(bottom = Space.s),
        )
    }

    // The current stage and what is being done: the way into Etapy, so it says so with a chevron.
    val current = summary.currentStage
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = Space.xs)
            .clickable(role = Role.Button, onClick = onOpenStages)
            .padding(vertical = Space.xs),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Space.xxs)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                val stageNow = view.stages.firstOrNull { it.stageKey == current }
                StageMark(stageNow?.status, stageNow?.completion ?: 0.0)
                Text(
                    when {
                        current != null -> stringResource(R.string.progress_current_stage, stringResource(current.labelRes()))
                        summary.lastDone != null -> stringResource(R.string.progress_last_done, stringResource(summary.lastDone.labelRes()))
                        else -> stringResource(R.string.progress_no_current_stage)
                    },
                    style = MaterialTheme.typography.titleMedium,
                    color = Palette.Ink,
                    modifier = Modifier.weight(1f, fill = false),
                )
                summary.currentStageCompletionPercent?.let {
                    Text(stringResource(R.string.progress_stage_share, StageProgressMetric.format(it)), style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
                }
            }
            Text(
                summary.currentTask?.let { stringResource(R.string.progress_now_doing, it) } ?: stringResource(R.string.progress_task_unset),
                style = MaterialTheme.typography.bodyMedium,
                color = if (summary.currentTask != null) Palette.Ink else Palette.InkMuted,
            )
            summary.savedAtEpochMs?.let {
                Text(stringResource(R.string.progress_saved_on, savedDate(it)), style = MaterialTheme.typography.bodySmall, color = Palette.InkFaint)
            }
        }
        Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
    }
}

/** "28 września 2026": the day the record was last changed, in Polish whatever the phone's language. */
private fun savedDate(epochMs: Long): String =
    java.time.format.DateTimeFormatter.ofPattern("d MMMM yyyy", PRODUCT_LOCALE)
        .format(java.time.Instant.ofEpochMilli(epochMs).atZone(java.time.ZoneId.systemDefault()))

/** A running or failed analysis, said here so the owner never has to open the analyzer to know. */
@Composable
private fun AnalysisLine(analyzer: AnalyzerViewModel, onAnalyze: () -> Unit) {
    val state = analyzer.state
    when {
        analyzer.isRunning -> {
            val fraction = when (state) {
                is AnalysisState.Polling -> state.status?.progress ?: 0.0
                is AnalysisState.Finishing -> state.status.progress
                else -> 0.0
            }.coerceIn(0.0, 1.0).toFloat()
            val percent = (fraction * 100).roundToInt()
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(top = Space.l)
                    .heightIn(min = Sizes.touch)
                    .clickable(role = Role.Button, onClick = onAnalyze)
                    .padding(vertical = Space.xs),
                verticalArrangement = Arrangement.spacedBy(Space.xs),
            ) {
                Text(stringResource(R.string.house_analysis_running_detail, percent), style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
                LinearProgressIndicator(
                    progress = { fraction },
                    color = Palette.InkMuted,
                    trackColor = Palette.Hairline,
                    modifier = Modifier.fillMaxWidth().semantics { stateDescription = "$percent%" },
                )
            }
        }
        state is AnalysisState.Failed -> Row(
            Modifier
                .fillMaxWidth()
                .padding(top = Space.l)
                .heightIn(min = Sizes.touch)
                .clickable(role = Role.Button, onClick = onAnalyze),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.s),
        ) {
            Icon(ShellIcons.caution, contentDescription = null, tint = Palette.Error, modifier = Modifier.size(Sizes.iconSmall))
            Text(stringResource(R.string.house_analysis_failed), style = MaterialTheme.typography.bodyMedium, color = Palette.Ink, modifier = Modifier.weight(1f))
            Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
        else -> Unit
    }
}

@Composable
private fun HousesSheet(preview: PreviewViewModel, analyzer: AnalyzerViewModel, onPick: (com.buildplan.preview.scene.SceneEntry) -> Unit, onAdd: () -> Unit) {
    val openKey = preview.scene?.key
    // Scrolls: seven houses and "Dodaj dom z linku" outgrow a phone on its side.
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = Space.xl)) {
        Text(
            stringResource(R.string.house_saved_heading),
            style = MaterialTheme.typography.titleMedium,
            color = Palette.Ink,
            modifier = Modifier.padding(horizontal = Space.l, vertical = Space.s).semantics { heading() },
        )
        for (entry in preview.scenes) {
            val current = entry.key == openKey
            val download = analyzer.downloads.firstOrNull { it.key == entry.key }
            val limited = download != null && (download.unresolvedCount > 0 || download.warningsCount > 0)
            val stateText = stringResource(if (current) R.string.house_saved_current else R.string.state_not_selected)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clickable(role = Role.RadioButton, onClick = { onPick(entry) })
                    .semantics(mergeDescendants = true) { stateDescription = stateText }
                    .background(if (current) Palette.Well else androidx.compose.ui.graphics.Color.Transparent)
                    .padding(horizontal = Space.l, vertical = Space.s),
                horizontalArrangement = Arrangement.spacedBy(Space.m),
            ) {
                Column(Modifier.weight(1f)) {
                    Text(entry.title, style = MaterialTheme.typography.bodyLarge, color = Palette.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(
                        stringResource(
                            when {
                                entry.source != SceneSourceKind.DOWNLOADED -> R.string.house_status_bundled
                                limited -> R.string.house_status_limited
                                else -> R.string.house_status_ready
                            },
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = Palette.InkMuted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (current) Icon(ShellIcons.check, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
            }
        }
        Box(Modifier.fillMaxWidth().padding(horizontal = Space.l, vertical = Space.s).height(1.dp).background(Palette.Hairline))
        LineButton(stringResource(R.string.house_add_action), onClick = onAdd, icon = ShellIcons.link, modifier = Modifier.padding(horizontal = Space.l))
    }
}

/** The technical figures, folded at the very end: for checking, not for reading. */
@Composable
private fun Diagnostics(preview: PreviewViewModel, onAnalyze: () -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.padding(top = Space.l)) {
        QuietAction(stringResource(if (open) R.string.house_diagnostics_hide else R.string.house_diagnostics_show), onClick = { open = !open })
        if (open) {
            preview.scene?.let { scene ->
                StatusText(
                    stringResource(
                        R.string.house_diagnostics_rows,
                        scene.bundle.generatedFrom.modelSchemaVersion,
                        pluralStringResource(R.plurals.count_objects, scene.objectCount, scene.objectCount),
                        pluralStringResource(R.plurals.count_triangles, scene.triangleCount, scene.triangleCount),
                        scene.bundle.contentHash.take(8),
                    ),
                )
            }
            QuietAction(stringResource(R.string.house_diagnostics_analyzer), onClick = onAnalyze)
        }
    }
}
