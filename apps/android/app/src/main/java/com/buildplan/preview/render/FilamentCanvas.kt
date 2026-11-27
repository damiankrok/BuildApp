package com.buildplan.preview.render

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Choreographer
import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import com.google.android.filament.SwapChain
import com.google.android.filament.android.DisplayHelper
import com.google.android.filament.android.UiHelper

/**
 * The render surface, its swap chain and the frame loop.
 *
 * Android can take the rendering surface away at any moment — the screen goes
 * off, the app is backgrounded, the device rotates — so the swap chain is
 * treated as disposable and the uploaded model is not. Losing and regaining a
 * surface re-creates only the swap chain; the building's buffers stay on the
 * GPU across the whole episode.
 *
 * The surface is a [SurfaceView] or a [TextureView] ([RenderSurfaceKind]).
 * Both go through the same [UiHelper] callbacks, so everything below the
 * surface — swap chain, viewport, frames, picking — is identical. What
 * differs is only how the compositor shows the result: a SurfaceView is its
 * own layer below the window, a TextureView is drawn inside the window with
 * the Compose UI around it. [diagnostics] counts what actually happened.
 */
class FilamentCanvas(context: Context, val surfaceKind: RenderSurfaceKind = RenderSurfaceKind.DEFAULT) {

    val diagnostics = RenderDiagnostics(surfaceKind)

    /** The view to place in the layout. */
    val view: View = when (surfaceKind) {
        RenderSurfaceKind.SURFACE_VIEW -> SurfaceView(context)
        RenderSurfaceKind.TEXTURE_VIEW -> TextureView(context)
    }

    val modelRenderer = FilamentModelRenderer(context.assets, diagnostics)

    private val uiHelper = UiHelper(UiHelper.ContextErrorPolicy.DONT_CHECK)
    private val displayHelper = DisplayHelper(context)
    private val choreographer: Choreographer = Choreographer.getInstance()
    private val handler = Handler(Looper.getMainLooper())

    private var swapChain: SwapChain? = null
    private var running = false
    private var destroyed = false

    /**
     * Called once per frame, before drawing, to advance camera and state; returns how many frames it wants
     * drawn: 0 when nothing it set changed the picture, [SETTLE_FRAMES] after a change that must land, 1 for
     * a step of a continuous motion that will ask again (the idle turn: settling three frames after every
     * 30 ms step would draw at the display's full rate after all).
     */
    var onFrame: ((Long) -> Int)? = null

    /**
     * Frames still to draw (APK 1356). Drawing is on demand: a change of camera, viewer state, surface
     * or a pick asks for frames, a few more than one, so a frame the GPU skipped for pacing is drawn
     * again and the last image always lands; with nothing new, the frame callback submits nothing and
     * the surface keeps showing its last frame. Until 1355 every vsync drew the whole scene, idle or not.
     */
    private var pendingFrames = SETTLE_FRAMES

    private var slowFrames = false

