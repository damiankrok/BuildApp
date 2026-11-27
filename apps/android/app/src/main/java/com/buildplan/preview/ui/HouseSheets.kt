package com.buildplan.preview.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.PRODUCT_LOCALE
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.scene.DownloadedSceneEntry
import com.buildplan.preview.scene.SceneEntry
import com.buildplan.preview.scene.SceneSourceKind

/**
 * The sheets that stand over the house, one at a time (INTEGRATION-004A):
 * the house menu, the stages, the source. Each is a modal sheet on a scrim
 * that takes the gesture and closes, opaque because it carries dense text,
 * and each returns to the same house at the same camera.
 */

/**
 * The house menu: the houses on this phone (the open one marked), adding a
 * house from a link, and the ways to the other matters of this house —
 * its stages, its source, and the named place where the cost workspace
 * will stand. Nothing here pretends to exist: Koszty is a row that says it
 * is not built yet, never a page.
 *
 * MARCOWKI-UI: the houses are those of ordinary use — the showcase, then the
 * analyses made on this phone. The scenes shipped for development and review
 * (the analyzer's history, failures kept) are one row at the foot, the way to
 * the developer gallery; a gallery scene that is open is listed here too, so
 * the owner always sees which house the workspace shows.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HouseMenuSheet(
    preview: PreviewViewModel,
    analyzer: AnalyzerViewModel,
    onDismiss: () -> Unit,
    onPick: (SceneEntry) -> Unit,
    onAnalyze: () -> Unit,
    onOpenSheet: (Sheet) -> Unit,
) {
    HouseSheet(onDismiss) {
        val openKey = preview.scene?.key
        val menuScroll = rememberScrollState()
        Column(Modifier.fillMaxWidth().fadeBelowFold(menuScroll, Palette.Sheet).verticalScroll(menuScroll).padding(bottom = Space.xl)) {
            PanelGroupLabel(stringResource(R.string.house_saved_heading))
            val openDevelopment = preview.scenes.firstOrNull { it.key == openKey && it.isDevelopment }
            for (entry in preview.houses + listOfNotNull(openDevelopment)) {
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
                            when {
                                entry.showcase -> entry.subtitle
                                entry.isDevelopment -> stringResource(R.string.house_status_development)
                                else -> stringResource(statusRes(entry.source, limited))
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = Palette.InkMuted,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (current) Icon(ShellIcons.check, contentDescription = null, tint = Palette.Accent, modifier = Modifier.size(Sizes.icon))
                }
            }
            LineButton(stringResource(R.string.house_add_action), onClick = onAnalyze, icon = ShellIcons.link, modifier = Modifier.padding(horizontal = Space.l, vertical = Space.s))
            PanelRule()
            PanelGroupLabel(stringResource(R.string.menu_this_house))
            MenuRow(ShellIcons.stages, stringResource(R.string.stages_title), onClick = { onOpenSheet(Sheet.STAGES) })
            MenuRow(ShellIcons.page, stringResource(R.string.menu_source), onClick = { onOpenSheet(Sheet.SOURCE) })
            // The cost workspace's place, named and closed: a future deep workspace that will keep this
            // house's context and return here — never an empty tab, never a page that says nothing.
            MenuRow(ShellIcons.receipt, stringResource(R.string.menu_costs), onClick = null, supporting = stringResource(R.string.menu_costs_not_built))
            // The analyzer's history apart from ordinary use: one quiet row, never the house list itself (MARCOWKI-UI).
            val development = preview.developmentScenes.size
            if (development > 0) {
                PanelRule()
                MenuRow(
                    ShellIcons.cube,
                    stringResource(R.string.menu_gallery),
                    onClick = { onOpenSheet(Sheet.GALLERY) },
                    supporting = pluralStringResource(R.plurals.menu_gallery_detail, development, development),
                )
            }
        }
    }
}

/**
 * The developer gallery (MARCOWKI-UI): every scene shipped for development and review, in the exporter's order, each
 * under its technical record — the stage, the outcome, the failure kept. It is working material, said so at its head;
 * choosing a scene opens it in the workspace (remembered like any choice), and the way back to the showcase stands
 * above the list while a gallery scene is open.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DevelopmentGallerySheet(preview: PreviewViewModel, onDismiss: () -> Unit, onPick: (SceneEntry) -> Unit) {
    HouseSheet(onDismiss) {
        val openKey = preview.scene?.key
        val scenes = preview.developmentScenes
        val showcase = preview.showcase
        val galleryOpen = scenes.any { it.key == openKey }
        // Reopened on a gallery scene, the list stands on it — not at the top of a hundred rows (audit A11Y-07).
        val list = rememberLazyListState(initialFirstVisibleItemIndex = scenes.indexOfFirst { it.key == openKey }.coerceAtLeast(0))
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().heightIn(max = maxHeight * STAGE_SHEET_SHARE)) {
                // The head and the way back stand outside the scroll: what this list is, and how to leave it.
                Column(Modifier.fillMaxWidth().padding(horizontal = Space.l).padding(top = Space.l, bottom = Space.s)) {
                    Text(
                        stringResource(R.string.gallery_title),
                        style = MaterialTheme.typography.titleLarge,
                        color = Palette.Ink,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        stringResource(R.string.gallery_body),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Palette.InkMuted,
                        modifier = Modifier.padding(top = Space.xs),
                    )
                    if (galleryOpen && showcase != null) {
                        QuietAction(stringResource(R.string.gallery_back_showcase, showcase.title), onClick = { onPick(showcase) }, icon = ShellIcons.house, modifier = Modifier.padding(top = Space.s))
                    }
                }
                PanelRule(inset = 0.dp)
                androidx.compose.foundation.lazy.LazyColumn(
                    state = list,
                    modifier = Modifier.fillMaxWidth().weight(1f, fill = false).fadeBelowFold(list, Palette.Sheet),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = Space.xl),
                ) {
                    items(scenes.size, key = { scenes[it].key }) { i ->
                        val entry = scenes[i]
                        val current = entry.key == openKey
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(Space.m),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 64.dp)
                                // A radio row: TalkBack says chosen or not by itself, in the phone's own words.
                                .selectable(selected = current, role = Role.RadioButton, onClick = { onPick(entry) })
                                .background(if (current) Palette.Well else androidx.compose.ui.graphics.Color.Transparent)
                                .padding(horizontal = Space.l, vertical = Space.s),
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(entry.recordTitle, style = MaterialTheme.typography.bodyMedium, color = Palette.Ink, maxLines = 3, overflow = TextOverflow.Ellipsis)
                                if (entry.recordSubtitle.isNotBlank()) {
                                    Text(entry.recordSubtitle, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                }
                            }
                            if (current) Icon(ShellIcons.check, contentDescription = null, tint = Palette.Accent, modifier = Modifier.size(Sizes.icon))
                        }
                    }
                }
            }
        }
    }
}

/** A row of the menu: an icon, the matter's name, and the way to it — or, disabled, the word that it is not built yet. */
@Composable
private fun MenuRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: (() -> Unit)?, supporting: String? = null) {
    val enabled = onClick != null
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.m),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .padding(horizontal = Space.l, vertical = Space.s),
    ) {
        Icon(icon, contentDescription = null, tint = if (enabled) Palette.Ink else Palette.InkFaint, modifier = Modifier.size(Sizes.icon))
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyLarge, color = if (enabled) Palette.Ink else Palette.InkFaint, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (supporting != null) Text(supporting, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        if (enabled) Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
    }
}

