package com.buildplan.preview

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.buildplan.preview.render.RenderSurfaceKind
import com.buildplan.preview.ui.AnalyzerViewModel
import com.buildplan.preview.ui.AppShell
import com.buildplan.preview.ui.PreviewTheme
import com.buildplan.preview.ui.PreviewViewModel
import com.buildplan.preview.ui.ShellState

/**
 * The product shell (`ui/AppShell`): Dom, 3D, Etapy, Koszty, Dokumenty.
 *
 * The viewer opens the scene bundles that ship inside the APK — offline, as
 * before — and any analysis kept on this phone. The link analysis, reached
 * from Dom, runs the production analyzer ON the phone (BUILDAPP-03Y2: its
 * bundle in an embedded Node runtime, in a process of its own), or sends the
 * link to the analyzer service and downloads the scene it made; either way the
 * scene is verified before it is kept, and a local result opens in 3D by
 * itself. The app holds no key: it has no account, and neither path needs one.
 *
 * A launch may name the place to open (`ShellState.EXTRA_PLACE`: `HOUSE`,
 * `MODEL`, `STAGES`, `COSTS`, `DOCUMENTS` or `ANALYZER`), which is how the CI
 * screenshots reach every place without tapping coordinates. Another
 * (`RenderSurfaceKind.EXTRA`) picks the render surface for a device
 * comparison.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val initial = ShellState.decode(intent?.getStringExtra(ShellState.EXTRA_PLACE)) ?: ShellState()
        val surface = RenderSurfaceKind.decode(intent?.getStringExtra(RenderSurfaceKind.EXTRA))
        setContent {
            PreviewTheme {
                val model: PreviewViewModel = viewModel()
                surface?.let { model.renderSurfaceKind = it }
                val analyzer: AnalyzerViewModel = viewModel()
                AppShell(preview = model, analyzer = analyzer, initial = initial)
            }
        }
    }
}
