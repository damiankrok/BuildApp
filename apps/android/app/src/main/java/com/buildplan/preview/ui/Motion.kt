package com.buildplan.preview.ui

import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalContext

/**
 * One motion policy for the chrome. Panels come in with a short decelerating
 * ease and leave faster than they came; a panel replacing another dense one
 * waits for it to leave (`enterDelayed`), so two paragraphs never share the
 * same lines. With the system's animator scale at zero every spec snaps.
 */
@Immutable
class MotionPolicy(val reduced: Boolean) {
    fun <T> enter(): FiniteAnimationSpec<T> = if (reduced) snap() else tween(ENTER_MS)
    fun <T> exit(): FiniteAnimationSpec<T> = if (reduced) snap() else tween(EXIT_MS)
    fun <T> enterDelayed(): FiniteAnimationSpec<T> = if (reduced) snap() else tween(ENTER_MS, delayMillis = EXIT_MS)

    private companion object {
        const val ENTER_MS = 220
        const val EXIT_MS = 150
    }
}

val LocalMotionPolicy = staticCompositionLocalOf { MotionPolicy(reduced = false) }

/** The system's animator scale, observed live: turning animations off in the settings takes effect without a restart. */
@Composable
fun rememberSystemMotionPolicy(): MotionPolicy {
    val resolver = LocalContext.current.contentResolver
    var reduced by remember { mutableStateOf(animatorScale(resolver) <= 0f) }
    DisposableEffect(resolver) {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                reduced = animatorScale(resolver) <= 0f
            }
        }
        resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, observer)
        onDispose { resolver.unregisterContentObserver(observer) }
    }
    return remember(reduced) { MotionPolicy(reduced) }
}

private fun animatorScale(resolver: android.content.ContentResolver): Float =
    Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
