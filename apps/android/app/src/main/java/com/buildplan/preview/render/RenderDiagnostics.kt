package com.buildplan.preview.render

import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * Where Filament draws: a [android.view.SurfaceView] (a separate compositor
 * layer below the window, shown through a hole the window punches in itself)
 * or a [android.view.TextureView] (an ordinary view, composited inside the
 * window like any other).
 */
enum class RenderSurfaceKind {
    SURFACE_VIEW,
    TEXTURE_VIEW,
    ;

    companion object {
        /** The launch extra that picks a surface for a device comparison (`SURFACE_VIEW` or `TEXTURE_VIEW`). */
        const val EXTRA = "com.buildplan.preview.RENDER_SURFACE"

        /** What the app uses when nothing asks otherwise. */
        val DEFAULT = SURFACE_VIEW

        fun decode(text: String?): RenderSurfaceKind? = entries.firstOrNull { it.name.equals(text?.trim(), ignoreCase = true) }
    }
}

/**
 * What one viewport's renderer has actually done, counted as it happens.
 *
 * The counters answer "why is the 3D blank?" with facts instead of guesses:
 * whether a render target was ever attached, whether a swap chain exists,
 * whether the viewport has a size, whether frames were drawn, whether the
 * camera is finite and whether anything was in the scene to draw. They are
 * written on the main thread by the frame loop and read from any thread (a
 * device test, a log line), so every field is atomic or volatile. Nothing
 * here changes what is drawn.
 */
class RenderDiagnostics(val surfaceKind: RenderSurfaceKind) {
    /** Times Android handed the renderer a native window (and a swap chain was created for it). */
    val swapChainsCreated = AtomicInteger()

    /** Times the native window was taken away (and the swap chain destroyed). */
    val swapChainsDestroyed = AtomicInteger()

    @Volatile var swapChainAlive: Boolean = false

    /** Resize callbacks from the surface, and the last size they carried. */
    val resizes = AtomicInteger()
    @Volatile var surfaceWidth: Int = 0
    @Volatile var surfaceHeight: Int = 0

    /** The Filament viewport actually set on the view. */
    @Volatile var viewportWidth: Int = 0
    @Volatile var viewportHeight: Int = 0

    /** Frame callbacks, frames Filament agreed to draw, and frames it skipped (no swap chain, not ready, or paced). */
    val frameCallbacks = AtomicLong()
    val framesRendered = AtomicLong()
    val framesSkipped = AtomicLong()

    @Volatile var uiHelperReady: Boolean = false
    @Volatile var modelUploads: Int = 0

    /** Objects of the uploaded scene that have renderable geometry. */
    @Volatile var renderableObjects: Int = 0

    /** Renderables in the Filament scene at the last frame (surfaces, overlays, guides). */
    @Volatile var sceneRenderables: Int = 0

    /** Semantic objects currently in the Filament scene. */
    @Volatile var visibleObjects: Int = 0

    @Volatile var cameraFinite: Boolean = false

    @Volatile var resumed: Boolean = false
    @Volatile var destroyed: Boolean = false

    /**
     * Ready means: a render target exists and has a size, the model is
     * uploaded with something in the scene, the camera is finite and frames
     * are being drawn. Whether those frames reach the screen is a separate,
     * compositor question that only pixels can answer.
     */
    val ready: Boolean
        get() = swapChainAlive && uiHelperReady && viewportWidth > 0 && viewportHeight > 0 &&
            modelUploads > 0 && sceneRenderables > 0 && visibleObjects > 0 && cameraFinite && framesRendered.get() > 0

    /** One line for logcat and reports; stable key=value order. */
    fun summary(): String =
        "surface=$surfaceKind swapChain=${if (swapChainAlive) "alive" else "none"} created=${swapChainsCreated.get()} " +
            "destroyed=${swapChainsDestroyed.get()} uiHelperReady=$uiHelperReady resizes=${resizes.get()} " +
            "surfaceSize=${surfaceWidth}x$surfaceHeight viewport=${viewportWidth}x$viewportHeight " +
            "frames=${framesRendered.get()}/${frameCallbacks.get()} skipped=${framesSkipped.get()} " +
            "uploads=$modelUploads renderableObjects=$renderableObjects visibleObjects=$visibleObjects " +
            "sceneRenderables=$sceneRenderables cameraFinite=$cameraFinite resumed=$resumed destroyed=$destroyed " +
            "liveEngines=${liveEngines.get()} ready=$ready"

    companion object {
        /** The logcat tag of every renderer lifecycle line. */
        const val TAG = "BuildPlanRender"

        /**
         * Filament engines alive in this process. One viewport owns one
         * engine; after leaving the model and entering it again this must
         * still be one.
         */
        val liveEngines = AtomicInteger()
    }
}
