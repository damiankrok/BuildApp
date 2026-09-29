package com.buildplan.preview.ui

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalView

private val ShellStateSaver = Saver<ShellState, String>(save = { it.encode() }, restore = { ShellState.decode(it) ?: ShellState() })

/**
 * The product shell (INTEGRATION-004A, house-first): the house workspace is
 * the root whenever a house exists, sheets stand over it one at a time, and
 * adding a house from a link is a task that returns to the same house.
 *
 * There is no navigation bar and no page beside the house. With no house on
 * the phone the root is [NoHouseScreen], which offers the one thing to do.
 * Navigation is the pure [ShellState]; this file draws it and routes the
 * system back through [ShellState.back], enabled only while back has
 * somewhere to go inside the app, so predictive back still works from the
 * bare workspace.
 *
 * The construction progress follows the open house: whenever another house
 * opens, [ProgressViewModel.bind] reads its own record; the time machine's
 * cursor resets then, and with the process, never on a sheet or a task.
 */
@Composable
fun AppShell(preview: PreviewViewModel, analyzer: AnalyzerViewModel, progress: ProgressViewModel, initial: ShellState) {
    val motion = rememberSystemMotionPolicy()
    preview.reducedMotion = motion.reduced
    var state by rememberSaveable(stateSaver = ShellStateSaver) { mutableStateOf(initial) }
    // A house analysed on this phone while another was open: offered, never forced (cycle 1, §26).
    var readyKey by rememberSaveable { mutableStateOf<String?>(null) }

    // A job that finishes (or a download deleted) joins the list of houses at once.
    LaunchedEffect(analyzer.downloads) { preview.refreshScenes() }
    // The progress, the drawing and the time machine belong to the open house.
    LaunchedEffect(preview.scene) { progress.bind(preview.scene) }

    // An analysis on this phone takes minutes in this process: the screen stays on while it runs,
    // wherever the owner is in the app (cycle 3, C3-07).
    val view = LocalView.current
    val analysing = analyzer.isRunning
    DisposableEffect(view, analysing) {
        view.keepScreenOn = analysing
        onDispose { view.keepScreenOn = false }
    }

    // An analysis finished on this phone: with no house open it opens by itself; with one open the
    // workspace offers it, so a finished job never replaces the house the owner is looking at.
    LaunchedEffect(analyzer.autoOpen) {
        val key = analyzer.autoOpen ?: return@LaunchedEffect
        analyzer.consumeAutoOpen()
        preview.refreshScenes()
        if (preview.scene == null) {
            if (preview.openKey(key)) state = ShellState()
        } else if (preview.scene?.key != key) {
            readyKey = key
        }
    }
    LaunchedEffect(preview.scene?.key) { if (readyKey == preview.scene?.key) readyKey = null }

    val back = state.back()
    BackHandler(enabled = back != null) {
        state.back()?.let { state = it }
        preview.refreshScenes()
    }

    val openHouse: (String) -> Unit = { key ->
        preview.refreshScenes()
        if (preview.openKey(key)) {
            readyKey = null
            state = ShellState()
        }
    }
    val openAnalyzer: () -> Unit = {
        analyzer.refreshDownloads()
        state = state.openAnalyzer()
    }

    CompositionLocalProvider(LocalMotionPolicy provides motion) {
        when {
            state.analyzerOpen -> AnalyzerScreen(
                model = analyzer,
                onBack = {
                    state.back()?.let { state = it }
                    preview.refreshScenes()
                },
                onOpenScene = openHouse,
            )
            preview.scenes.isEmpty() -> NoHouseScreen(preview = preview, analyzer = analyzer, onAnalyze = openAnalyzer)
            else -> HouseWorkspace(
                model = preview,
                progress = progress,
                analyzer = analyzer,
                sheet = state.sheet,
                readyKey = readyKey,
                onOpenSheet = { state = state.open(it) },
                onCloseSheet = { state = state.closeSheet() },
                onOpenHouse = openHouse,
                onAnalyze = openAnalyzer,
            )
        }
    }
}
