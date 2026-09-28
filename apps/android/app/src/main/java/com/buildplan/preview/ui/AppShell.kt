package com.buildplan.preview.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R

private val ShellStateSaver = Saver<ShellState, String>(save = { it.encode() }, restore = { ShellState.decode(it) ?: ShellState() })

/**
 * The product shell: five places under one bottom bar — or on a rail at the
 * start edge when the window is short (a phone on its side) or wide — and
 * the model on the whole screen when the owner goes to `3D`.
 *
 * The bar sits below the content, never over it; while the keyboard is up it
 * steps aside, so the content's inset includes the keyboard. The content
 * keeps clear of the status bar, the navigation bar, the display cutout and
 * the keyboard (the safe drawing area). The 3D place hides the bar and
 * carries its own way back. Navigation is the pure [ShellState]; this file
 * draws it and routes the system back through [ShellState.back], enabled
 * only while back has somewhere to go inside the app, so predictive back
 * still works from `Dom`.
 *
 * The construction progress follows the open house: whenever another house
 * opens, [ProgressViewModel.bind] reads its own record. The time machine's
 * cursor is a way of looking at the 3D only, so leaving 3D puts it back to
 * now.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AppShell(preview: PreviewViewModel, analyzer: AnalyzerViewModel, progress: ProgressViewModel, initial: ShellState) {
    val motion = rememberSystemMotionPolicy()
    preview.reducedMotion = motion.reduced
    var state by rememberSaveable(stateSaver = ShellStateSaver) { mutableStateOf(initial) }

    // A job that finishes (or a download deleted) joins the list of houses at once.
    LaunchedEffect(analyzer.downloads) { preview.refreshScenes() }
    // The progress, the drawing and the time machine belong to the open house.
    LaunchedEffect(preview.scene) { progress.bind(preview.scene) }
    LaunchedEffect(state.place) { if (state.place != AppPlace.MODEL) progress.returnToNow() }

    // An analysis finished on this phone opens by itself, once, on the whole screen.
    LaunchedEffect(analyzer.autoOpen) {
        val key = analyzer.autoOpen ?: return@LaunchedEffect
        analyzer.consumeAutoOpen()
        preview.refreshScenes()
        if (preview.openKey(key)) state = ShellState(AppPlace.MODEL, cameFrom = AppPlace.HOUSE)
    }

    val back = state.back()
    BackHandler(enabled = back != null) {
        state.back()?.let { state = it }
        preview.refreshScenes()
    }

    CompositionLocalProvider(LocalMotionPolicy provides motion) {
        if (state.immersive) {
            ModelWorkspace(
                preview,
                progress,
                onBack = { state.back()?.let { state = it } },
                onSetProgress = { state = ShellState(AppPlace.STAGES) },
            )
        } else {
            BoxWithConstraints(Modifier.fillMaxSize().background(Palette.Ground)) {
                // A short window (a phone on its side) or a wide one: the places go to a rail at the
                // start edge, and the content keeps the height. While typing, the bar steps aside so
                // the content's inset includes the keyboard.
                val rail = maxHeight < SHORT_WINDOW || maxWidth >= WIDE_WINDOW
                val typing = WindowInsets.isImeVisible
                Scaffold(
                    containerColor = Palette.Ground,
                    contentWindowInsets = WindowInsets.safeDrawing,
                    bottomBar = { if (!rail && !typing) PlacesBar(current = state.place, onSelect = { state = state.go(it) }) },
                ) { padding ->
                    Row(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
                        if (rail) PlacesRail(current = state.place, onSelect = { state = state.go(it) })
                        Box(Modifier.weight(1f).fillMaxHeight()) {
                            when {
                                state.analyzerOpen -> AnalyzerScreen(
                                    model = analyzer,
                                    onBack = {
                                        state.back()?.let { state = it }
                                        preview.refreshScenes()
                                    },
                                    onOpenScene = { key ->
                                        preview.refreshScenes()
                                        if (preview.openKey(key)) state = ShellState(AppPlace.MODEL, cameFrom = AppPlace.HOUSE)
                                    },
                                )
                                state.place == AppPlace.HOUSE -> HouseScreen(
                                    preview = preview,
                                    analyzer = analyzer,
                                    progress = progress,
                                    onOpenModel = { state = state.go(AppPlace.MODEL) },
                                    onAnalyze = {
                                        analyzer.refreshDownloads()
                                        state = state.openAnalyzer()
                                    },
                                    onOpenStages = { state = state.go(AppPlace.STAGES) },
                                )
                                state.place == AppPlace.STAGES -> StagesScreen(
                                    progress = progress,
                                    sceneTitle = preview.scene?.title,
                                    onShowInModel = { stage ->
                                        if (stage != null) progress.preview(stage) else progress.returnToNow()
                                        state = state.go(AppPlace.MODEL)
                                    },
                                )
                                else -> EmptyPlace(
                                    state.place,
                                    onGoStages = { state = state.go(AppPlace.STAGES) },
                                    onGoHouse = { state = state.go(AppPlace.HOUSE) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * The same five places as a rail at the start edge, for a short or a wide
 * window: the phone on its side keeps its height for the content. The chosen
 * place is marked by a line on its start edge and a well behind its icon —
 * a shape and a word, never colour alone.
 */
