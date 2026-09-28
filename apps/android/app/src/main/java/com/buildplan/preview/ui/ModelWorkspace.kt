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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
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
            is ScreenState.Failed -> WorkspaceMessage(stringResource(R.string.house_failed), screen.message, onBack)
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
    var rootWidth by remember { mutableIntStateOf(0) }
    var rootHeight by remember { mutableIntStateOf(0) }
    var topInset by remember { mutableIntStateOf(0) }
    var railInset by remember { mutableIntStateOf(0) }
    var timelineInset by remember { mutableIntStateOf(0) }
    var sheetInset by remember { mutableIntStateOf(0) }
    val frameBottom by animateIntAsState(
        if (detailsOpen && selected != null) maxOf(timelineInset, sheetInset) else timelineInset,
        motion.settle(),
        label = "frameBottom",
    )
    val rest = ContentInsets(top = topInset, right = railInset, bottom = timelineInset)
    SideEffect { model.onChromeInsets(rest, rest.copy(bottom = frameBottom)) }

    Box(
        Modifier.fillMaxSize().onGloballyPositioned {
            rootWidth = it.size.width
            rootHeight = it.size.height
        },
    ) {
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
                paneMaxHeight = paneMax,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 60.dp)
                    .graphicsLayer { alpha = if (tool != null) 1f else recede }
                    // The rail at rest frames the model; an open pane (to its left) must not move the camera.
                    .onGloballyPositioned { c -> if (tool == null && rootWidth > 0) railInset = rootWidth - c.boundsInRoot().left.roundToInt() },
            )

            Column(
                Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(end = besideRail),
                verticalArrangement = Arrangement.spacedBy(Space.s),
            ) {
                AnimatedVisibility(visible = hintShown && selected == null && tool == null, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                    GestureHint(Modifier.align(Alignment.CenterHorizontally))
                }
                AnimatedVisibility(visible = selected != null && !detailsOpen, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                    if (selected != null) {
                        SelectionBar(
                            name = elementTitle(selected),
                            detail = storeyOf(scene, selected)?.let { storeyText(it) }.orEmpty(),
                            onDetails = { detailsOpen = true; toolName = null },
                            onClear = { model.clearSelection() },
                        )
                    }
                }
                if (view != null) {
                    AnimatedVisibility(visible = !detailsOpen, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                        TimelineRail(
                            view = view,
                            expanded = railExpanded,
                            onToggle = { railExpanded = !railExpanded },
                            onPreviewStop = { progress.previewStop(it) },
                            onReturnToNow = { progress.returnToNow() },
                            onSetProgress = onSetProgress,
                            modifier = Modifier.onGloballyPositioned { c ->
                                // Only the rail at rest, showing now, frames the model: expanding it or a
                                // taller preview header must not move the camera while scrubbing.
                                if (!railExpanded && view.previewStop == null && rootHeight > 0) timelineInset = rootHeight - c.boundsInRoot().top.roundToInt()
                            },
                        )
                    }
                }
            }
        }

        AnimatedVisibility(
            visible = detailsOpen && selected != null,
            enter = motion.sheetEnter(),
            exit = motion.sheetExit(),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            if (selected != null) {
                val stage = progress.session?.stageOf(selected.id)
                val status = view?.let { v ->
                    if (v.summary.unset) null else stage?.let { key -> v.stages.firstOrNull { it.stageKey == key }?.status }
                }
                Inspector(
                    selected = selected,
                    storey = storeyOf(scene, selected),
                    stage = stage,
                    stageStatus = status,
                    visibleNow = model.viewer.isVisible(scene, selected.id),
                    isolating = model.viewer.isIsolating,
                    maxHeight = 460.dp,
                    onClose = { detailsOpen = false },
                    onFrame = { model.frameSelection(System.currentTimeMillis()) },
                    onIsolate = { model.isolateSelected() },
                    onShowAll = { model.showAll() },
                    modifier = Modifier
                        .navigationBarsPadding()
                        .onGloballyPositioned { c -> if (rootHeight > 0) sheetInset = rootHeight - c.boundsInRoot().top.roundToInt() },
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

/** The chosen element, named above the timeline, with the way to its details and out. */
@Composable
private fun SelectionBar(name: String, detail: String, onDetails: () -> Unit, onClear: () -> Unit) {
    GlassSurface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(Radius.panel)) {
        Row(Modifier.heightIn(min = 56.dp).padding(start = Space.l, end = Space.xs), verticalAlignment = Alignment.CenterVertically) {
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
private fun WorkspaceMessage(title: String, detail: String?, onBack: () -> Unit) {
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
                if (detail != null) Text(detail, style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
            }
        }
    }
}

/** The storey an element stands on, in the owner's words: the export's label, or the level's position. */
private fun storeyOf(scene: ModelScene, obj: SceneObject): ElementWords.Storey? =
    ElementWords.storey(obj.metadata?.levelLabel ?: scene.levelLabel(obj.levelId), scene.levels.firstOrNull { it.id == obj.levelId }?.index)

/** How far the context and the rail fade while the model is turned: present, not in the way. */
private const val RECEDED_ALPHA = 0.18f

/** How long the gesture hint stays when nobody touches the model. */
private const val HINT_MS = 6_000L

/** Below this height (a phone on its side) the rail reaches the timeline, and the bottom stack stops beside it. */
private val COMPACT_HEIGHT = 480.dp
