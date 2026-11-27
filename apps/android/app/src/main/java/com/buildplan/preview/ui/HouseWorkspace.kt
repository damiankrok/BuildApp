package com.buildplan.preview.ui

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.semantics.selected
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.input.pointer.pointerInput
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
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.center
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import kotlin.math.roundToInt

/**
 * The house workspace: the product root, laid out as variant C, "Minimalny
 * dok" (OWNER, APK 1356).
 *
 * The house is the screen: the model edge to edge on a calm graphite ground,
 * framed large in what the chrome leaves free AT REST. Over it, only small
 * floating pieces of matte glass: at the top start the house pill (the house,
 * a discreet "Demo", the way to the other houses), at the top end "Dopasuj"
 * and the menu; at the foot the dock — a wider "Cały dom" tile that names the
 * layer shown now, and "Etapy". Each tile grows, as the same piece of glass,
 * into its own panel (Warstwy, Etapy) and shrinks back into its slot; one
 * panel at a time, the other tile staying where it is, so switching is one
 * tap. Opening a panel never moves the camera — the frame is the chrome at
 * rest — and the 3D left uncovered stays live.
 *
 * Contextual pieces come and go: a status pill under the house pill only when
 * there is something to say, the chosen element's pill above the dock (its
 * details in a sheet), a one-line gesture hint at the first start. The full
 * set of views, layers and looks stays one tap away in the menu, never as a
 * main action.
 *
 * Back closes the panel, then the details, then the selection; a modal sheet
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
    // A model kept with limitations is said once per house per process, on the status pill; after that the
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
            is ScreenState.Ready -> ReadyWorkspace(model, progress, screen.scene, context, sheet, onCloseSheet)
        }
    }
    when (sheet) {
        // The stages are the Etapy panel now: the workspace opens it (and closes this request) itself.
        null, Sheet.STAGES -> Unit
        Sheet.MENU -> HouseMenuSheet(model, analyzer, onDismiss = onCloseSheet, onPick = { onOpenHouse(it.key) }, onAnalyze = onAnalyze, onOpenSheet = onOpenSheet)
        Sheet.SOURCE -> SourceSheet(model, analyzer, progress, onDismiss = onCloseSheet, onAnalyze = onAnalyze)
        Sheet.GALLERY -> DevelopmentGallerySheet(model, onDismiss = onCloseSheet, onPick = { onOpenHouse(it.key) })
        Sheet.TOOLS -> ToolsSheet(model, onDismiss = onCloseSheet)
    }
}

/** What the header and the loading message need to know about the house and the ways off it. */
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
private fun ReadyWorkspace(model: PreviewViewModel, progress: ProgressViewModel, scene: ModelScene, context: Context, sheet: Sheet?, onCloseSheet: () -> Unit) {
    var openName by rememberSaveable { mutableStateOf<String?>(null) }
    val open = openName?.let { name -> DockPanel.entries.firstOrNull { it.name == name } }
    var detailsOpen by rememberSaveable { mutableStateOf(false) }
    var hintShown by rememberSaveable { mutableStateOf(true) }
    val selected = model.selected
    val view = progress.view
    val motion = LocalMotionPolicy.current

    // The menu's "Etapy" and the STAGES launch extra open the Etapy panel: one place for the stages, not two.
    LaunchedEffect(sheet) {
        if (sheet == Sheet.STAGES) {
            onCloseSheet()
            detailsOpen = false
            openName = DockPanel.STAGES.name
        }
    }
    LaunchedEffect(selected) { if (selected == null) detailsOpen = false }
    // The construction axis decides which uploaded objects stand; nothing is re-uploaded.
    LaunchedEffect(scene, view?.frame?.visible) { model.setConstruction(view?.frame?.visible) }
    // One gesture teaches the gestures: the hint leaves at the first touch, or by itself.
    LaunchedEffect(model.manipulating) { if (model.manipulating) hintShown = false }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(HINT_MS)
        hintShown = false
    }

    // The morph of each tile into its panel: 0 the tile, 1 the panel (critically damped springs). One panel at a
    // time: on a switch the open glass springs home first and the other starts only once it is nearly in its slot,
    // so two glasses never lie over each other; each spring starts from wherever the glass is and keeps its
    // velocity, so a second tap mid-way turns it round smoothly.
    val layersMorph = remember { Animatable(if (open == DockPanel.LAYERS) 1f else 0f) }
    val stagesMorph = remember { Animatable(if (open == DockPanel.STAGES) 1f else 0f) }
    fun morphOf(panel: DockPanel) = if (panel == DockPanel.LAYERS) layersMorph else stagesMorph
    val morphVelocity = remember { FloatArray(2) }
    LaunchedEffect(open, motion.reduced) {
        val outgoing = DockPanel.entries.filter { it != open }.map { morphOf(it) }.filter { it.value > 0f }
        if (motion.reduced) {
            outgoing.forEach { it.snapTo(0f) }
            open?.let { morphOf(it).snapTo(1f) }
            return@LaunchedEffect
        }
        // A reversal mid-way keeps the glass's speed: a cancelled spring forgets it, so each glass carries its own.
        fun velocityOf(glass: Animatable<Float, *>) = if (glass === layersMorph) 0 else 1
        coroutineScope {
            outgoing.forEach { glass ->
                launch {
                    val i = velocityOf(glass)
                    glass.animateTo(0f, motion.morphClose(), initialVelocity = morphVelocity[i]) { morphVelocity[i] = velocity }
                    morphVelocity[i] = 0f
                }
            }
            open?.let { panel ->
                outgoing.forEach { glass -> snapshotFlow { glass.value }.first { it <= MotionPolicy.MORPH_HANDOVER } }
                val glass = morphOf(panel)
                val i = velocityOf(glass)
                // The incoming glass after a hand-over starts from rest; a reversal of the same glass keeps its speed.
                if (outgoing.isNotEmpty()) morphVelocity[i] = 0f
                glass.animateTo(1f, motion.morphOpen(), initialVelocity = morphVelocity[i]) { morphVelocity[i] = velocity }
                morphVelocity[i] = 0f
            }
        }
    }
    // Every glass at home: only then do the pieces that stand above the dock (selection, hint) come back.
    val docked by remember { derivedStateOf { layersMorph.value == 0f && stagesMorph.value == 0f } }
    val toggle: (DockPanel) -> Unit = { panel ->
        detailsOpen = false
        openName = if (open == panel) null else panel.name
    }

    BackHandler(enabled = open != null) { openName = null }
    BackHandler(enabled = open == null && detailsOpen) { detailsOpen = false }
    BackHandler(enabled = open == null && !detailsOpen && selected != null) { model.clearSelection() }
    // A look back at a stage is left before the app is: Back returns to the design or the saved state first.
    BackHandler(enabled = open == null && !detailsOpen && selected == null && view?.previewStop != null) { progress.returnToNow() }
    // Touching the house means being back on the house: a tap on the model closes an open panel.
    // Only taps made since this screen was composed: a panel restored after a rotation stays open (round D).
    val tapsSeen = remember { mutableIntStateOf(model.taps) }
    LaunchedEffect(model.taps) {
        if (model.taps > tapsSeen.intValue) openName = null
        tapsSeen.intValue = model.taps
    }

    // A finger on the house, or the house turning on its own for a while (showroom): the chrome steps back.
    val recede by animateFloatAsState(
        targetValue = when {
            model.manipulating -> RECEDED_ALPHA
            model.showroom -> SHOWROOM_ALPHA
            else -> 1f
        },
        animationSpec = if (model.showroom && !model.manipulating) tween(SHOWROOM_FADE_MS) else motion.recede(),
        label = "recede",
    )
    BoxWithConstraints(Modifier.fillMaxSize()) {
        // On its side only when it is also wide: a short, narrow window (split screen) keeps the upright dock.
        val sidePanel = maxHeight < COMPACT_HEIGHT && maxWidth >= SIDE_MIN_WIDTH
        val windowDensity = LocalDensity.current
        // The system's bars and cutout, NOT the keyboard (round D): typing in a panel never moves the dock, refits
        // the house or shrinks the frame; only the open panel stands clear of the keyboard (below).
        val chromeInsets = WindowInsets.systemBars.union(WindowInsets.displayCutout)
        // The chrome's footprint, all by arithmetic (round D) — the header row and the dock are constants, so their
        // footprint is known in the very first frame and never trails a layout pass: the arrival shot lands on a home
        // fitted to the real space, and a rotation refits once.
        val chromeTop = chromeInsets.getTop(windowDensity)
        val chromeBottom = chromeInsets.getBottom(windowDensity)
        val chromeLeft = chromeInsets.getLeft(windowDensity, androidx.compose.ui.unit.LayoutDirection.Ltr)
        val chromeRight = chromeInsets.getRight(windowDensity, androidx.compose.ui.unit.LayoutDirection.Ltr)
        val margin = with(windowDensity) { Space.m.toPx() }
        val topInset = (chromeTop + margin + with(windowDensity) { Sizes.touch.toPx() }).roundToInt()
        val dockInset = (chromeBottom + with(windowDensity) { (Sizes.tile + Space.m).toPx() }).roundToInt()
        // On its side the dock and its panels are a column at the start: the house is framed beside it, at rest and
        // with a panel open alike — the column's right edge from the window's, in the viewport's own pixels.
        val sideColumnPx = if (sidePanel) {
            val containerW = with(windowDensity) { maxWidth.toPx() } - chromeLeft - chromeRight - 2 * margin
            val columnW = minOf(containerW, with(windowDensity) { DOCK_SIDE_WIDTH.toPx() })
            (chromeLeft + margin + columnW + with(windowDensity) { Space.s.toPx() }).roundToInt()
        } else {
            0
        }
        var sheetInset by remember { mutableIntStateOf(0) }
        var panelInset by remember { mutableIntStateOf(0) }
        val details = detailsOpen && selected != null
        // Read only by the flow below, never by this composition: the details' frame eases in without recomposing
        // the workspace on every frame of the ease.
        val frameBottom = animateIntAsState(if (details) maxOf(dockInset, sheetInset) else dockInset, motion.settle(), label = "frameBottom")
        val frameRight = animateIntAsState(if (details) panelInset else 0, motion.settle(), label = "frameRight")
        // On its side, details close every panel: the house may use the column's width again, eased, between the
        // window's start and the details (a column AND the details left it a sliver).
        val frameLeft = animateIntAsState(if (details) 0 else sideColumnPx, motion.settle(), label = "frameLeft")
        // The house is framed in what the chrome at REST leaves free: under the header, above the dock (or beside
        // the column). An open panel is not part of it — opening one never moves the camera. Only details ease in.
        val rest = if (sidePanel) {
            ContentInsets(left = sideColumnPx, top = topInset, right = 0, bottom = (chromeBottom + margin).roundToInt())
        } else {
            ContentInsets(top = topInset, right = 0, bottom = dockInset)
        }
        val restNow by rememberUpdatedState(rest)
        LaunchedEffect(model) {
            snapshotFlow {
                val r = restNow
                val side = r.left > 0
                r to r.copy(
                    left = if (side) frameLeft.value else 0,
                    right = frameRight.value,
                    bottom = if (side && frameLeft.value == r.left) r.bottom else frameBottom.value,
                )
            }.collect { (r, d) -> model.onChromeInsets(r, d) }
        }
        SideEffect {
            // The house holds still while something is open over it; it may turn again once all is closed.
            model.turntablePaused = open != null || details || sheet != null
        }
        val sheetMax = minOf(SHEET_MAX, maxHeight * 0.55f)
        Viewport(scene = scene, model = model, modifier = Modifier.fillMaxSize())
        ModelShades()

        BoxWithConstraints(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(chromeInsets)
                .padding(Space.m),
        ) {
            val density = LocalDensity.current
            val gap = with(density) { Space.s.toPx() }
            val containerW = constraints.maxWidth.toFloat()
            val containerH = constraints.maxHeight.toFloat()
            val tileH = with(density) { Sizes.tile.toPx() }
            val headerBottom = with(density) { Sizes.touch.toPx() }

            // The dock, by arithmetic (DockLayout): a row of two fixed shares, as wide as the window allows (a readable
            // column on a wide window, at the start on a phone on its side), and where each panel stands open. Its only
            // inputs are the window's, so nothing a tile or a panel does can move anything else.
            val dock = DockLayout.of(
                containerW = containerW,
                containerH = containerH,
                sidePanel = sidePanel,
                gap = gap,
                tileH = tileH,
                headerBottom = headerBottom,
                dockMaxW = with(density) { (if (sidePanel) DOCK_SIDE_WIDTH else PANEL_MAX_WIDTH).toPx() },
            )
            val dockLeft = dock.left
            val dockW = dock.width
            val layersSlot = dock.layersSlot
            val stagesSlot = dock.stagesSlot
            // The keyboard lifts only the open panel: its foot stands above the keyboard's top, its height shrinks to fit.
            val keyboard = (WindowInsets.ime.getBottom(density) - chromeInsets.getBottom(density) - with(density) { Space.m.toPx() }).coerceAtLeast(0f)
            fun clearOfKeyboard(f: PanelFrame): PanelFrame {
                if (keyboard <= 0f) return f
                val bottom = minOf(f.bottom, containerH - keyboard - gap)
                return f.copy(bottom = bottom, maxHeight = (f.maxHeight - (f.bottom - bottom)).coerceAtLeast(tileH))
            }
            val layersFrame = clearOfKeyboard(dock.layersFrame)
            val stagesFrame = clearOfKeyboard(dock.stagesFrame)

            // Upright, the details sheet takes the foot of the screen: the dock fades under it rather than vanishing.
            val dockVisible = !(details && !sidePanel)
            val dockAlpha by animateFloatAsState(if (dockVisible) 1f else 0f, if (dockVisible) motion.enter() else motion.exit(), label = "dockAlpha")

            // Nothing stands at this point of the build: say so where the house would be.
            val empty = view?.frame?.visible?.isEmpty() == true
            AnimatedVisibility(
                visible = empty && open == null && docked,
                enter = fadeIn(motion.enter()),
                exit = fadeOut(motion.exit()),
                modifier = Modifier.align(Alignment.Center).padding(horizontal = Space.xl),
            ) {
                GlassSurface(shape = RoundedCornerShape(Radius.tile)) {
                    Text(
                        stringResource(if (view?.frame?.isPreview == true) R.string.model_nothing_stands_preview else R.string.model_nothing_stands_now),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Palette.Ink,
                        modifier = Modifier.padding(horizontal = Space.l, vertical = Space.m),
                    )
                }
            }

            // The header: the house pill at the start (its foot is the top of the house's frame), and under it, only
            // when there is something to say, a status pill that floats over the model and never moves the camera;
            // "Dopasuj" and the menu in one capsule at the end.
            val buttons = Sizes.touch * 2 + Space.m
            Column(
                Modifier
                    .align(Alignment.TopStart)
                    .widthIn(max = maxWidth - buttons)
                    .graphicsLayer {
                        alpha = recede
                        // Fade the layer's drawing, not an offscreen copy of it: no extra buffer per frame of a fade.
                        compositingStrategy = CompositingStrategy.ModulateAlpha
                    },
                verticalArrangement = Arrangement.spacedBy(Space.s),
            ) {
                Box {
                    HousePill(scene, context)
                }
                // On its side a panel is as tall as the column: the status pill steps aside rather than lie under it.
                if (!(sidePanel && open != null)) StatusPill(context)
            }
            HeaderCapsule(
                model = model,
                context = context,
                modifier = Modifier.align(Alignment.TopEnd).graphicsLayer {
                    alpha = recede
                    compositingStrategy = CompositingStrategy.ModulateAlpha
                },
            )

            val viewer = model.viewer
            val isolatedName = viewer.isolatedObjectId?.let { scene.objectById(it) }?.let { elementTitle(it) }

            // Above the dock, only while every glass is home: the chosen element's pill, or the gesture hint at first.
            // They stand on the dock's own column, so the foot of the screen reads as one stack.
            val dockLeftDp = with(density) { dockLeft.toDp() }
            val dockWidthDp = with(density) { dockW.toDp() }
            Column(
                Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = dockLeftDp, bottom = Sizes.tile + Space.s)
                    .width(dockWidthDp),
            ) {
                // They leave quickly (90 ms): a glass about to grow must not share the foot of the screen with them.
                AnimatedVisibility(visible = hintShown && !model.touchExploration && selected == null && open == null && docked && !details, enter = fadeIn(motion.enter()), exit = fadeOut(motion.quickExit())) {
                    GestureHint()
                }
                // The last element stays written while the pill fades out, so its exit is a fade, not an empty glass.
                val lastSelected = remember { mutableStateOf(selected) }
                if (selected != null) lastSelected.value = selected
                AnimatedVisibility(visible = selected != null && open == null && docked && !details, enter = fadeIn(motion.enter()) + slideInVertically(motion.enter()) { it / 6 }, exit = fadeOut(motion.quickExit())) {
                    val chosen = selected ?: lastSelected.value
                    if (chosen != null) {
                        GlassSurface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(Radius.tile)) {
                            SelectionRow(
                                name = elementTitle(chosen),
                                detail = storeyOf(scene, chosen)?.let { storeyText(it) }.orEmpty(),
                                onDetails = { detailsOpen = true; openName = null },
                                onClear = { model.clearSelection() },
                            )
                        }
                    }
                }
            }

            val restAlpha = { recede * dockAlpha }
            DockGlass(
                panel = DockPanel.LAYERS,
                morph = layersMorph,
                open = open,
                slot = layersSlot,
                frame = layersFrame,
                restAlpha = restAlpha,
                tile = { LayersTileContent(viewer, isolatedName, interactive = dockVisible, onOpen = { toggle(DockPanel.LAYERS) }, view = model.shownView) },
                content = {
                    LayersPanel(
                        scene = scene,
                        state = viewer,
                        shownView = model.shownView,
                        wide = with(density) { layersFrame.width.toDp() } >= WIDE_CARDS,
                        onVisibility = { model.setVisibility(it) },
                        onShowAll = { model.showAll() },
                        onPreset = {
                            model.applyPreset(it, System.currentTimeMillis())
                            openName = null
                        },
                        onClose = { openName = null },
                    )
                },
            )
            DockGlass(
                panel = DockPanel.STAGES,
                morph = stagesMorph,
                open = open,
                slot = stagesSlot,
                frame = stagesFrame,
                restAlpha = restAlpha,
                tile = { StagesTileContent(view, interactive = dockVisible, onOpen = { toggle(DockPanel.STAGES) }, onReturn = { progress.returnToNow() }) },
                content = {
                    StagesPanel(
                        progress = progress,
                        // "Pokaż w 3D" previews that stage and keeps the panel: the axis shows where it is.
                        onShowInModel = { stage -> if (stage != null) progress.preview(stage) else progress.returnToNow() },
                        onClose = { openName = null },
                        active = open == DockPanel.STAGES,
                    )
                },
            )
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
                    // Measured by SIZE, not by where the sliding sheet stands this frame: the house eases once to its
                    // final frame instead of chasing the sheet as it slides in (round D).
                    modifier = if (sidePanel) {
                        Modifier
                            .onSizeChanged { panelInset = it.width }
                            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.End + WindowInsetsSides.Bottom))
                            .padding(vertical = Space.s)
                            .width(SIDE_PANEL_WIDTH)
                    } else {
                        Modifier
                            .onSizeChanged { sheetInset = it.height }
                            .navigationBarsPadding()
                    },
                )
            }
        }

        // Showroom: the first touch anywhere only brings the chrome back (and stops the turn); it does not also
        // press a half-seen tile or grab the house. The next touch acts as usual.
        if (model.showroom) {
            Box(
                Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        awaitEachGesture {
                            awaitFirstDown(requireUnconsumed = false).consume()
                            // Leaves the composition with this: the rest of the touch goes nowhere.
                            model.wake(System.currentTimeMillis())
                            do {
                                val event = awaitPointerEvent()
                                event.changes.forEach { it.consume() }
                            } while (event.changes.any { it.pressed })
                        }
                    },
            )
        }
    }
}

