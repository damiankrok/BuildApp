package com.buildplan.preview.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.center
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.camera.ViewPreset
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

    // The morph of each tile into its panel: 0 the tile, 1 the panel. One panel at a time — the other first
    // shrinks back into its slot, then this one grows — so two glasses never lie over each other. Each step
    // starts from wherever the glass is, so a second tap mid-way turns it round instead of jumping.
    val layersMorph = remember { Animatable(if (open == DockPanel.LAYERS) 1f else 0f) }
    val stagesMorph = remember { Animatable(if (open == DockPanel.STAGES) 1f else 0f) }
    fun morphOf(panel: DockPanel) = if (panel == DockPanel.LAYERS) layersMorph else stagesMorph
    LaunchedEffect(open, motion.reduced) {
        for (other in DockPanel.entries) {
            if (other == open) continue
            val glass = morphOf(other)
            if (glass.value > 0f) {
                if (motion.reduced) glass.snapTo(0f) else glass.animateTo(0f, motion.morphClose(glass.value))
            }
        }
        open?.let {
            val glass = morphOf(it)
            if (motion.reduced) glass.snapTo(1f) else glass.animateTo(1f, motion.morphOpen(1f - glass.value))
        }
    }
    val toggle: (DockPanel) -> Unit = { panel ->
        detailsOpen = false
        openName = if (open == panel) null else panel.name
    }

    BackHandler(enabled = open != null) { openName = null }
    BackHandler(enabled = open == null && detailsOpen) { detailsOpen = false }
    BackHandler(enabled = open == null && !detailsOpen && selected != null) { model.clearSelection() }

    val recede by animateFloatAsState(if (model.manipulating) RECEDED_ALPHA else 1f, motion.recede(), label = "recede")
    // Each piece of chrome reports its own footprint against the root it is laid out in.
    var topInset by remember { mutableIntStateOf(0) }
    var dockInset by remember { mutableIntStateOf(0) }
    var sheetInset by remember { mutableIntStateOf(0) }
    var panelInset by remember { mutableIntStateOf(0) }
    val details = detailsOpen && selected != null
    val frameBottom by animateIntAsState(if (details) maxOf(dockInset, sheetInset) else dockInset, motion.settle(), label = "frameBottom")
    val frameRight by animateIntAsState(if (details) panelInset else 0, motion.settle(), label = "frameRight")
    // The house is framed in what the chrome at REST leaves free: under the header, above the dock. An open
    // panel is not part of it — opening one never moves the camera. Only an element's details ease in.
    val rest = ContentInsets(top = topInset, right = 0, bottom = dockInset)
    val drawn = rest.copy(right = frameRight, bottom = frameBottom)
    SideEffect { model.onChromeInsets(rest, drawn) }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val sidePanel = maxHeight < COMPACT_HEIGHT
        val sheetMax = minOf(SHEET_MAX, maxHeight * 0.55f)
        Viewport(scene = scene, model = model, modifier = Modifier.fillMaxSize())
        ModelShades()

        BoxWithConstraints(
            Modifier
                .fillMaxSize()
                .safeDrawingPadding()
                .padding(Space.s),
        ) {
            val density = LocalDensity.current
            val gap = with(density) { Space.s.toPx() }
            val containerW = constraints.maxWidth.toFloat()
            val containerH = constraints.maxHeight.toFloat()
            // Where this box stands in the root, so the dock's slots can be read in its own coordinates.
            var origin by remember { mutableStateOf(Offset.Zero) }
            var headerBottom by remember { mutableStateOf(0f) }
            var dock by remember { mutableStateOf<Rect?>(null) }
            var layersSlot by remember { mutableStateOf<Rect?>(null) }
            var stagesSlot by remember { mutableStateOf<Rect?>(null) }
            Box(Modifier.fillMaxSize().onGloballyPositioned { origin = it.positionInRoot() })
            fun LayoutCoordinates.local(): Rect = boundsInRoot().translate(-origin)

            // Nothing stands at this point of the build: say so where the house would be.
            val empty = view?.frame?.visible?.isEmpty() == true
            AnimatedVisibility(
                visible = empty && open == null,
                enter = motion.sheetEnter(),
                exit = motion.sheetExit(),
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

            // The header: the house pill (and, only when there is something to say, a status pill under it) at the
            // start; "Dopasuj" and the menu at the end. Its foot is the top of the house's frame.
            val buttons = Sizes.touch * 2 + Space.s * 2
            Column(
                Modifier
                    .align(Alignment.TopStart)
                    .widthIn(max = maxWidth - buttons)
                    .graphicsLayer { alpha = recede }
                    .onGloballyPositioned { c ->
                        headerBottom = c.local().bottom
                        topInset = c.boundsInRoot().bottom.roundToInt()
                    },
                verticalArrangement = Arrangement.spacedBy(Space.s),
            ) {
                HousePill(scene, context)
                StatusPill(context)
            }
            Row(
                Modifier.align(Alignment.TopEnd).graphicsLayer { alpha = recede },
                horizontalArrangement = Arrangement.spacedBy(Space.s),
            ) {
                val fit = stringResource(R.string.tool_fit)
                GlassButton(ShellIcons.fit, fit, onClick = { model.applyPreset(ViewPreset.FIT, System.currentTimeMillis()) })
                MoreMenu(model, context)
            }

            // The dock's slots. What is laid out here is an invisible copy of each tile's words, so the slot is
            // exactly the tile's size; the tile itself is the morphing glass drawn below, at this rectangle.
            val viewer = model.viewer
            val layersTileMax = maxWidth * LAYERS_TILE_SHARE
            val isolatedName = viewer.isolatedObjectId?.let { scene.objectById(it) }?.let { elementTitle(it) }
            AnimatedVisibility(
                // Upright, the details sheet takes the foot of the screen; the dock steps aside under it.
                visible = !(details && !sidePanel),
                enter = motion.sheetEnter(),
                exit = motion.sheetExit(),
                modifier = Modifier.align(Alignment.BottomStart),
            ) {
                Row(
                    Modifier.onGloballyPositioned { c ->
                        dock = c.local()
                        dockInset = c.fromBottom()
                    },
                    horizontalArrangement = Arrangement.spacedBy(Space.s),
                ) {
                    // The layers tile takes what its words need (up to a little over half the row); "Etapy" the rest.
                    Box(
                        Modifier
                            .widthIn(min = LAYERS_TILE_MIN, max = layersTileMax)
                            .onGloballyPositioned { layersSlot = it.local() }
                            .graphicsLayer { alpha = 0f }
                            .clearAndSetSemantics {},
                    ) { LayersTileContent(viewer, isolatedName, interactive = false, onOpen = {}) }
                    Box(
                        Modifier
                            .weight(1f, fill = false)
                            .widthIn(min = STAGES_TILE_MIN)
                            .onGloballyPositioned { stagesSlot = it.local() }
                            .graphicsLayer { alpha = 0f }
                            .clearAndSetSemantics {},
                    ) { StagesTileContent(view, interactive = false, onOpen = {}, onReturn = {}) }
                }
            }

            // Above the dock, while no panel is open: the chosen element's pill, or the gesture hint at first.
            val dockHeight = dock?.let { with(density) { (containerH - it.top).toDp() } } ?: (Sizes.tile)
            Column(
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = dockHeight + Space.s)
                    .widthIn(max = PANEL_MAX_WIDTH),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                AnimatedVisibility(visible = hintShown && selected == null && open == null && !details, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                    GestureHint()
                }
                AnimatedVisibility(visible = selected != null && open == null && !details, enter = motion.sheetEnter(), exit = motion.sheetExit()) {
                    val chosen = selected
                    if (chosen != null) {
                        GlassSurface(shape = RoundedCornerShape(Radius.tile)) {
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

            // Where each panel stands open. Upright: above the dock, as wide as the dock's row may be, leaving the
            // top of the house in view. On a phone on its side: beside the dock, bottom-aligned, as tall as the
            // window allows under the header — never across the whole short screen.
            fun frameFor(slot: Rect?): PanelFrame? {
                val d = dock ?: return null
                val tile = slot ?: return null
                val sideWidth = with(density) { PANEL_SIDE_WIDTH.toPx() }
                val besideX = d.right + gap
                if (sidePanel && containerW - besideX >= with(density) { PANEL_SIDE_MIN.toPx() }) {
                    return PanelFrame(besideX, d.bottom, minOf(sideWidth, containerW - besideX), d.bottom - headerBottom - gap)
                }
                val width = minOf(containerW, with(density) { PANEL_MAX_WIDTH.toPx() })
                val x = tile.left.coerceAtMost(containerW - width).coerceAtLeast(0f)
                val bottom = d.top - gap
                return PanelFrame(x, bottom, width, minOf(bottom - headerBottom - gap, containerH * PANEL_MAX_SHARE))
            }

            val dockShown = !(details && !sidePanel)
            DockGlass(
                panel = DockPanel.LAYERS,
                morph = layersMorph,
                open = open,
                slot = layersSlot.takeIf { dockShown },
                frame = frameFor(layersSlot),
                recede = recede,
                tile = { LayersTileContent(viewer, isolatedName, interactive = true, onOpen = { toggle(DockPanel.LAYERS) }) },
                content = {
                    LayersPanel(
                        scene = scene,
                        state = viewer,
                        shownView = model.shownView,
                        // Four cards in a row only where the panel itself is wide enough for four labels.
                        wide = frameFor(layersSlot)?.let { with(density) { it.width.toDp() } >= WIDE_CARDS } == true,
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
                slot = stagesSlot.takeIf { dockShown },
                frame = frameFor(stagesSlot),
                recede = recede,
                tile = { StagesTileContent(view, interactive = true, onOpen = { toggle(DockPanel.STAGES) }, onReturn = { progress.returnToNow() }) },
                content = {
                    StagesPanel(
                        progress = progress,
                        // "Pokaż w 3D" previews that stage and keeps the panel: the axis shows where it is.
                        onShowInModel = { stage -> if (stage != null) progress.preview(stage) else progress.returnToNow() },
                        onClose = { openName = null },
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
    slot: Rect?,
    frame: PanelFrame?,
    recede: Float,
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
        // While a finger turns the model the resting tile steps back like the header; an open panel stays.
        modifier = Modifier.graphicsLayer { alpha = if (morph.value == 0f) recede else 1f },
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
            Icon(ShellIcons.chevronDown, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
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
        modifier = Modifier
            .border(1.dp, Palette.Accent.copy(alpha = 0.7f), RoundedCornerShape(Radius.pill))
            .padding(horizontal = Space.s, vertical = 1.dp),
    )
}

/** A round glass button with one mark, named for TalkBack. */
@Composable
private fun GlassButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    GlassSurface(shape = RoundedCornerShape(Radius.pill)) {
        IconButton(onClick = onClick, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = label }) {
            Icon(icon, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
        }
    }
}

/**
 * The menu at the top end: the reference grid (a view setting, off at the
 * start), every view, layer and look in one sheet, and the source of the
 * model. The houses themselves are the house pill's.
 */
@Composable
private fun MoreMenu(model: PreviewViewModel, context: Context) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        GlassButton(ShellIcons.more, stringResource(R.string.header_more), onClick = { expanded = true })
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            containerColor = Palette.GlassOpaque,
            shape = RoundedCornerShape(Radius.tile),
            border = androidx.compose.foundation.BorderStroke(1.dp, Palette.GlassRimHigh),
            shadowElevation = Depth.panel,
        ) {
            val colors = MenuDefaults.itemColors(textColor = Palette.Ink, leadingIconColor = Palette.Ink, trailingIconColor = Palette.Accent)
            val gridOn = model.viewer.grid
            val gridState = stringResource(if (gridOn) R.string.menu_grid_on else R.string.menu_grid_off)
            DropdownMenuItem(
                text = { Text(stringResource(R.string.menu_grid), style = MaterialTheme.typography.bodyLarge) },
                leadingIcon = { Icon(ShellIcons.grid, contentDescription = null, modifier = Modifier.size(Sizes.icon)) },
                // The state in a word as well as a mark: "wyłączona" is as readable as the check.
                trailingIcon = {
                    if (gridOn) {
                        Icon(ShellIcons.check, contentDescription = null, modifier = Modifier.size(Sizes.icon))
                    } else {
                        Text(gridState, style = MaterialTheme.typography.labelMedium, color = Palette.InkMuted)
                    }
                },
                onClick = {
                    model.setGrid(!gridOn)
                    expanded = false
                },
                colors = colors,
                modifier = Modifier.heightIn(min = Sizes.touch).semantics { stateDescription = gridState },
            )
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
                .weight(1f, fill = false)
                .heightIn(min = 56.dp)
                .clickable(role = Role.Button, onClickLabel = detailsLabel, onClick = onDetails)
                .padding(start = Space.l, end = Space.s, top = Space.s, bottom = Space.s),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.s),
        ) {
            Column(Modifier.weight(1f, fill = false)) {
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

/** How far this layout's left edge stands from the right of the screen: the width it covers there. */
private fun LayoutCoordinates.fromRight(): Int = findRootCoordinates().size.width - boundsInRoot().left.roundToInt()

/** How far this layout's top edge stands from the bottom of the screen: the height it covers there. */
private fun LayoutCoordinates.fromBottom(): Int = findRootCoordinates().size.height - boundsInRoot().top.roundToInt()

/** The storey an element stands on, in the owner's words: the export's label, or the level's position. */
private fun storeyOf(scene: ModelScene, obj: SceneObject): ElementWords.Storey? =
    ElementWords.storey(obj.metadata?.levelLabel ?: scene.levelLabel(obj.levelId), scene.levels.firstOrNull { it.id == obj.levelId }?.index)

/** How far the header and the resting tiles fade while the model is turned: present, not in the way. */
private const val RECEDED_ALPHA = 0.18f

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

/** The dock's tiles at their narrowest: the layers tile the wider, as it names a state; "Etapy" a touch target and a word. */
private val LAYERS_TILE_MIN = 156.dp
private val STAGES_TILE_MIN = 112.dp

/** The most of the dock's row the layers tile may take, so "Etapy" always keeps its word. */
private const val LAYERS_TILE_SHARE = 0.55f

/** A panel beside the dock needs at least this much width; else it opens above the dock. */
private val PANEL_SIDE_MIN = 300.dp

/** From this width the four layer cards stand in one row. */
private val WIDE_CARDS = 520.dp
