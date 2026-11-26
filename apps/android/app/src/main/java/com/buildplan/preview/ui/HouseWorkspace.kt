package com.buildplan.preview.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterExitState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.progress.ProgressView
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import com.buildplan.preview.scene.VisibilityMode
import kotlin.math.roundToInt

/**
 * The house workspace: the product root (INTEGRATION-004A, house-first).
 *
 * Five layers, each only as large as its job: the model, edge to edge; a
 * compact context at the top left (the house menu, the house, where the
 * build stands, and a status row only when there is something to say); the
 * labelled tool rail at the right edge; the construction timeline at the
 * foot, whose header opens the stage sheet; and, one at a time, a
 * contextual surface — an element's name above the timeline and its details
 * in a sheet that takes the timeline's place, or a modal sheet over a scrim
 * (the house menu, the stages, the source). While a finger turns the model,
 * the context and the rail step back.
 *
 * The model is framed inside what the chrome leaves free at rest — below
 * the top context, left of the tool rail, above the timeline — so "the whole
 * house" is never half under a panel; the expanded timeline is ignored, so
 * scrubbing or expanding it never moves the camera. An element's details
 * are the one exception: the sheet's height is added at the bottom, eased
 * in, so the element asked about stays in view above its own details. On a
 * short (landscape) screen the bottom stack ends before the rail instead of
 * running under it.
 *
 * Back closes the pane, then the details, then the selection; a modal sheet
 * closes itself; then back leaves the app — the workspace is the root.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HouseWorkspace(
    model: PreviewViewModel,
    progress: ProgressViewModel,
    analyzer: AnalyzerViewModel,
    sheet: Sheet?,
    /** A house analysed on this phone while this one was open, offered by its key; null when there is none. */
    readyKey: String?,
    onOpenSheet: (Sheet) -> Unit,
    onCloseSheet: () -> Unit,
    onOpenHouse: (String) -> Unit,
    onAnalyze: () -> Unit,
) {
    // A model kept with limitations is said once per house per process, on the status row; after that the
    // fact stays in the menu and on the source sheet (cycle 1, P1-2).
    var limitedSeen by rememberSaveable { mutableStateOf("") }
    val context = Context(
        model, progress, analyzer, readyKey, onOpenSheet, onOpenHouse, onAnalyze,
        limitedSeen = limitedSeen.split('\n').filter { it.isNotEmpty() }.toSet(),
        onLimitedSeen = { key -> limitedSeen = (limitedSeen.split('\n').filter { it.isNotEmpty() } + key).distinct().joinToString("\n") },
    )
    Box(Modifier.fillMaxSize().background(Palette.Ground)) {
        when (val screen = model.screen) {
            is ScreenState.Loading -> WorkspaceMessage(stringResource(R.string.house_loading), null, context)
            is ScreenState.Failed -> WorkspaceMessage(stringResource(R.string.house_failed), screen, context)
            is ScreenState.Ready -> ReadyWorkspace(model, progress, screen.scene, context, onOpenStages = { onOpenSheet(Sheet.STAGES) })
        }
    }
    when (sheet) {
        null -> Unit
        Sheet.MENU -> HouseMenuSheet(model, analyzer, onDismiss = onCloseSheet, onPick = { onOpenHouse(it.key) }, onAnalyze = onAnalyze, onOpenSheet = onOpenSheet)
        Sheet.STAGES -> StageSheet(
            progress = progress,
            sceneTitle = model.scene?.title,
            onDismiss = onCloseSheet,
            onShowInModel = { stage ->
                if (stage != null) progress.preview(stage) else progress.returnToNow()
                onCloseSheet()
            },
        )
        Sheet.SOURCE -> SourceSheet(model, analyzer, progress, onDismiss = onCloseSheet, onAnalyze = onAnalyze)
        Sheet.GALLERY -> DevelopmentGallerySheet(model, onDismiss = onCloseSheet, onPick = { onOpenHouse(it.key) })
    }
}

/** What the top context and the loading message need to know about the house and the ways off it. */
private class Context(
    val model: PreviewViewModel,
    val progress: ProgressViewModel,
    val analyzer: AnalyzerViewModel,
    val readyKey: String?,
    val onOpenSheet: (Sheet) -> Unit,
    val onOpenHouse: (String) -> Unit,
    val onAnalyze: () -> Unit,
    val limitedSeen: Set<String>,
    val onLimitedSeen: (String) -> Unit,
)

