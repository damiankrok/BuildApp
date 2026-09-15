package com.buildplan.preview.render

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import android.view.SurfaceView
import com.google.android.filament.SwapChain
import com.google.android.filament.android.DisplayHelper
import com.google.android.filament.android.UiHelper

/**
 * The SurfaceView, its swap chain and the frame loop.
 *
 * Android can take the rendering surface away at any moment — the screen goes
 * off, the app is backgrounded, the device rotates — so the swap chain is
 * treated as disposable and the uploaded model is not. Losing and regaining a
 * surface re-creates only the swap chain; the building's buffers stay on the
 * GPU across the whole episode.
 */
class FilamentCanvas(context: Context) {

    val surfaceView = SurfaceView(context)
    val modelRenderer = FilamentModelRenderer(context.assets)

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
            onFrame?.invoke(frameTimeNanos)
            val chain = swapChain ?: return
            if (!uiHelper.isReadyToRender) return
            modelRenderer.render(chain, frameTimeNanos)
        }
    }

    init {
        uiHelper.setRenderCallback(object : UiHelper.RendererCallback {
            override fun onNativeWindowChanged(surface: android.view.Surface) {
                swapChain?.let { modelRenderer.destroySwapChain(it) }
                swapChain = modelRenderer.createSwapChain(surface, uiHelper.swapChainFlags)
                displayHelper.attach(modelRenderer.renderer, surfaceView.display)
            }

            override fun onDetachedFromSurface() {
                displayHelper.detach()
                swapChain?.let { modelRenderer.destroySwapChain(it) }
                swapChain = null
            }

            override fun onResized(width: Int, height: Int) {
                modelRenderer.setViewport(width, height)
            }
        })
        uiHelper.attachTo(surfaceView)
    }

    /** Pick, answering on the main thread. */
    fun pick(x: Int, y: Int, onResult: (PickOutcome) -> Unit) {
        modelRenderer.pick(x, y, handler, onResult)
    }

    fun resume() {
        if (destroyed || running) return
        running = true
        choreographer.postFrameCallback(frameCallback)
    }

    fun pause() {
        if (!running) return
        running = false
        choreographer.removeFrameCallback(frameCallback)
    }

    fun destroy() {
        if (destroyed) return
        pause()
        destroyed = true
        uiHelper.detach()
        swapChain = null
        modelRenderer.destroy()
    }
}