/**
 * One tile of the dock and the panel it grows into, as one [MorphSurface].
 * The tile's words are composed until the panel stands fully open; the
 * panel's from the moment it is asked for until it has shrunk back — read
 * through derived state, so a frame of the morph recomposes nothing here.
 */
@Composable
private fun DockGlass(
    panel: DockPanel,
    morph: Animatable<Float, *>,
    open: DockPanel?,
    slot: Rect,
    frame: PanelFrame,
    restAlpha: () -> Float,
    tile: @Composable () -> Unit,
    content: @Composable () -> Unit,
) {
    val asked = open == panel
    val tileShown by remember { derivedStateOf { morph.value < 1f } }
    val panelShown by remember(asked) { derivedStateOf { asked || morph.value > 0f } }
    MorphSurface(
        progress = { morph.value },
        tile = slot,
        frame = frame,
        tileShown = tileShown,
        panelShown = panelShown,
        tileContent = tile,
        panelContent = content,
        restAlpha = restAlpha,
    )
}

/**
 * The house pill: the house, by its short name; a discreet badge for what it
 * is (the demonstration model, a scene from the developer gallery); and the
 * chevron that says it opens the houses. The full name and what the model is
 * stand in the house menu it opens.
 */
@Composable
private fun HousePill(scene: ModelScene, context: Context) {
    val entry = context.model.scenes.firstOrNull { it.key == scene.key }
    val badge = when {
        entry == null -> null
        entry.showcase -> stringResource(R.string.badge_demo)
        entry.isDevelopment -> stringResource(R.string.badge_gallery)
        else -> null
    }
    val name = entry?.shortTitle ?: scene.title
    val kind = when {
        entry == null -> null
        entry.showcase -> stringResource(R.string.house_showcase_kind)
        entry.isDevelopment -> stringResource(R.string.house_status_development)
        else -> stringResource(R.string.house_kind_from_link)
    }
    GlassSurface(shape = RoundedCornerShape(Radius.pill)) {
        Row(
            Modifier
                .heightIn(min = Sizes.touch)
                .clickable(role = Role.Button, onClickLabel = stringResource(R.string.house_pill_open)) { context.onOpenSheet(Sheet.MENU) }
                .semantics(mergeDescendants = true) { if (kind != null) stateDescription = kind }
                .padding(start = Space.m, end = Space.m),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.s),
        ) {
            Icon(ShellIcons.house, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.iconSmall))
            Text(name, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            if (badge != null) Badge(badge)
            Icon(ShellIcons.chevronDown, contentDescription = null, tint = Palette.InkMutedOnGlass, modifier = Modifier.size(Sizes.iconSmall))
        }
    }
}