    /**
     * While the house turns by itself (round D), ask the display for 30 Hz, the most the turn draws, so a
     * variable-rate panel can drop its refresh rate; back to the default once it stops. Android 11+, SurfaceView.
     */
    fun preferSlowFrames(slow: Boolean) {
        if (slow == slowFrames) return
        slowFrames = slow
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.R) return
        val surface = (view as? SurfaceView)?.holder?.surface ?: return
        if (!surface.isValid) return
        surface.setFrameRate(if (slow) SLOW_FRAME_RATE else 0f, android.view.Surface.FRAME_RATE_COMPATIBILITY_DEFAULT)
    }

    /** Ask for the next frames to be drawn: something the picture depends on changed outside [onFrame]. */
    fun requestRender() {
        pendingFrames = SETTLE_FRAMES
    }

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (destroyed) return
            choreographer.postFrameCallback(this)
            diagnostics.frameCallbacks.incrementAndGet()
            val wanted = onFrame?.invoke(frameTimeNanos) ?: 0
            if (wanted > pendingFrames) pendingFrames = wanted
            if (pendingFrames <= 0) {
                diagnostics.framesIdle.incrementAndGet()
                return
            }
            val chain = swapChain
            val ready = uiHelper.isReadyToRender
            diagnostics.uiHelperReady = ready
            if (chain == null || !ready) {
                diagnostics.framesSkipped.incrementAndGet()
                return
            }
            if (modelRenderer.render(chain, frameTimeNanos)) {
                pendingFrames -= 1
                val n = diagnostics.framesRendered.incrementAndGet()
                if (n == 1L || n % LOG_EVERY_FRAMES == 0L) Log.i(RenderDiagnostics.TAG, "frame $n: ${diagnostics.summary()}")
            } else {
                diagnostics.framesSkipped.incrementAndGet()
            }
        }
    }

    init {
        uiHelper.setRenderCallback(object : UiHelper.RendererCallback {
            override fun onNativeWindowChanged(surface: android.view.Surface) {
                swapChain?.let { modelRenderer.destroySwapChain(it) }
                swapChain = modelRenderer.createSwapChain(surface, uiHelper.swapChainFlags)
                view.display?.let { displayHelper.attach(modelRenderer.renderer, it) }
                diagnostics.swapChainsCreated.incrementAndGet()
                diagnostics.swapChainAlive = true
                requestRender()
                Log.i(RenderDiagnostics.TAG, "swap chain created: ${diagnostics.summary()}")
            }

            override fun onDetachedFromSurface() {
                displayHelper.detach()
                swapChain?.let { modelRenderer.destroySwapChain(it) }
                swapChain = null
                diagnostics.swapChainAlive = false
                diagnostics.swapChainsDestroyed.incrementAndGet()
                Log.i(RenderDiagnostics.TAG, "swap chain destroyed: ${diagnostics.summary()}")
            }

            override fun onResized(width: Int, height: Int) {
                diagnostics.resizes.incrementAndGet()
                diagnostics.surfaceWidth = width
                diagnostics.surfaceHeight = height
                modelRenderer.setViewport(width, height)
                requestRender()
                Log.i(RenderDiagnostics.TAG, "resized ${width}x$height: ${diagnostics.summary()}")
            }
        })
        when (val v = view) {
            is SurfaceView -> uiHelper.attachTo(v)
            is TextureView -> uiHelper.attachTo(v)
        }
        Log.i(RenderDiagnostics.TAG, "canvas created: ${diagnostics.summary()}")
    }

    /** Pick, answering on the main thread. */
    fun pick(x: Int, y: Int, onResult: (PickOutcome) -> Unit) {
        modelRenderer.pick(x, y, handler, onResult)
        // Filament answers a pick while it renders the next frame: there must be one.
        requestRender()
    }

    fun resume() {
        if (destroyed || running) return
        running = true
        requestRender()
        diagnostics.resumed = true
        choreographer.postFrameCallback(frameCallback)
    }

    fun pause() {
        if (!running) return
        running = false
        diagnostics.resumed = false
        choreographer.removeFrameCallback(frameCallback)
    }

    fun destroy() {
        if (destroyed) return
        pause()
        destroyed = true
        uiHelper.detach()
        swapChain = null
        diagnostics.swapChainAlive = false
        modelRenderer.destroy()
        diagnostics.destroyed = true
        Log.i(RenderDiagnostics.TAG, "canvas destroyed: ${diagnostics.summary()}")
    }

    companion object {
        /** How many frames a change draws: one, and two more for a frame skipped by pacing or still queued. */
        const val SETTLE_FRAMES = 3

        /** The frame rate asked for while the house turns by itself. */
        private const val SLOW_FRAME_RATE = 30f

        /** A summary line every few seconds of drawing is enough to follow a session in logcat. */
        private const val LOG_EVERY_FRAMES = 300L
    }
}
