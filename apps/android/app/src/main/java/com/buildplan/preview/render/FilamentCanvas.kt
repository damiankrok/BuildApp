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

    /** Called once per frame, before drawing, to advance camera and state. */
    var onFrame: ((Long) -> Unit)? = null

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (destroyed) return
            choreographer.postFrameCallback(this)
            diagnostics.frameCallbacks.incrementAndGet()
            onFrame?.invoke(frameTimeNanos)
            val chain = swapChain
            val ready = uiHelper.isReadyToRender
            diagnostics.uiHelperReady = ready
            if (chain == null || !ready) {
                diagnostics.framesSkipped.incrementAndGet()
                return
            }
            if (modelRenderer.render(chain, frameTimeNanos)) {
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
    }

    fun resume() {
        if (destroyed || running) return
        running = true
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

    private companion object {
        /** A summary line every few seconds of drawing is enough to follow a session in logcat. */
        const val LOG_EVERY_FRAMES = 300L
    }
}