/** A small word in a mint outline: what the house is. Never a fill — it is a label, not a button. */
@Composable
private fun Badge(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelMedium,
        color = Palette.Accent,
        maxLines = 1,
        // A filled mint wash, not an outline (round D): a small badge, not a second button.
        modifier = Modifier
            .clearAndSetSemantics { }
            .background(Palette.AccentWash, RoundedCornerShape(Radius.pill))
            .padding(horizontal = Space.s, vertical = 1.dp),
    )
}

/**
 * "Dopasuj" and the menu as one quiet glass capsule at the top end (round D): two 48 dp targets and a faint
 * divider, one object instead of two heavy circles. "Dopasuj" is two-stage, like a map's location button: the
 * first tap fits the whole house at the current angle; once it is fitted, the next tap brings back the
 * whole-house perspective — so there is always a one-tap way home. Its name says which it will do.
 */
@Composable
private fun HeaderCapsule(model: PreviewViewModel, context: Context, modifier: Modifier = Modifier) {
    GlassSurface(modifier = modifier, shape = RoundedCornerShape(Radius.pill)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            val fitLabel = stringResource(if (model.fittedHere) R.string.fit_home else R.string.tool_fit)
            IconButton(
                onClick = { model.fitOrHome(System.currentTimeMillis()) },
                modifier = Modifier.size(Sizes.touch).semantics { contentDescription = fitLabel },
            ) {
                // Its two stages are seen, not only spoken: a frame fits, a house goes home (round D).
                androidx.compose.animation.Crossfade(targetState = model.fittedHere, animationSpec = LocalMotionPolicy.current.enter(), label = "fitGlyph") { home ->
                    Icon(if (home) ShellIcons.house else ShellIcons.fit, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
                }
            }
            Box(Modifier.width(1.dp).height(Sizes.touch - Space.xl).background(Palette.GlassRimHigh.copy(alpha = 0.5f)))
            MoreMenu(model, context)
        }
    }
}

