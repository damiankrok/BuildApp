package com.buildplan.preview

import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.buildplan.preview.ui.AnalyzerScreen
import com.buildplan.preview.ui.AnalyzerViewModel
import com.buildplan.preview.ui.PreviewScreen
import com.buildplan.preview.ui.PreviewTheme
import com.buildplan.preview.ui.PreviewViewModel

/**
 * Two screens: the viewer, and the Analyzer that feeds it.
 *
 * The viewer opens the scene bundles that ship inside the APK — offline, as
 * before — and any analysis kept on this phone. The Analyzer runs the
 * production analyzer ON the phone (BUILDAPP-03Y2: its bundle in an embedded
 * Node runtime, in a process of its own), or sends the link to the analyzer
 * service and downloads the scene it made; either way the scene is verified
 * before it is kept, and a local result opens in the viewer by itself. The
 * app holds no key: it has no account, and neither path needs one.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            PreviewTheme {
                val model: PreviewViewModel = viewModel()
                val analyzer: AnalyzerViewModel = viewModel()
                model.reducedMotion = animationsAreDisabled()
                var analyzing by rememberSaveable { mutableStateOf(false) }

                // A job that finishes (or a download deleted) while the viewer is up joins its Model menu at once.
                LaunchedEffect(analyzer.downloads) { model.refreshScenes() }

                // An analysis finished on this phone opens in the viewer by itself, once.
                LaunchedEffect(analyzer.autoOpen) {
                    val key = analyzer.autoOpen ?: return@LaunchedEffect
                    analyzer.consumeAutoOpen()
                    model.refreshScenes()
                    model.openKey(key)
                    analyzing = false
                }

                val backToViewer = {
                    analyzing = false
                    // An analysis may have been downloaded or deleted meanwhile.
                    model.refreshScenes()
                }
                BackHandler(enabled = analyzing) { backToViewer() }

                if (analyzing) {
                    AnalyzerScreen(
                        model = analyzer,
                        onBack = backToViewer,
                        onOpenScene = { key ->
                            model.refreshScenes()
                            model.openKey(key)
                            analyzing = false
                        },
                    )
                } else {
                    PreviewScreen(model, onAnalyze = {
                        analyzer.refreshDownloads()
                        analyzing = true
                    })
                }
            }
        }
    }

    /**
     * Honour the system's reduced-motion setting: with animations turned off,
     * camera transitions happen instantly instead of sweeping.
     */
    private fun animationsAreDisabled(): Boolean = try {
        Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    } catch (e: Exception) {
        false
    }
}
