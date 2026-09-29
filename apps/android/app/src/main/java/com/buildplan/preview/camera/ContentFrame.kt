package com.buildplan.preview.camera

import kotlin.math.max
import kotlin.math.min

/**
 * The part of the viewport the chrome leaves free, in pixels from each edge.
 *
 * The model is drawn edge to edge — the chrome floats over it — but the
 * camera frames it inside this rectangle, so "the whole house" never starts
 * half under the top context, the tool rail or the timeline. The insets are
 * those of the chrome at rest (the timeline collapsed, no sheet open), so
 * opening a panel or scrubbing the timeline never moves the camera.
 */
data class ContentInsets(val left: Int = 0, val top: Int = 0, val right: Int = 0, val bottom: Int = 0) {
    companion object {
        val NONE = ContentInsets()
    }
}

/**
 * How the projection is shifted and scaled so that the image the camera would
 * frame over the whole viewport lands, uniformly scaled, in the free
 * rectangle: every existing fit — home, the presets, "Dopasuj", framing a
 * selection — then fits the free rectangle without knowing it exists.
 *
 * [shiftX], [shiftY] are in normalised device coordinates (the viewport
 * spans −1…1), [scale] multiplies the projection. Pure arithmetic, so the
 * rule is a unit test; the renderer only hands the three numbers to
 * Filament's `Camera.setShift` and `Camera.setScaling`.
 */
data class ContentFrame(val shiftX: Double, val shiftY: Double, val scale: Double) {
    /**
     * The shift in the units Filament's `Camera.setShift` takes: HALF the NDC
     * translation. Filament stores `shift * 2` and adds it in clip space
     * (FCamera: `mShiftCS = shift * 2.0`; projection `[scale | shiftCS] × P`),
     * so passing the NDC value moved the house twice as far as the free
     * rectangle's centre — down and left, under the chrome's opposite edge.
     */
    val filamentShiftX: Double get() = shiftX / 2.0
    val filamentShiftY: Double get() = shiftY / 2.0

    companion object {
        val IDENTITY = ContentFrame(0.0, 0.0, 1.0)

        /**
         * The free rectangle may not shrink the model below this share of the
         * viewport: an open inspector leaves under half the height, and the
         * element asked about must still fit above it.
         */
        const val MIN_SCALE = 0.35

        /** A free rectangle squeezed to nothing still frames the house at a finite distance. */
        private const val MIN_FIT_ASPECT = 0.1

        fun of(width: Int, height: Int, insets: ContentInsets): ContentFrame {
            if (width <= 0 || height <= 0 || insets == ContentInsets.NONE) return IDENTITY
            val left = insets.left.coerceIn(0, width / 2)
            val right = insets.right.coerceIn(0, width / 2)
            val top = insets.top.coerceIn(0, height / 2)
            val bottom = insets.bottom.coerceIn(0, height / 2)
            val freeW = (width - left - right).toDouble()
            val freeH = (height - top - bottom).toDouble()
            val scale = max(MIN_SCALE, min(freeW / width, freeH / height))
            // The free rectangle's centre, in NDC: x grows right, y grows up.
            val shiftX = (left - right).toDouble() / width
            val shiftY = (bottom - top).toDouble() / height
            return ContentFrame(shiftX, shiftY, scale)
        }

        /**
         * The spans a box fit may fill ([OrbitCamera.distanceToFitBox]): the free
         * rectangle's width and height, after [of]'s uniform scale, in units of
         * the camera's vertical tan(fov / 2). Without chrome: (width / height, 1).
         */
        fun fitSpan(width: Int, height: Int, insets: ContentInsets): OrbitCamera.FitSpan {
            if (width <= 0 || height <= 0) return OrbitCamera.FitSpan.SQUARE
            val frame = of(width, height, insets)
            val freeW = (width - insets.left.coerceIn(0, width / 2) - insets.right.coerceIn(0, width / 2)).toDouble()
            val freeH = (height - insets.top.coerceIn(0, height / 2) - insets.bottom.coerceIn(0, height / 2)).toDouble()
            return OrbitCamera.FitSpan(
                (freeW / (frame.scale * height)).coerceAtLeast(MIN_FIT_ASPECT),
                (freeH / (frame.scale * height)).coerceAtLeast(MIN_FIT_ASPECT),
            )
        }

        /**
         * The aspect a fit must use so that, after [of]'s uniform scale, a
         * framed sphere fills the free rectangle's narrower side — not the
         * whole viewport's. Passed to [OrbitCamera.distanceToFit]; with no
         * insets it is simply the viewport's own width over height.
         */
        fun fitAspect(width: Int, height: Int, insets: ContentInsets): Double {
            if (width <= 0 || height <= 0) return 1.0
            val frame = of(width, height, insets)
            val freeW = (width - insets.left.coerceIn(0, width / 2) - insets.right.coerceIn(0, width / 2)).toDouble()
            val freeH = (height - insets.top.coerceIn(0, height / 2) - insets.bottom.coerceIn(0, height / 2)).toDouble()
            return (min(freeW, freeH) / (frame.scale * height)).coerceAtLeast(MIN_FIT_ASPECT)
        }
    }
}