/** A menu row whose state is a word as well as a mark: a mint check when on, "wyłączone" when off. */
@Composable
private fun ToggleItem(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    on: Boolean,
    note: String? = null,
    /** The state's words, in the label's gender ("Siatka" — "włączona"). */
    onWord: Int = R.string.menu_state_on,
    offWord: Int = R.string.menu_state_off,
    onToggle: () -> Unit,
) {
    val word = stringResource(if (on) onWord else offWord)
    // Chosen but held by the system: said in words under the label, and in the state TalkBack reads.
    val state = if (note != null) "$word, $note" else word
    DropdownMenuItem(
        text = {
            Column {
                Text(label, style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (note != null) {
                    Text(note, style = MaterialTheme.typography.labelMedium, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.clearAndSetSemantics { })
                }
            }
        },
        leadingIcon = { Icon(icon, contentDescription = null, modifier = Modifier.size(Sizes.icon)) },
        trailingIcon = {
            if (on) {
                Icon(ShellIcons.check, contentDescription = null, modifier = Modifier.size(Sizes.icon))
            } else {
                Text(word, style = MaterialTheme.typography.labelMedium, color = Palette.InkMuted, modifier = Modifier.clearAndSetSemantics { })
            }
        },
        onClick = onToggle,
        colors = MenuDefaults.itemColors(textColor = Palette.Ink, leadingIconColor = Palette.Ink, trailingIconColor = Palette.Accent),
        modifier = Modifier
            .heightIn(min = Sizes.touch)
            .semantics {
                role = Role.Switch
                toggleableState = androidx.compose.ui.state.ToggleableState(on)
                stateDescription = state
            },
    )
}

/**
 * The menu at the top end (round D), one name per thing: the look (a short list in place, the change seen
 * behind the menu), the reference grid and the idle turn (view settings, off at the start, remembered), every
 * element and every view in the tools sheet, and the source of the model. The houses are the house pill's.
 */
@Composable
private fun MoreMenu(model: PreviewViewModel, context: Context) {
    var expanded by remember { mutableStateOf(false) }
    var looks by remember { mutableStateOf(false) }
    SideEffect { model.menuOpen = expanded }
    Box {
        val more = stringResource(R.string.header_more)
        IconButton(onClick = { looks = false; expanded = true }, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = more }) {
            Icon(ShellIcons.more, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = Palette.GlassOpaque,
            shape = RoundedCornerShape(Radius.tile),
            border = androidx.compose.foundation.BorderStroke(1.dp, Palette.GlassRimHigh),
            shadowElevation = Depth.panel,
        ) {
            val colors = MenuDefaults.itemColors(textColor = Palette.Ink, leadingIconColor = Palette.Ink, trailingIconColor = Palette.InkMuted)
            if (looks) {
                // The looks in place: the menu stays open, so the change is seen behind it.
                for (mode in com.buildplan.preview.presentation.PresentationMode.entries) {
                    val chosen = model.viewer.presentation == mode
                    DropdownMenuItem(
                        text = { Text(stringResource(mode.labelRes()), style = MaterialTheme.typography.bodyLarge, fontWeight = if (chosen) androidx.compose.ui.text.font.FontWeight.SemiBold else null) },
                        leadingIcon = {
                            Box(
                                Modifier
                                    .size(10.dp)
                                    .then(if (chosen) Modifier.background(Palette.Accent, androidx.compose.foundation.shape.CircleShape) else Modifier.border(1.2.dp, Palette.RuleEmpty, androidx.compose.foundation.shape.CircleShape)),
                            )
                        },
                        onClick = { model.setPresentation(mode) },
                        colors = colors,
                        modifier = Modifier.heightIn(min = Sizes.touch).semantics { selected = chosen },
                    )
                }
                return@DropdownMenu
            }
            DropdownMenuItem(
                text = { Text(stringResource(R.string.tools_look), style = MaterialTheme.typography.bodyLarge) },
                leadingIcon = { Icon(ShellIcons.look, contentDescription = null, modifier = Modifier.size(Sizes.icon)) },
                trailingIcon = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.xs)) {
                        Text(stringResource(model.viewer.presentation.labelRes()), style = MaterialTheme.typography.labelMedium, color = Palette.InkMuted)
                        Icon(ShellIcons.chevronRight, contentDescription = null, modifier = Modifier.size(Sizes.iconSmall))
                    }
                },
                onClick = { looks = true },
                colors = colors,
                modifier = Modifier.heightIn(min = Sizes.touch),
            )
            val hold = model.turntableHeldBy
            ToggleItem(
                label = stringResource(R.string.menu_turntable),
                icon = ShellIcons.turn,
                on = model.turntableOn,
                note = hold?.let {
                    stringResource(
                        when (it) {
                            TurntableHold.ANIMATIONS_OFF -> R.string.menu_turntable_held_motion
                            TurntableHold.TALKBACK -> R.string.menu_turntable_held_talkback
                            TurntableHold.POWER_SAVE -> R.string.menu_turntable_held_power
                            TurntableHold.THERMAL -> R.string.menu_turntable_held_thermal
                            TurntableHold.PARALLEL_VIEW -> R.string.menu_turntable_held_parallel
                            TurntableHold.CLOSE_UP -> R.string.menu_turntable_held_close_up
                        },
                    )
                },
            ) { model.setTurntable(!model.turntableOn) }
            ToggleItem(stringResource(R.string.menu_grid), ShellIcons.grid, model.viewer.grid, onWord = R.string.menu_grid_on, offWord = R.string.menu_grid_off) { model.setGrid(!model.viewer.grid) }
            DropdownMenuItem(
                text = { Text(stringResource(R.string.menu_tools), style = MaterialTheme.typography.bodyLarge) },
                leadingIcon = { Icon(ShellIcons.view, contentDescription = null, modifier = Modifier.size(Sizes.icon)) },
                onClick = {
                    expanded = false
                    context.onOpenSheet(Sheet.TOOLS)
                },
                colors = colors,
                modifier = Modifier.heightIn(min = Sizes.touch),
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.menu_source), style = MaterialTheme.typography.bodyLarge) },
                leadingIcon = { Icon(ShellIcons.page, contentDescription = null, modifier = Modifier.size(Sizes.icon)) },
                onClick = {
                    expanded = false
                    context.onOpenSheet(Sheet.SOURCE)
                },
                colors = colors,
                modifier = Modifier.heightIn(min = Sizes.touch),
            )
        }
    }
}