@Composable
private fun ReadyWorkspace(model: PreviewViewModel, progress: ProgressViewModel, scene: ModelScene, context: Context, onOpenStages: () -> Unit) {
    var toolName by rememberSaveable { mutableStateOf<String?>(null) }
    val tool = toolName?.let { name -> Tool.entries.firstOrNull { it.name == name } }
    var railExpanded by rememberSaveable { mutableStateOf(false) }
    var detailsOpen by rememberSaveable { mutableStateOf(false) }
    var hintShown by rememberSaveable { mutableStateOf(true) }
    val selected = model.selected
    val view = progress.view
    val motion = LocalMotionPolicy.current

    LaunchedEffect(selected) { if (selected == null) detailsOpen = false }
    // The timeline decides which uploaded objects stand; nothing is re-uploaded.
    LaunchedEffect(scene, view?.frame?.visible) { model.setConstruction(view?.frame?.visible) }
    // One gesture teaches the gestures: the hint leaves at the first touch, or by itself.
    LaunchedEffect(model.manipulating) { if (model.manipulating) hintShown = false }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(HINT_MS)
        hintShown = false
    }

    BackHandler(enabled = tool != null) { toolName = null }
    BackHandler(enabled = tool == null && detailsOpen) { detailsOpen = false }
    BackHandler(enabled = tool == null && !detailsOpen && selected != null) { model.clearSelection() }

    val recede by animateFloatAsState(if (model.manipulating) RECEDED_ALPHA else 1f, motion.recede(), label = "recede")
    // Each piece of chrome reports its own footprint against the root it is laid out in — never
    // against another callback's state, whose order of arrival is not guaranteed.
    var topInset by remember { mutableIntStateOf(0) }
    var railInset by remember { mutableIntStateOf(0) }
    var timelineInset by remember { mutableIntStateOf(0) }
    var sheetInset by remember { mutableIntStateOf(0) }
    var panelInset by remember { mutableIntStateOf(0) }
    val details = detailsOpen && selected != null
    val frameBottom by animateIntAsState(if (details) maxOf(timelineInset, sheetInset) else timelineInset, motion.settle(), label = "frameBottom")
    val frameRight by animateIntAsState(if (details) maxOf(railInset, panelInset) else railInset, motion.settle(), label = "frameRight")
    val rest = ContentInsets(top = topInset, right = railInset, bottom = timelineInset)
    // Read here, in composition, so each change recomposes and reaches the renderer — read only
    // inside the SideEffect, the eased inset never did, and the frame kept its first value.
    val drawn = rest.copy(right = frameRight, bottom = frameBottom)
    SideEffect { model.onChromeInsets(rest, drawn) }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        // A phone on its side: the details are a panel at the end edge beside the house, not a
        // sheet that would fill the whole short window and run under the status bar.
        val sidePanel = maxHeight < COMPACT_HEIGHT
        val sheetMax = minOf(SHEET_MAX, maxHeight * 0.55f)
        Viewport(scene = scene, model = model, modifier = Modifier.fillMaxSize())

        // A shade under the status bar, so its icons and the context read over a pale roof.
        Box(
            Modifier
                .fillMaxWidth()
                .height(112.dp)
                .background(Brush.verticalGradient(listOf(Palette.Scrim.copy(alpha = 0.55f), Color.Transparent))),
        )
        // And over the navigation bar — at the foot in portrait, at the side on a phone turned over —
        // so its light buttons read over a pale model (Makieta, Kreska: white on #D0CEC9 was 1.57:1).
        val nav = WindowInsets.navigationBars.asPaddingValues()
        val navBottom = nav.calculateBottomPadding()
        val navEnd = nav.calculateEndPadding(LocalLayoutDirection.current)
        val navStart = nav.calculateStartPadding(LocalLayoutDirection.current)
        if (navBottom > 0.dp) {
            val height = navBottom + SCRIM_FADE
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(height)
                    .background(Brush.verticalGradient(0f to Color.Transparent, SCRIM_FADE / height to NavScrim, 1f to NavScrim)),
            )
        }
        if (navEnd > 0.dp) {
            val width = navEnd + SCRIM_FADE
            Box(
                Modifier
                    .align(Alignment.CenterEnd)
                    .fillMaxHeight()
                    .width(width)
                    .background(Brush.horizontalGradient(0f to Color.Transparent, SCRIM_FADE / width to NavScrim, 1f to NavScrim)),
            )
        }
        // A phone turned the other way has its navigation bar on the start side: the same shade, mirrored.
        if (navStart > 0.dp) {
            val width = navStart + SCRIM_FADE
            Box(
                Modifier
                    .align(Alignment.CenterStart)
                    .fillMaxHeight()
                    .width(width)
                    .background(Brush.horizontalGradient(0f to NavScrim, navStart / width to NavScrim, 1f to Color.Transparent)),
            )
        }

        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().padding(Space.s)) {
            val density = LocalDensity.current
            // The top context's and the bottom stack's own heights, in this box: the rail and its pane are
            // laid out between them, never over them (cycle 1, P1-3).
            var topHeight by remember { mutableIntStateOf(0) }
            var bottomHeight by remember { mutableIntStateOf(0) }
            val topDp = with(density) { topHeight.toDp() }
            val bottomDp = with(density) { bottomHeight.toDp() }
            // Short screen: the rail reaches down to the timeline, so the bottom stack stops beside it.
            // Measured on the outer window, like the side panel: a 480-545 dp window is one thing, not two.
            val besideRail = if (sidePanel) RailDefaults.ButtonWidth + RailDefaults.Padding * 2 + Space.s else 0.dp
            // Upright, the rail stands above the timeline where a thumb reaches it (cycle 1, P1-4); on its
            // side, at the top, beside the bottom stack. Its pane never reaches the other chrome.
            val railAtFoot = !sidePanel
            val paneMax = (if (railAtFoot) maxHeight - topDp - bottomDp - Space.s * 2 else maxHeight - topDp - Space.s * 2).coerceAtLeast(PANE_MIN)
            val railColumn = RailDefaults.ButtonWidth + RailDefaults.Padding * 2 + Space.s

            // Nothing stands at this point of the build: say so where the house would be — inside the
            // rectangle the chrome leaves free, never under the rail's glass (cycle 3, H-04).
            val empty = view?.frame?.visible?.isEmpty() == true
            AnimatedVisibility(
                visible = empty,
                enter = motion.sheetEnter(),
                exit = motion.sheetExit(),
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(start = Space.xl, end = if (railAtFoot) Space.xl else railColumn + Space.l, top = topDp + Space.s, bottom = bottomDp + Space.s),
            ) {
                GlassSurface(shape = RoundedCornerShape(Radius.panel)) {
                    Text(
                        stringResource(if (view?.frame?.isPreview == true) R.string.model_nothing_stands_preview else R.string.model_nothing_stands_now),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Palette.Ink,
                        modifier = Modifier.padding(horizontal = Space.l, vertical = Space.m),
                    )
                }
            }
            // The top context: back, the house, where the build stands (never the preview: the timeline says that).
            TopContext(
                title = scene.title,
                view = view,
                timelineShown = view != null && !details,
                // "Postęp nieustawiony" is said once on screen: by the timeline showing now, or by the chosen
                // element's stage line in its details; here only when neither stands (MARCOWKI-UI).
                unsetSaidElsewhere = (view != null && !details && view.previewStop == null) ||
                    (details && selected?.let { progress.session?.stageOf(it.id) } != null),
                context = context,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .widthIn(max = maxWidth - RailDefaults.ButtonWidth - Space.xl)
                    .graphicsLayer { alpha = recede }
                    .onSizeChanged { topHeight = it.height }
                    // Like the timeline's, the top inset is the chrome AT REST: a preview's or the details' line
                    // under the name must not move the camera (MARCOWKI-UI audit).
                    .onGloballyPositioned { c -> topInset = c.boundsInRoot().bottom.roundToInt() },
            )

            // One contextual surface at a time (cycle 3, H-08): while the details stand in the timeline's place
            // the rail leaves too; its resting inset is kept, so the frame does not move.
            AnimatedVisibility(
                visible = !details,
                enter = motion.sheetEnter(),
                exit = motion.sheetExit(),
                modifier = Modifier.align(if (railAtFoot) Alignment.BottomEnd else Alignment.TopEnd),
            ) {
            ToolRail(
                scene = scene,
                state = model.viewer,
                open = tool,
                onOpen = { toolName = it?.name },
                onPreset = { model.applyPreset(it, System.currentTimeMillis()) },
                onPresentation = { model.setPresentation(it) },
                onStyle = { model.setStyle(it) },
                // A layer choice closes the pane where the finger is, and the row at the foot takes over naming the
                // layer: the rail then moves while no finger is on it (MARCOWKI-UI audit round 2, R2-04).
                onVisibility = {
                    model.setVisibility(it)
                    if (!sidePanel) toolName = null
                },
                onIsolate = {
                    model.isolateSelected()
                    if (!sidePanel) toolName = null
                },
                onShowAll = { model.showAll() },
                onReset = {
                    model.reset(System.currentTimeMillis())
                    detailsOpen = false
                    toolName = null
                },
                onSelectElement = { id ->
                    model.choose(id, System.currentTimeMillis())
                    toolName = null
                },
                onZoom = { model.zoom(it) },
                paneMaxHeight = paneMax,
                paneFromFoot = railAtFoot,
                // On its side the rail never runs off the bottom of the safe area (cycle 3, H-05): it scrolls.
                railMaxHeight = if (railAtFoot) null else maxHeight - topDp - Space.s * 2,
                modifier = Modifier
                    .padding(top = if (railAtFoot) 0.dp else topDp + Space.s, bottom = if (railAtFoot) bottomDp + Space.s else 0.dp)
                    .graphicsLayer { alpha = if (tool != null) 1f else recede }
                    // The rail at rest frames the model; an open pane (to its left) must not move the camera.
                    .onGloballyPositioned { c -> if (tool == null) railInset = c.fromRight() },
            )
            }

            // On its side the bottom stack stops beside the rail — and, while a pane is open, beside the pane
            // (cycle 3, H-02): the timeline's glass never lies over the pane's rows.
            val besidePane = if (!railAtFoot && tool != null && tool != Tool.FIT) RailDefaults.PaneWidth + Space.s else 0.dp
            Column(
                Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(end = besideRail + besidePane)
                    // The expanded strip on a short window never reaches up under the house menu.
                    .heightIn(max = (maxHeight - topDp - Space.s).coerceAtLeast(0.dp))
                    .onSizeChanged { bottomHeight = it.height },
                verticalArrangement = Arrangement.spacedBy(Space.s),
            ) {
                AnimatedVisibility(visible = hintShown && selected == null && tool == null, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                    GestureHint(Modifier.align(Alignment.CenterHorizontally))
                }
                // The chosen element, named with the way to its details and out. With a timeline it is the
                // top row of the timeline's own glass: the foot of the 3D stays one panel (finish review, F-04).
                val selectionRow: (@Composable () -> Unit)? = selected?.let { chosen ->
                    {
                        SelectionRow(
                            name = elementTitle(chosen),
                            detail = storeyOf(scene, chosen)?.let { storeyText(it) }.orEmpty(),
                            onDetails = { detailsOpen = true; toolName = null },
                            onClear = { model.clearSelection() },
                        )
                    }
                }
                // MARCOWKI-UI: what the layers leave out, said where the eye already is, with the one way back to the
                // whole house — the same "Pokaż wszystko" as the layers pane. A chosen element's row takes the place
                // first; the rail's label keeps naming the layer either way. Never part of the camera's frame.
                // It stays while a pane is open — so opening one never moves the rail under the finger — and a layer
                // choice closes the Warstwy pane, so it never unfolds under a finger choosing either (audit rounds
                // 1-2). Not on a short window, where it would stand over the framed house: there the rail's label
                // names the layer. The words come from what the filter removed, true for any building.
                val viewer = model.viewer
                val isolatedName = viewer.isolatedObjectId?.let { scene.objectById(it) }?.let { elementTitle(it) }
                val hiddenWords = remember(scene, viewer.visibility) { com.buildplan.preview.scene.Visibility.hidden(scene, viewer.visibility).wordsRes() }
                val layersRow: (@Composable () -> Unit)? =
                    if (selected == null && !sidePanel && (viewer.visibility != VisibilityMode.ALL || viewer.isIsolating)) {
                        { LayersRow(isolatedName = isolatedName, isolating = viewer.isIsolating, mode = viewer.visibility, hiddenWords = hiddenWords, onShowAll = { model.showAll() }) }
                    } else {
                        null
                    }
                val topRow = selectionRow ?: layersRow
                if (view == null) {
                    AnimatedVisibility(visible = topRow != null && !detailsOpen, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                        GlassSurface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(Radius.panel)) { topRow?.invoke() }
                    }
                } else {
                    AnimatedVisibility(visible = !detailsOpen, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                        // Where the rule stands, measured every layout; it frames the model only once the timeline is
                        // settled at rest — not while it slides away under the details or back from them, and not
                        // expanded or previewing (MARCOWKI-UI audit, rounds 1-2). Keyed on the transition, so the
                        // final position is taken when the slide ends, even if the layout did not move again.
                        var ruleAt by remember { mutableIntStateOf(-1) }
                        val settled = transition.currentState == EnterExitState.Visible && transition.targetState == EnterExitState.Visible
                        LaunchedEffect(ruleAt, settled, railExpanded, view.previewStop) {
                            // The first measurement always counts: a workspace recreated mid-preview (a turned phone)
                            // must not frame the house as if there were no timeline at all (audit round 2, F2).
                            if (ruleAt >= 0 && (timelineInset == 0 || (settled && !railExpanded && view.previewStop == null))) timelineInset = ruleAt
                        }
                        TimelineRail(
                            view = view,
                            expanded = railExpanded,
                            onToggle = { railExpanded = !railExpanded },
                            onPreviewStop = { progress.previewStop(it) },
                            onReturnToNow = { progress.returnToNow() },
                            onSetProgress = onOpenStages,
                            onEditProgress = onOpenStages,
                            top = topRow,
                            // A phone on its side: header and rule share one row, so the foot takes half the height.
                            compact = sidePanel,
                            // Only the rail at rest, showing now, frames the model: expanding it, a taller preview
                            // header or the chosen element's row must not move the camera.
                            ruleModifier = Modifier.onGloballyPositioned { c -> ruleAt = c.fromBottom() },
                        )
                    }
                }
            }
        }

        AnimatedVisibility(
            visible = details,
            enter = if (sidePanel) motion.panelEnter(TransformOrigin(1f, 0.5f)) else motion.sheetEnter(),
            exit = if (sidePanel) motion.panelExit(TransformOrigin(1f, 0.5f)) else motion.sheetExit(),
            modifier = Modifier.align(if (sidePanel) Alignment.CenterEnd else Alignment.BottomCenter),
        ) {
            if (selected != null) {
                val stage = progress.session?.stageOf(selected.id)
                val recorded = view?.let { v ->
                    if (v.summary.unset) null else stage?.let { key -> v.stages.firstOrNull { it.stageKey == key } }
                }
                // Not drawn because the previewed stage comes before it (not because of a layer): say which stage.
                val notYetAt = view?.previewStop
                    ?.takeIf { model.viewer.construction?.contains(selected.id) == false }
                    ?.let { stopNames(view.stages).getOrNull(it) }
                Inspector(
                    selected = selected,
                    storey = storeyOf(scene, selected),
                    stage = stage,
                    stageStatus = recorded?.status,
                    stageCompletion = recorded?.completion ?: 0.0,
                    visibleNow = model.viewer.isVisible(scene, selected.id),
                    notYetAt = notYetAt,
                    isolating = model.viewer.isIsolating,
                    maxHeight = if (sidePanel) maxHeight else sheetMax,
                    side = sidePanel,
                    onClose = { detailsOpen = false },
                    onFrame = { model.frameSelection(System.currentTimeMillis()) },
                    onIsolate = { model.isolateSelected() },
                    onShowAll = { model.showAll() },
                    modifier = if (sidePanel) {
                        Modifier
                            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.End + WindowInsetsSides.Bottom))
                            .padding(vertical = Space.s)
                            .width(SIDE_PANEL_WIDTH)
                            .onGloballyPositioned { c -> panelInset = c.fromRight() }
                    } else {
                        Modifier
                            .navigationBarsPadding()
                            .onGloballyPositioned { c -> sheetInset = c.fromBottom() }
                    },
                )
            }
        }
    }
}

