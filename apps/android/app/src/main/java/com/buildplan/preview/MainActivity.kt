package com.buildplan.preview

import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.buildplan.preview.ui.PreviewScreen
import com.buildplan.preview.ui.PreviewTheme
import com.buildplan.preview.ui.PreviewViewModel

/**
 * The only screen.
 *
 * This app is a viewport and an inspector. It has no navigation graph, no
 * account, no database and no network: it opens a scene bundle that shipped
 * inside it and lets the owner look at the building.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            PreviewTheme {
                val model: PreviewViewModel = viewModel()
                model.reducedMotion = animationsAreDisabled()
                PreviewScreen(model)
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