/**
 * The shades that keep the chrome readable over a pale model and give the
 * ground a quiet depth: a soft vignette at the corners, a shade under the
 * status bar, and one over the navigation bar wherever it stands. Drawn by
 * the window over the 3D, static — they cost nothing per frame.
 */
@Composable
private fun ModelShades() {
    Box(
        Modifier
            .fillMaxSize()
            .drawWithCache {
                val vignette = Brush.radialGradient(
                    0.5f to Color.Transparent,
                    1f to Palette.Scrim.copy(alpha = VIGNETTE_ALPHA),
                    center = size.center,
                    radius = size.maxDimension * 0.72f,
                )
                onDrawBehind { drawRect(vignette) }
            },
    )
    Box(
        Modifier
            .fillMaxWidth()
            .height(96.dp)
            .background(Brush.verticalGradient(listOf(Palette.Scrim.copy(alpha = 0.45f), Color.Transparent))),
    )
    val nav = WindowInsets.navigationBars.asPaddingValues()
    val navBottom = nav.calculateBottomPadding()
    val navEnd = nav.calculateEndPadding(LocalLayoutDirection.current)
    val navStart = nav.calculateStartPadding(LocalLayoutDirection.current)
    Box(Modifier.fillMaxSize()) {
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
    }
}

/**
 * One pill under the house pill, only when the house has something to say:
 * a new house ready (with the one action that opens it), a link analysis
 * running or failed (the way to the task), a model kept with limitations or
 * a partial preview (the way to the source sheet), a scene from the developer
 * gallery (the way back to the showcase). Said as a word and a mark.
 */
