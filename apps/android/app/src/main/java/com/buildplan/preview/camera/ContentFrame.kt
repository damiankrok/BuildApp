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
    companion object {
        val IDENTITY = ContentFrame(0.0, 0.0, 1.0)

        /** The free rectangle may not shrink the model below this share of the viewport. */
        const val MIN_SCALE = 0.55

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
    }
}
