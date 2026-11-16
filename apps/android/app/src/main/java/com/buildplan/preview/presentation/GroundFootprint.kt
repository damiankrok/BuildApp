package com.buildplan.preview.presentation

import com.buildplan.preview.math.Bounds
import kotlin.math.floor
import kotlin.math.max

/**
 * The presentation ground under a model: the one-metre grid's square and the
 * sheet a look may lay under it. Derived from the model's bounds alone, so it
 * is the same on every load, carries no object id and is never a fact about
 * the plot: it is somewhere for the house to stand, not terrain.
 *
 * The grid lies a centimetre under the model's lowest point and the sheet a
 * centimetre under the grid, so the lines are never buried in the sheet and
 * the sheet never cuts into a slab.
 */
class GroundFootprint private constructor(
    val minX: Double,
    val maxX: Double,
    val minZ: Double,
    val maxZ: Double,
    /** Height of the grid lines. */
    val gridY: Double,
    /** Height of the ground sheet. */
    val sheetY: Double,
) {
    companion object {
        fun of(bounds: Bounds): GroundFootprint {
            val pad = max(2.0, bounds.radius * 0.35)
            return GroundFootprint(
                minX = floor(bounds.min.x - pad),
                maxX = floor(bounds.max.x + pad) + 1,
                minZ = floor(bounds.min.z - pad),
                maxZ = floor(bounds.max.z + pad) + 1,
                gridY = bounds.min.y - 0.01,
                sheetY = bounds.min.y - 0.02,
            )
        }
    }
}
