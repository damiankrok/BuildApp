package com.buildplan.preview

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.buildplan.preview.render.RenderSurfaceKind
import com.buildplan.preview.ui.AnalyzerViewModel
import com.buildplan.preview.ui.AppShell
import com.buildplan.preview.ui.PreviewTheme
import com.buildplan.preview.ui.PreviewViewModel
import com.buildplan.preview.ui.ProgressViewModel
import com.buildplan.preview.ui.ShellState
import java.util.Locale

/**
 * The product shell (`ui/AppShell`, INTEGRATION-004A): the house workspace
 * is the root whenever a house exists; the stages, the source and the house
 * menu are sheets over it; adding a house from a link is a task that returns
 * to the same house.
 *
 * The viewer opens the scene bundles that ship inside the APK — offline, as
 * before — and any analysis kept on this phone. The link analysis runs the
 * production analyzer ON the phone (BUILDAPP-03Y2: its bundle in an embedded
 * Node runtime, in a process of its own), or sends the link to the analyzer
 * service and downloads the scene it made; either way the scene is verified
 * before it is kept. With no house open a finished analysis opens by itself;
 * with one open the workspace offers it. The app holds no key: it has no
 * account, and neither path needs one. Construction progress is kept per
 * house in the app's private storage.
 *
 * A launch may name the surface to open (`ShellState.EXTRA_PLACE`: `HOUSE`,
 * `STAGES`, `SOURCE`, `MENU` or `ANALYZER`), and may hide the scenes shipped
 * in the APK (`ShellState.EXTRA_WITHOUT_BUNDLED`) so the no-house state can
 * be seen; that is how the CI screenshots reach every surface without
 * tapping coordinates. Another extra (`RenderSurfaceKind.EXTRA`) picks the
 * render surface for a device comparison.
 */
class MainActivity : ComponentActivity() {
    /**
     * Polish is the product's language whatever the phone's: every string is
     * Polish, and plural forms ("3 etapy", "6 etapów") follow the rules of
     * the configuration's locale — on an English phone "6" took the "other"
     * form and read "6 wcześniejszego etapu". The phone's font scale and the
     * rest of its configuration are kept.
     */
    override fun attachBaseContext(newBase: Context) {
        val config = Configuration(newBase.resources.configuration).apply { setLocale(PRODUCT_LOCALE) }
        super.attachBaseContext(newBase.createConfigurationContext(config))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // The app is dark whatever the system theme: light system-bar icons on it, always.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        val initial = ShellState.decode(intent?.getStringExtra(ShellState.EXTRA_PLACE)) ?: ShellState()
        val surface = RenderSurfaceKind.decode(intent?.getStringExtra(RenderSurfaceKind.EXTRA))
        val withoutBundled = intent?.getBooleanExtra(ShellState.EXTRA_WITHOUT_BUNDLED, false) == true
        setContent {
            PreviewTheme {
                val model: PreviewViewModel = viewModel()
                surface?.let { model.renderSurfaceKind = it }
                if (withoutBundled) model.hideBundled()
                val analyzer: AnalyzerViewModel = viewModel()
                val progress: ProgressViewModel = viewModel()
                AppShell(preview = model, analyzer = analyzer, progress = progress, initial = initial)
            }
        }
    }
}

/** The one language of the product's words, for their plural and number rules. */
val PRODUCT_LOCALE: Locale = Locale.forLanguageTag("pl-PL")