@Composable
private fun StatusPill(context: Context) {
    val ready = context.readyKey?.let { key -> context.model.scenes.firstOrNull { it.key == key } }
    val analyzer = context.analyzer
    val scene = context.model.scene
    val entry = scene?.let { s -> context.model.scenes.firstOrNull { it.key == s.key } }
    val download = scene?.let { s -> analyzer.downloads.firstOrNull { it.key == s.key } }
    // N7-P1: a partial 3D preview says so for as long as it is open; it is not a notice to be dismissed
    val partial = download?.isPartialPreview == true
    val limited = download != null && (download.unresolvedCount > 0 || download.warningsCount > 0) && scene.key !in context.limitedSeen
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
    // A new status is news: it brings the chrome back from the showroom's whisper, where it would be missed.
    LaunchedEffect(kind) { context.model.wake(System.currentTimeMillis()) }
    GlassSurface(shape = RoundedCornerShape(Radius.tile)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.s),
            modifier = Modifier
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
                .padding(start = Space.m, end = Space.s, top = Space.xs, bottom = Space.xs),
        ) {
            val (icon, tint) = when (kind) {
                Status.READY -> ShellIcons.check to Palette.Accent
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
                modifier = Modifier.weight(1f, fill = false),
            )
            if (kind == Status.READY) {
                Text(stringResource(R.string.workspace_open_new_house), style = MaterialTheme.typography.labelLarge, color = Palette.Ink)
            } else {
                Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
            }
        }
    }
}