@Composable
private fun PlacesRail(current: AppPlace, onSelect: (AppPlace) -> Unit) {
    Row(Modifier.fillMaxHeight()) {
        Column(
            Modifier.fillMaxHeight().width(RAIL_WIDTH).background(Palette.Raised).selectableGroup(),
            verticalArrangement = Arrangement.spacedBy(Space.xxs, Alignment.CenterVertically),
        ) {
            for (place in AppPlace.entries) {
                val selected = place == current
                val stateText = stringResource(if (selected) R.string.state_selected else R.string.state_not_selected)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 64.dp)
                        .selectable(selected = selected, onClick = { onSelect(place) }, role = Role.Tab)
                        .semantics { stateDescription = stateText },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .width(2.dp)
                            .height(32.dp)
                            .background(if (selected) Palette.Ink else androidx.compose.ui.graphics.Color.Transparent, RoundedCornerShape(1.dp)),
                    )
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            Modifier
                                .size(width = 48.dp, height = 28.dp)
                                .background(if (selected) Palette.Well else androidx.compose.ui.graphics.Color.Transparent, RoundedCornerShape(Radius.control)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(ShellIcons.of(place), contentDescription = null, tint = if (selected) Palette.Ink else Palette.InkMuted, modifier = Modifier.size(Sizes.icon))
                        }
                        Text(
                            stringResource(place.label),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (selected) Palette.Ink else Palette.InkMuted,
                            textAlign = TextAlign.Center,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = Space.xxs, start = Space.xxs, end = Space.xxs),
                        )
                    }
                }
            }
        }
        Box(Modifier.fillMaxHeight().width(1.dp).background(Palette.Hairline))
    }
}

/** Below this height the window is a phone on its side; from this width, a large screen: the places take a rail. */
private val SHORT_WINDOW = 480.dp
private val WIDE_WINDOW = 600.dp
private val RAIL_WIDTH = 80.dp

/**
 * The five places, as equal cells along the bottom edge. The chosen one is
 * pressed into the bar and marked by a line on its top edge, and its label
 * turns full ink — a shape and a word, never colour alone.
 */
@Composable
private fun PlacesBar(current: AppPlace, onSelect: (AppPlace) -> Unit) {
    Column(Modifier.fillMaxWidth().background(Palette.Raised).navigationBarsPadding()) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(Palette.Hairline))
        Row(
            Modifier.fillMaxWidth().heightIn(min = 64.dp).selectableGroup().padding(horizontal = Space.xs),
            horizontalArrangement = Arrangement.spacedBy(Space.xxs),
        ) {
            for (place in AppPlace.entries) {
                val selected = place == current
                val stateText = stringResource(if (selected) R.string.state_selected else R.string.state_not_selected)
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 64.dp)
                        .selectable(selected = selected, onClick = { onSelect(place) }, role = Role.Tab)
                        // The label is the name; a contentDescription here would replace it on the merged node.
                        .semantics { stateDescription = stateText },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(0.5f)
                            .height(2.dp)
                            .background(if (selected) Palette.Ink else androidx.compose.ui.graphics.Color.Transparent, RoundedCornerShape(1.dp)),
                    )
                    Box(
                        Modifier
                            .padding(top = Space.s)
                            .size(width = 48.dp, height = 28.dp)
                            .background(if (selected) Palette.Well else androidx.compose.ui.graphics.Color.Transparent, RoundedCornerShape(Radius.control)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(ShellIcons.of(place), contentDescription = null, tint = if (selected) Palette.Ink else Palette.InkMuted, modifier = Modifier.size(Sizes.icon))
                    }
                    Text(
                        stringResource(place.label),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (selected) Palette.Ink else Palette.InkMuted,
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = Space.xxs, bottom = Space.s),
                    )
                }
            }
        }
    }
}
