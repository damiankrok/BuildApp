package com.buildplan.preview.ui

import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.platform.LocalContext

/**
 * One motion policy for the whole app, read everywhere instead of naming
 * durations per screen.
 *
 * Motion explains continuity and nothing else: a panel growing out of the
 * control that opened it, the timeline's marker sliding to the stage, a sheet
 * rising from the edge it belongs to. Arrivals are a little slower than
 * departures, both under a quarter of a second; a panel replacing another
 * dense one waits for it to leave ([enterDelayed]), so two paragraphs never
 * share the same lines. With the system's animator scale at zero ("Remove
 * animations") every spec is a cut and every transition is none — Compose
 * ignores that setting on its own, so it is read here.
 */
@Immutable
class MotionPolicy(val reduced: Boolean) {
    /** Something arriving: Material's emphasized decelerate. */
    fun <T> enter(): FiniteAnimationSpec<T> = spec(ENTER_MS, EmphasizedDecelerate)

    /** Something leaving, quicker than it came, still eased out: the thing under the finger. */
    fun <T> exit(): FiniteAnimationSpec<T> = spec(EXIT_MS, Standard)

    /** A state changing in place: a marker moving to a stage, a mark filling. */
    fun <T> settle(): FiniteAnimationSpec<T> = spec(SETTLE_MS, Standard)

    /** Arriving only after the thing it replaces has left. */
    fun <T> enterDelayed(): FiniteAnimationSpec<T> =
        if (reduced) snap() else tween(ENTER_MS, delayMillis = EXIT_MS, easing = EmphasizedDecelerate)

    private fun <T> spec(ms: Int, easing: Easing): FiniteAnimationSpec<T> = if (reduced) snap() else tween(ms, easing = easing)

    /** A pane growing out of the rail button that opened it. */
    fun panelEnter(origin: TransformOrigin): EnterTransition =
        if (reduced) EnterTransition.None else fadeIn(enter()) + scaleIn(enter(), initialScale = PANEL_REST_SCALE, transformOrigin = origin)

    fun panelExit(origin: TransformOrigin): ExitTransition =
        if (reduced) ExitTransition.None else fadeOut(exit()) + scaleOut(exit(), targetScale = PANEL_REST_SCALE, transformOrigin = origin)

    /** Content unfolding from an edge that stays put (the timeline opening upwards from its header). */
    fun unfoldEnter(): EnterTransition =
        if (reduced) EnterTransition.None else fadeIn(enter()) + expandVertically(enter(), Alignment.Bottom)

    fun unfoldExit(): ExitTransition =
        if (reduced) ExitTransition.None else fadeOut(exit()) + shrinkVertically(exit(), Alignment.Bottom)

    /** Content unfolding below a row that stays put (a stage's editor, a folded section). */
    fun foldEnter(): EnterTransition =
        if (reduced) EnterTransition.None else fadeIn(enter()) + expandVertically(enter(), Alignment.Top)

    fun foldExit(): ExitTransition =
        if (reduced) ExitTransition.None else fadeOut(exit()) + shrinkVertically(exit(), Alignment.Top)

    /** A sheet rising from the bottom edge. */
    fun sheetEnter(): EnterTransition =
        if (reduced) EnterTransition.None else slideInVertically(enter()) { it / 3 } + fadeIn(enter())

    fun sheetExit(): ExitTransition =
        if (reduced) ExitTransition.None else slideOutVertically(exit()) { it / 3 } + fadeOut(exit())

    /** Chrome stepping back while a finger turns the model, and coming back after it lifts. */
    fun <T> recede(): FiniteAnimationSpec<T> = spec(RECEDE_MS, Standard)

    companion object {
        const val ENTER_MS = 220
        const val EXIT_MS = 150
        const val SETTLE_MS = 180
        const val RECEDE_MS = 160

        /** How far a pane starts short of its size: near enough to read as the same object. */
        const val PANEL_REST_SCALE = 0.92f

        val EmphasizedDecelerate: Easing = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)
        val Standard: Easing = CubicBezierEasing(0.2f, 0f, 0f, 1f)
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