/**
 * The house menu, the house's name, the ACTUAL state of the build — always
 * the actual one — and, only when there is something to say, one status row:
 * the model's limitations, a link analysis running or failed, or a new house
 * ready to open. Each status row is the way to its matter.
 */
@Composable
private fun TopContext(title: String, view: ProgressView?, timelineShown: Boolean, unsetSaidElsewhere: Boolean, context: Context, modifier: Modifier = Modifier) {
    // What the house is, said under its name at rest (MARCOWKI-UI): the showcase a demonstration model, a gallery scene
    // working material, an analysed house from a link — never a blank line (audit round 2, F6).
    val entry = context.model.scene?.let { s -> context.model.scenes.firstOrNull { it.key == s.key } }
    val showcase = entry?.showcase == true
    val kind = when {
        entry == null -> null
        showcase -> stringResource(R.string.house_showcase_kind)
        entry.isDevelopment -> stringResource(R.string.house_status_development)
        else -> stringResource(R.string.house_kind_from_link)
    }
    // One line, one fact — never two joined, where an ellipsis would eat the actual state (audit A11Y-01). While a
    // preview or the details hide the timeline's "now", the actual state must be said here and wins; at rest the
    // showcase keeps saying what it is (the date of the last save is in the stage sheet), any other house says when
    // its record was saved.
    val line = contextLine(view, timelineShown, unsetSaidElsewhere)
    val actualNeeded = view != null && (view.previewStop != null || !timelineShown)
    val second = when {
        actualNeeded -> line ?: kind
        showcase -> kind
        else -> line ?: kind
    }.orEmpty()
    GlassSurface(modifier = modifier) {
        Column {
            Row(Modifier.padding(end = Space.m), verticalAlignment = Alignment.CenterVertically) {
                val menuLabel = stringResource(R.string.workspace_menu)
                IconButton(onClick = { context.onOpenSheet(Sheet.MENU) }, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = menuLabel }) {
                    Icon(ShellIcons.houses, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
                }
                Column(Modifier.padding(vertical = Space.xs)) {
                    Text(
                        title,
                        style = MaterialTheme.typography.titleSmall,
                        color = Palette.Ink,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.semantics { heading() },
                    )
                    // Always laid out, even empty, so the context's height (and the camera's frame) never depends on it.
                    Text(
                        second,
                        style = MaterialTheme.typography.bodySmall,
                        color = Palette.InkMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            StatusRow(context)
        }
    }
}

/**
 * One line under the context, only when the house has something to say:
 * a new house ready (with the one action that opens it), a link analysis
 * running or failed (the way to the task), or a model kept with
 * limitations (the way to the source sheet). Said as a word and a mark.
 */
@Composable
private fun StatusRow(context: Context) {
    val ready = context.readyKey?.let { key -> context.model.scenes.firstOrNull { it.key == key } }
    val analyzer = context.analyzer
    val scene = context.model.scene
    val entry = scene?.let { s -> context.model.scenes.firstOrNull { it.key == s.key } }
    val download = scene?.let { s -> analyzer.downloads.firstOrNull { it.key == s.key } }
    // N7-P1: a partial 3D preview says so for as long as it is open; it is not a notice to be dismissed
    val partial = download?.isPartialPreview == true
    val limited = download != null && (download.unresolvedCount > 0 || download.warningsCount > 0) && scene.key !in context.limitedSeen
    // MARCOWKI-UI: a scene from the developer gallery says so while it is open, with the way back to the showcase.
    val development = entry?.isDevelopment == true
    val showcase = context.model.showcase
    val running = analyzer.isRunning
    val failed = analyzer.state is AnalysisState.Failed
    val kind = when {
        ready != null -> Status.READY
        failed -> Status.FAILED
        running -> Status.RUNNING
        partial -> Status.PARTIAL
        limited -> Status.LIMITED
        development -> Status.DEVELOPMENT
        else -> return
    }
    PanelRule(inset = Space.m)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = Sizes.touch)
            .clickable(role = Role.Button) {
                when (kind) {
                    Status.READY -> context.onOpenHouse(checkNotNull(ready).key)
                    Status.FAILED, Status.RUNNING -> context.onAnalyze()
                    Status.DEVELOPMENT -> showcase?.let { context.onOpenHouse(it.key) } ?: context.onAnalyze()
                    Status.LIMITED -> {
                        scene?.let { context.onLimitedSeen(it.key) }
                        context.onOpenSheet(Sheet.SOURCE)
                    }
                    Status.PARTIAL -> context.onOpenSheet(Sheet.SOURCE)
                }
            }
            .padding(start = Space.m, end = Space.s),
    ) {
        val (icon, tint) = when (kind) {
            Status.READY -> ShellIcons.check to Palette.Ink
            Status.FAILED -> ShellIcons.caution to Palette.Error
            Status.RUNNING -> ShellIcons.link to Palette.InkMuted
            Status.LIMITED -> ShellIcons.caution to Palette.InkMuted
            Status.PARTIAL -> ShellIcons.caution to Palette.Ink
            Status.DEVELOPMENT -> (if (showcase != null) ShellIcons.house else ShellIcons.link) to Palette.InkMuted
        }
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(Sizes.iconSmall))
        Text(
            when (kind) {
                Status.READY -> stringResource(R.string.workspace_new_house_ready, checkNotNull(ready).title)
                // No second figure beside the progress: the analyzer's own percentage waits on the task.
                Status.RUNNING -> stringResource(R.string.house_analysis_running_short)
                Status.FAILED -> stringResource(R.string.house_analysis_failed_short)
                Status.LIMITED -> stringResource(R.string.house_status_limited_short)
                Status.PARTIAL -> stringResource(R.string.house_status_partial_short)
                Status.DEVELOPMENT -> showcase?.let { stringResource(R.string.gallery_back_showcase, it.title) } ?: stringResource(R.string.house_status_development_add)
            },
            style = MaterialTheme.typography.bodySmall,
            color = Palette.Ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (kind == Status.READY) {
            Text(stringResource(R.string.workspace_open_new_house), style = MaterialTheme.typography.labelLarge, color = Palette.Ink)
        } else {
            Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
    }
}

/** What the status row can say, one at a time, by priority. */
private enum class Status { READY, FAILED, RUNNING, PARTIAL, LIMITED, DEVELOPMENT }

/** The analyzer's own progress, 0..100, for the running line. */
internal fun analysisPercent(analyzer: AnalyzerViewModel): Int {
    val fraction = when (val state = analyzer.state) {
        is AnalysisState.Polling -> state.status?.progress ?: 0.0
        is AnalysisState.Finishing -> state.status.progress
        else -> 0.0
    }
    return (fraction.coerceIn(0.0, 1.0) * 100).roundToInt()
}

/**
 * The line under the house's name. While the timeline shows now, it already says the state, so the
 * top says when the record was last changed; while previewing, or while the details have taken the
 * timeline's place, the ACTUAL state is said here — always the actual one, never the preview.
 */
@Composable
private fun contextLine(view: ProgressView?, timelineShown: Boolean, unsetSaidElsewhere: Boolean): String? {
    val summary = view?.summary
    val percent = summary?.percentText
    if (summary == null || summary.unset || percent == null) return if (unsetSaidElsewhere) null else stringResource(R.string.progress_unset)
    if (view.previewStop == null && timelineShown) {
        return summary.savedAtEpochMs?.let { stringResource(R.string.progress_saved_on, savedDate(it)) } ?: percent
    }
    val stage = (summary.currentStage ?: summary.lastDone)?.let { stringResource(it.labelRes()) }
    val text = if (stage != null) stringResource(R.string.progress_actual_short, percent, stage) else percent
    return if (view.previewStop != null) stringResource(R.string.progress_actual_prefix, text) else text
}

/** The chosen element, named, with the way to its details and out: a row, set on the timeline's glass. */
@Composable
private fun SelectionRow(name: String, detail: String, onDetails: () -> Unit, onClear: () -> Unit) {
    val detailsLabel = stringResource(R.string.dock_details)
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(end = Space.xs), verticalAlignment = Alignment.CenterVertically) {
        // The row is the handle into the details, like the timeline's header under it: one grammar on one glass.
        Row(
            Modifier
                .weight(1f)
                .heightIn(min = 56.dp)
                .clickable(role = Role.Button, onClickLabel = detailsLabel, onClick = onDetails)
                .padding(start = Space.l, end = Space.s, top = Space.s, bottom = Space.s),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.s),
        ) {
            Column(Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(if (detail.isNotBlank()) detail else detailsLabel, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
        val clear = stringResource(R.string.selection_clear)
        IconButton(onClick = onClear, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = clear }) {
            Icon(ShellIcons.close, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
    }
}

/**
 * What the layers leave out of the house now (MARCOWKI-UI), set on the timeline's glass like the chosen element's
 * row: the layer's name, what it hides, and the way back to the whole house. Said in words and a mark, never by
 * the model's look alone.
 */
@Composable
private fun LayersRow(isolatedName: String?, isolating: Boolean, mode: VisibilityMode, @androidx.annotation.StringRes hiddenWords: Int, onShowAll: () -> Unit) {
    val view = androidx.compose.ui.platform.LocalView.current
    val whole = stringResource(R.string.layer_hidden_none)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(start = Space.l, end = Space.s, top = Space.xs, bottom = Space.xs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.m),
    ) {
        Icon(ShellIcons.layers, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        Column(Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
            Text(
                when {
                    isolating && isolatedName != null -> stringResource(R.string.layer_isolated_named, isolatedName)
                    isolating -> stringResource(R.string.layer_isolated)
                    else -> stringResource(mode.labelRes())
                },
                style = MaterialTheme.typography.titleSmall,
                color = Palette.Ink,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                stringResource(if (isolating) R.string.layer_hidden_isolated else hiddenWords),
                style = MaterialTheme.typography.bodySmall,
                color = Palette.InkMuted,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
        // The row leaves with the action, so TalkBack's focus goes with it: say once what is shown now.
        LineButton(
            stringResource(R.string.layer_show_all),
            onClick = {
                onShowAll()
                view.announceForAccessibility(whole)
            },
        )
    }
}

/** How to move the house, said once where the eye is; it leaves at the first gesture. */
@Composable
private fun GestureHint(modifier: Modifier = Modifier) {
    GlassSurface(modifier = modifier, shape = RoundedCornerShape(Radius.panel)) {
        Text(
            stringResource(R.string.viewport_hint),
            style = MaterialTheme.typography.bodySmall,
            color = Palette.Ink,
            modifier = Modifier.padding(horizontal = Space.m, vertical = Space.s),
        )
    }
}

@Composable
private fun WorkspaceMessage(title: String, failed: ScreenState.Failed?, context: Context) {
    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        Row(Modifier.padding(Space.xs), verticalAlignment = Alignment.CenterVertically) {
            val menuLabel = stringResource(R.string.workspace_menu)
            IconButton(onClick = { context.onOpenSheet(Sheet.MENU) }, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = menuLabel }) {
                Icon(ShellIcons.houses, contentDescription = null, tint = Palette.Ink)
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            Column(Modifier.padding(Space.xxl), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Space.s)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = Palette.Ink)
                if (failed != null) LoadProblem(failed.problem, failed.message)
            }
        }
    }
}

/** How far this layout's left edge stands from the right of the screen: the width it covers there. */
private fun LayoutCoordinates.fromRight(): Int = findRootCoordinates().size.width - boundsInRoot().left.roundToInt()

/** How far this layout's top edge stands from the bottom of the screen: the height it covers there. */
private fun LayoutCoordinates.fromBottom(): Int = findRootCoordinates().size.height - boundsInRoot().top.roundToInt()

/** The storey an element stands on, in the owner's words: the export's label, or the level's position. */
private fun storeyOf(scene: ModelScene, obj: SceneObject): ElementWords.Storey? =
    ElementWords.storey(obj.metadata?.levelLabel ?: scene.levelLabel(obj.levelId), scene.levels.firstOrNull { it.id == obj.levelId }?.index)

/** How far the context and the rail fade while the model is turned: present, not in the way. */
private const val RECEDED_ALPHA = 0.18f

/** How long the gesture hint stays when nobody touches the model. */
private const val HINT_MS = 6_000L

/** How far a navigation-bar shade fades in before the bar; and its density there. */
private val SCRIM_FADE = 24.dp
private val NavScrim = Palette.Scrim.copy(alpha = 0.6f)

/** The tool pane never shrinks below this, whatever the chrome around it measures. */
private val PANE_MIN = 200.dp

/** The details sheet's tallest, on a tall screen (and never more than 55 % of it). */
private val SHEET_MAX = 460.dp

/** The details panel's width on a phone on its side. */
private val SIDE_PANEL_WIDTH = 360.dp

/** Below this height (a phone on its side) the rail reaches the timeline, and the bottom stack stops beside it. */
private val COMPACT_HEIGHT = 480.dp