/** What the status pill can say, one at a time, by priority. */
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

/** The chosen element, named, with the way to its details and out: a pill above the dock. */
@Composable
private fun SelectionRow(name: String, detail: String, onDetails: () -> Unit, onClear: () -> Unit) {
    val detailsLabel = stringResource(R.string.dock_details)
    Row(Modifier.heightIn(min = 56.dp).padding(end = Space.xs), verticalAlignment = Alignment.CenterVertically) {
        Row(
            Modifier
                .weight(1f)
                .heightIn(min = 56.dp)
                .clickable(role = Role.Button, onClickLabel = detailsLabel, onClick = onDetails)
                .padding(start = Space.m, end = Space.s, top = Space.s, bottom = Space.s),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.s),
        ) {
            // The mint mark of what is chosen: the same accent as the element's outline in the house (round D).
            Box(Modifier.size(width = 3.dp, height = 28.dp).background(Palette.Accent, RoundedCornerShape(2.dp)))
            Column(Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(if (detail.isNotBlank()) detail else detailsLabel, style = MaterialTheme.typography.bodySmall, color = Palette.InkMutedOnGlass, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(ShellIcons.chevronRight, contentDescription = null, tint = Palette.InkMutedOnGlass, modifier = Modifier.size(Sizes.iconSmall))
        }
        val clear = stringResource(R.string.selection_clear)
        IconButton(onClick = onClear, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = clear }) {
            Icon(ShellIcons.close, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
    }
}

/** How to move the house, said once where the eye is; it leaves at the first gesture. */
@Composable
private fun GestureHint(modifier: Modifier = Modifier) {
    GlassSurface(modifier = modifier, shape = RoundedCornerShape(Radius.tile)) {
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


/** The storey an element stands on, in the owner's words: the export's label, or the level's position. */
private fun storeyOf(scene: ModelScene, obj: SceneObject): ElementWords.Storey? =
    ElementWords.storey(obj.metadata?.levelLabel ?: scene.levelLabel(obj.levelId), scene.levels.firstOrNull { it.id == obj.levelId }?.index)

/** How far the header and the resting tiles fade while the model is turned: present, not in the way. */
private const val RECEDED_ALPHA = 0.18f

/** Showroom: the chrome fades slowly to a whisper, still there for the finger that wants it. */
private const val SHOWROOM_ALPHA = 0.2f
private const val SHOWROOM_FADE_MS = 1_400

/** How long the gesture hint stays when nobody touches the model. */
private const val HINT_MS = 6_000L

/** How far a navigation-bar shade fades in before the bar; and its density there. */
private val SCRIM_FADE = 24.dp
private val NavScrim = Palette.Scrim.copy(alpha = 0.6f)

/** How dark the vignette is in the corners: a quiet depth, never a frame. */
private const val VIGNETTE_ALPHA = 0.4f

/** The details sheet's tallest, on a tall screen (and never more than 55 % of it). */
private val SHEET_MAX = 460.dp

/** The details panel's width on a phone on its side. */
private val SIDE_PANEL_WIDTH = 360.dp

/** Below this height (a phone on its side) the details stand at the end edge and the panels beside the dock. */
private val COMPACT_HEIGHT = 480.dp

/** The side arrangement needs at least this much width for the dock, the panel and the house. */
private val SIDE_MIN_WIDTH = 600.dp

/** The layers tile's share of the dock's row; "Etapy" takes the rest. Fixed: no label can move a tile. */

/** The dock's width on a phone on its side: a readable column at the start, not the whole short screen. */
private val DOCK_SIDE_WIDTH = 440.dp

/** From this panel width the four layer cards stand side by side with their names beside the marks. */
private val WIDE_CARDS = 560.dp
