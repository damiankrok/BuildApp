package com.buildplan.preview.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.progress.ProgressView
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import kotlin.math.roundToInt

/**
 * `3D`: the house on the whole screen, and the chrome floating over it.
 *
 * Five layers, each only as large as its job: the model, edge to edge; a
 * compact context at the top left (back, the house, where the build stands);
 * the labelled tool rail at the right edge; the construction timeline at the
 * foot; and, only when an element is chosen, its name above the timeline and
 * its details in a sheet that takes the timeline's place. While a finger
 * turns the model, the context and the rail step back.
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
 * Back closes the pane, then the details, then the selection, then leaves.
 */
@Composable
fun ModelWorkspace(model: PreviewViewModel, progress: ProgressViewModel, onBack: () -> Unit, onSetProgress: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Palette.Ground)) {
        when (val screen = model.screen) {
            is ScreenState.Loading -> WorkspaceMessage(stringResource(R.string.house_loading), null, onBack)
            is ScreenState.Failed -> WorkspaceMessage(stringResource(R.string.house_failed), screen, onBack)
            is ScreenState.Ready -> ReadyWorkspace(model, progress, screen.scene, onBack, onSetProgress)
        }
    }
}

@Composable
private fun ReadyWorkspace(model: PreviewViewModel, progress: ProgressViewModel, scene: ModelScene, onBack: () -> Unit, onSetProgress: () -> Unit) {
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

        // Nothing stands at this point of the build: say so where the house would be, never leave a bare grid.
        val empty = view?.frame?.visible?.isEmpty() == true
        AnimatedVisibility(
            visible = empty,
            enter = motion.sheetEnter(),
            exit = motion.sheetExit(),
            modifier = Modifier.align(Alignment.Center).padding(horizontal = Space.xxl),
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

        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding().padding(Space.s)) {
            val paneMax = maxHeight * 0.62f
            // Short screen: the rail reaches down to the timeline, so the bottom stack stops beside it.
            val besideRail = if (maxHeight < COMPACT_HEIGHT) RailDefaults.ButtonWidth + RailDefaults.Padding * 2 + Space.s else 0.dp
            // The top context: back, the house, where the build stands (never the preview: the timeline says that).
            TopContext(
                title = scene.title,
                view = view,
                onBack = onBack,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .widthIn(max = maxWidth - RailDefaults.ButtonWidth - Space.xl)
                    .graphicsLayer { alpha = recede }
                    .onGloballyPositioned { c -> topInset = c.boundsInRoot().bottom.roundToInt() },
            )

            ToolRail(
                scene = scene,
                state = model.viewer,
                open = tool,
                onOpen = { toolName = it?.name },
                onPreset = { model.applyPreset(it, System.currentTimeMillis()) },
                onPresentation = { model.setPresentation(it) },
                onStyle = { model.setStyle(it) },
                onVisibility = { model.setVisibility(it) },
                onIsolate = { model.isolateSelected() },
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
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 60.dp)
                    .graphicsLayer { alpha = if (tool != null) 1f else recede }
                    // The rail at rest frames the model; an open pane (to its left) must not move the camera.
                    .onGloballyPositioned { c -> if (tool == null) railInset = c.fromRight() },
            )

            Column(
                Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(end = besideRail),
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
                if (view == null) {
                    AnimatedVisibility(visible = selectionRow != null && !detailsOpen, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                        GlassSurface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(Radius.panel)) { selectionRow?.invoke() }
                    }
                } else {
                    AnimatedVisibility(visible = !detailsOpen, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                        TimelineRail(
                            view = view,
                            expanded = railExpanded,
                            onToggle = { railExpanded = !railExpanded },
                            onPreviewStop = { progress.previewStop(it) },
                            onReturnToNow = { progress.returnToNow() },
                            onSetProgress = onSetProgress,
                            top = selectionRow,
                            ruleModifier = Modifier.onGloballyPositioned { c ->
                                // Only the rail at rest, showing now, frames the model: expanding it, a taller
                                // preview header or the chosen element's row must not move the camera.
                                if (!railExpanded && view.previewStop == null) timelineInset = c.fromBottom()
                            },
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

/** Back, the house's name, and the ACTUAL state of the build — always the actual one. */
@Composable
private fun TopContext(title: String, view: ProgressView?, onBack: () -> Unit, modifier: Modifier = Modifier) {
    GlassSurface(modifier = modifier) {
        Row(Modifier.padding(end = Space.m), verticalAlignment = Alignment.CenterVertically) {
            val backLabel = stringResource(R.string.model_back)
            IconButton(onClick = onBack, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = backLabel }) {
                Icon(ShellIcons.back, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
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
                Text(
                    actualLine(view),
                    style = MaterialTheme.typography.bodySmall,
                    color = Palette.InkMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun actualLine(view: ProgressView?): String {
    val summary = view?.summary ?: return stringResource(R.string.progress_unset)
    val percent = summary.percentText
    if (summary.unset || percent == null) return stringResource(R.string.progress_unset)
    val stage = (summary.currentStage ?: summary.lastDone)?.let { stringResource(it.labelRes()) }
    val text = if (stage != null) stringResource(R.string.progress_actual_short, percent, stage) else percent
    return if (view.previewStop != null) stringResource(R.string.progress_actual_prefix, text) else text
}

/** The chosen element, named, with the way to its details and out: a row, set on the timeline's glass. */
@Composable
private fun SelectionRow(name: String, detail: String, onDetails: () -> Unit, onClear: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(start = Space.l, end = Space.xs), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(vertical = Space.s)) {
            Text(name, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (detail.isNotBlank()) Text(detail, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        LineButton(stringResource(R.string.dock_details), onClick = onDetails, borderColor = Palette.RuleEmpty)
        val clear = stringResource(R.string.selection_clear)
        IconButton(onClick = onClear, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = clear }) {
            Icon(ShellIcons.close, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
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
private fun WorkspaceMessage(title: String, failed: ScreenState.Failed?, onBack: () -> Unit) {
    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        Row(Modifier.padding(Space.xs), verticalAlignment = Alignment.CenterVertically) {
            val backLabel = stringResource(R.string.model_back)
            IconButton(onClick = onBack, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = backLabel }) {
                Icon(ShellIcons.back, contentDescription = null, tint = Palette.Ink)
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

/** The details sheet's tallest, on a tall screen (and never more than 55 % of it). */
private val SHEET_MAX = 460.dp

/** The details panel's width on a phone on its side. */
private val SIDE_PANEL_WIDTH = 360.dp

/** Below this height (a phone on its side) the rail reaches the timeline, and the bottom stack stops beside it. */
private val COMPACT_HEIGHT = 480.dp