/**
 * Every view, layer and look in one sheet (variant C), one tap away in the
 * menu and never a main action: the layers with isolation and the list of
 * elements, the named views with zoom and reset, and the looks. A view, an
 * element or a reset closes the sheet, so the camera's answer is seen; a
 * layer or a look is answered in place, under the sheet's own choice.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolsSheet(preview: PreviewViewModel, onDismiss: () -> Unit) {
    val scene = preview.scene ?: return
    HouseSheet(onDismiss) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val scroll = rememberScrollState()
            Column(Modifier.fillMaxWidth().heightIn(max = maxHeight * STAGE_SHEET_SHARE)) {
                Text(
                    stringResource(R.string.tools_title),
                    style = MaterialTheme.typography.titleLarge,
                    color = Palette.Ink,
                    modifier = Modifier.padding(horizontal = Space.l).padding(top = Space.l, bottom = Space.s).semantics { heading() },
                )
                Column(Modifier.fillMaxWidth().fadeBelowFold(scroll, Palette.Sheet).verticalScroll(scroll).padding(bottom = Space.xl)) {
                    PanelGroupLabel(stringResource(R.string.layers_panel_title))
                    LayersPane(
                        scene = scene,
                        state = preview.viewer,
                        onVisibility = { preview.setVisibility(it) },
                        onIsolate = { preview.isolateSelected() },
                        onShowAll = { preview.showAll() },
                        onSelectElement = { id ->
                            preview.choose(id, System.currentTimeMillis())
                            onDismiss()
                        },
                    )
                    PanelRule()
                    PanelGroupLabel(stringResource(R.string.view_row))
                    ViewPane(
                        scene = scene,
                        onPreset = {
                            preview.applyPreset(it, System.currentTimeMillis())
                            onDismiss()
                        },
                        onReset = {
                            preview.reset(System.currentTimeMillis())
                            onDismiss()
                        },
                        onZoom = { preview.zoom(it) },
                    )
                    PanelRule()
                    PanelGroupLabel(stringResource(R.string.tools_look))
                    LookPane(preview.viewer, onPresentation = { preview.setPresentation(it) }, onStyle = { preview.setStyle(it) })
                }
            }
        }
    }
}

/**
 * Where this house came from, said in words: its name and the house as a
 * line drawing inked by the owner's progress, where the model came from with
 * its limitations named (never smoothed over), a link analysis running or
 * failed, what the latest analysis of THIS house left open, and the
 * technical figures folded at the end. Adding a house from a link is one
 * quiet action here too.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SourceSheet(preview: PreviewViewModel, analyzer: AnalyzerViewModel, progress: ProgressViewModel, onDismiss: () -> Unit, onAnalyze: () -> Unit) {
    HouseSheet(onDismiss) {
        val scene = preview.scene
        val failed = preview.screen as? ScreenState.Failed
        val download = (scene?.key ?: failed?.entry?.key)?.let { key -> analyzer.downloads.firstOrNull { it.key == key } }
        var technical by rememberSaveable { mutableStateOf(false) }
        var confirmDelete by rememberSaveable { mutableStateOf(false) }
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Space.l)
                .padding(bottom = Space.xl)
                .widthIn(max = Sizes.contentMax),
        ) {
            if (scene == null) {
                // A house that did not load is named and can be removed (cycle 3, H-07); one still loading says so.
                if (failed != null) {
                    Text(failed.entry?.title ?: stringResource(R.string.house_failed), style = MaterialTheme.typography.titleLarge, color = Palette.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = Space.s).semantics { heading() })
                    LoadProblem(failed.problem, failed.message, modifier = Modifier.padding(top = Space.m))
                    if (download != null) {
                        PanelRule(inset = 0.dp)
                        QuietAction(stringResource(R.string.source_delete_action), onClick = { confirmDelete = true })
                    }
                } else {
                    Text(stringResource(R.string.house_loading), style = MaterialTheme.typography.titleMedium, color = Palette.Ink)
                }
                return@Column
            }
            val entry = preview.scenes.firstOrNull { it.key == scene.key }
            val completed = analyzer.state as? AnalysisState.Completed
            val resultShown = completed?.entry?.key == scene.key
            Text(
                scene.title,
                style = MaterialTheme.typography.titleLarge,
                color = Palette.Ink,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = Space.s).semantics { heading() },
            )
            SourceStatus(entry, download, resultShown)
            // N7-P1: a model says beside it what it is, from the record kept with the scene. N7-PATCH-04A: on the same
            // condition as the result screen, headed by the record's own verdict; partial only when it is partial
            download?.preview?.takeIf { it.hasDetails }?.let { outcome ->
                SectionHeading(stringResource(headlineText(outcomeHeadline(outcome))))
                PreviewOutcomeDetails(outcome)
            }
            // N7-FIX-01: which analyzer made this model, from the record kept with it (VERSION_UNKNOWN when it has none)
            if (download != null) {
                SectionHeading(stringResource(R.string.provenance_title))
                RunProvenanceDetails(download.provenance)
            }
            AnalysisLine(analyzer, onAnalyze)
            if (resultShown && completed != null) {
                SectionHeading(stringResource(R.string.analyzer_details))
                AnalysisDiagnostics(completed.summary)
            }
            // The technical figures, folded: for checking, not for reading.
            QuietAction(stringResource(if (technical) R.string.house_diagnostics_hide else R.string.house_diagnostics_show), onClick = { technical = !technical }, modifier = Modifier.padding(top = Space.m))
            if (technical) {
                StatusText(
                    stringResource(
                        R.string.house_diagnostics_rows,
                        scene.bundle.generatedFrom.modelSchemaVersion,
                        pluralStringResource(R.plurals.count_objects, scene.objectCount, scene.objectCount),
                        pluralStringResource(R.plurals.count_triangles, scene.triangleCount, scene.triangleCount),
                        scene.bundle.contentHash.take(8),
                    ),
                )
                // MARCOWKI-UI: a shipped scene's technical record — its stage, outcome and kept failures — lives here,
                // not in its name: the showcase is called "Dom w marcówkach" and this says which scene it is.
                if (entry != null && entry.source == SceneSourceKind.BUNDLED) {
                    StatusText(stringResource(R.string.house_diagnostics_record, entry.key, entry.recordTitle), modifier = Modifier.padding(top = Space.xs))
                    if (entry.recordSubtitle.isNotBlank()) StatusText(entry.recordSubtitle, modifier = Modifier.padding(top = Space.xxs))
                }
                QuietAction(stringResource(R.string.house_diagnostics_analyzer), onClick = onAnalyze, icon = ShellIcons.link)
            }
            if (download != null) {
                PanelRule(inset = 0.dp)
                QuietAction(stringResource(R.string.source_delete_action), onClick = { confirmDelete = true })
            }
        }
        if (confirmDelete && download != null) {
            AlertDialog(
                onDismissRequest = { confirmDelete = false },
                containerColor = Palette.Sheet,
                title = { Text(stringResource(R.string.analyzer_delete_title)) },
                text = { Text(stringResource(R.string.analyzer_delete_body, scene?.title ?: failed?.entry?.title ?: download.title)) },
                confirmButton = {
                    TextButton(
                        onClick = {
                            confirmDelete = false
                            analyzer.deleteDownload(download.key)
                            onDismiss()
                        },
                        modifier = Modifier.heightIn(min = Sizes.touch),
                    ) { Text(stringResource(R.string.analyzer_delete), color = Palette.Ink) }
                },
                dismissButton = {
                    TextButton(onClick = { confirmDelete = false }, modifier = Modifier.heightIn(min = Sizes.touch)) {
                        Text(stringResource(R.string.analyzer_keep), color = Palette.InkMuted)
                    }
                },
            )
        }
    }
}

/** Where the model came from — limitations said in words, with their counts. */
@Composable
private fun SourceStatus(entry: SceneEntry?, download: DownloadedSceneEntry?, resultShown: Boolean) {
    val source = entry?.source ?: SceneSourceKind.BUNDLED
    val partial = download?.isPartialPreview == true
    val limited = download != null && (partial || download.unresolvedCount > 0 || download.warningsCount > 0)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
        modifier = Modifier.fillMaxWidth().padding(top = Space.m),
    ) {
        if (limited) Icon(ShellIcons.caution, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        Column(Modifier.weight(1f)) {
            Text(
                when {
                    partial -> stringResource(R.string.house_status_partial)
                    // MARCOWKI-UI: the showcase in its own honest words; a gallery scene as working material
                    entry?.showcase == true -> entry.subtitle
                    entry?.isDevelopment == true -> stringResource(R.string.house_status_development)
                    else -> stringResource(statusRes(source, limited))
                },
                style = MaterialTheme.typography.bodyMedium,
                color = Palette.Ink,
            )
            if (limited && download != null) {
                val unresolved = pluralStringResource(R.plurals.count_unresolved, download.unresolvedCount, download.unresolvedCount)
                Text(
                    when {
                        download.unresolvedCount > 0 && resultShown -> stringResource(R.string.house_status_limited_detail, unresolved)
                        download.unresolvedCount > 0 -> stringResource(R.string.house_status_limited_kept, unresolved)
                        resultShown -> stringResource(R.string.house_status_warnings_detail)
                        else -> stringResource(R.string.house_status_warnings_kept)
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = Palette.InkMuted,
                )
            }
        }
    }
}

/** A downloaded analysis's status words (the showcase and the gallery scenes say their own, above). */
private fun statusRes(source: SceneSourceKind, limited: Boolean): Int = when {
    source != SceneSourceKind.DOWNLOADED -> R.string.house_status_development
    limited -> R.string.house_status_limited
    else -> R.string.house_status_ready
}

/** A running or failed analysis, said where the source is, with the way to the task. */
@Composable
internal fun AnalysisLine(analyzer: AnalyzerViewModel, onAnalyze: () -> Unit) {
    val state = analyzer.state
    when {
        analyzer.isRunning -> {
            val percent = analysisPercent(analyzer)
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
                    progress = { percent / 100f },
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

/** One modal sheet over the house: opaque, on a scrim that takes the gesture and closes. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HouseSheet(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheet,
        containerColor = Palette.Sheet,
        contentColor = Palette.Ink,
        scrimColor = Palette.Scrim.copy(alpha = 0.6f),
        shape = RoundedCornerShape(topStart = Radius.sheet, topEnd = Radius.sheet),
        // No pill: the sheet is told by its edge and its scrim, and the system's four radii hold.
        dragHandle = null,
    ) {
        // The sheet is its own window: give it the app's dark system bars, or its navigation bar shows the
        // system's light default under a dark sheet (round D).
        val window = LocalView.current
        SideEffect {
            (window.parent as? DialogWindowProvider)?.window?.let { w ->
                WindowCompat.getInsetsController(w, w.decorView).run {
                    isAppearanceLightNavigationBars = false
                    isAppearanceLightStatusBars = false
                }
            }
        }
        content()
    }
}

/**
 * A phone with no house on it: the one thing to do, said once, where the
 * house will stand. A link analysis running or failed is said here too, so
 * the owner never has to open the task to know.
 */
@Composable
fun NoHouseScreen(preview: PreviewViewModel, analyzer: AnalyzerViewModel, onAnalyze: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Palette.Ground).safeDrawingPadding(), contentAlignment = Alignment.TopStart) {
        Column(
            Modifier
                .widthIn(max = 560.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Space.l)
                .padding(top = Space.xxl, bottom = Space.xl),
            verticalArrangement = Arrangement.spacedBy(Space.m),
        ) {
            Text(
                stringResource(R.string.no_house_title),
                style = MaterialTheme.typography.headlineSmall,
                color = Palette.Ink,
                modifier = Modifier.semantics { heading() },
            )
            Text(stringResource(R.string.no_house_body), style = MaterialTheme.typography.bodyLarge, color = Palette.Ink)
            (preview.screen as? ScreenState.Failed)?.let { failed -> if (failed.problem != null) LoadProblem(failed.problem, failed.message) }
            InkButton(stringResource(R.string.house_add_action), icon = ShellIcons.link, onClick = onAnalyze, modifier = Modifier.fillMaxWidth())
            AnalysisLine(analyzer, onAnalyze)
        }
    }
}

/** "28 września 2026": the day the record was last changed, in Polish whatever the phone's language. */
internal fun savedDate(epochMs: Long): String =
    java.time.format.DateTimeFormatter.ofPattern("d MMMM yyyy", PRODUCT_LOCALE)
        .format(java.time.Instant.ofEpochMilli(epochMs).atZone(java.time.ZoneId.systemDefault()))

/** The drawing's height at the head of the stage sheet. */
private val DRAWING_HEIGHT = 168.dp

/** How much of the window the stage sheet may take: the house's ridge stays in view above it. */
private const val STAGE_SHEET_SHARE = 0.82f
