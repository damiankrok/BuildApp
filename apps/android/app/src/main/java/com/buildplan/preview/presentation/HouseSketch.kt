package com.buildplan.preview.presentation

import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.scene.ModelScene
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * The house as a line drawing: an orthographic axonometric of the scene's
 * feature edges, with the lines a solid in front would hide removed. Dom shows
 * it instead of running a second 3D engine.
 *
 * Presentation, not geometry, exactly like [FeatureEdges]: it reads the
 * compiled triangles and the edges found in them, adds no vertex, and every
 * line keeps the id of the object it bounds — so the same drawing can ink the
 * part of the house that stands and leave the rest as a faint outline,
 * without knowing anything about construction.
 *
 * The view is the 3D place's own home angle ([OrbitCamera.HOME_YAW],
 * [OrbitCamera.HOME_PITCH]), so the house on Dom is the house the owner meets
 * on opening 3D. Hidden lines are removed against every opaque triangle of the
 * whole design with a small software depth buffer; glazing and markers read
 * through, as in the renderer.
 *
 * Deterministic: the same scene gives the same segments in the same order.
 */
class HouseSketch(
    /** Width over height of the drawing; coordinates run x ∈ [0, aspect], y ∈ [0, 1], y down. */
    val aspect: Float,
    /** Visible pieces per object id, 4 floats per segment (x1, y1, x2, y2), in scene order. */
    val segments: Map<String, FloatArray>,
) {
    val segmentCount: Int get() = segments.values.sumOf { it.size / 4 }

    companion object {
        /** Long side of the depth buffer, in cells: fine enough for a phone-width drawing. */
        const val RASTER = 480

        /**
         * Build the drawing of [scene]. [edges] may be passed when already
         * computed; the renderer's own set is identical.
         */
        fun of(
            scene: ModelScene,
            edges: FeatureEdgeSet = FeatureEdges.of(scene),
            yawDeg: Double = OrbitCamera.HOME_YAW,
            pitchDeg: Double = OrbitCamera.HOME_PITCH,
            /** False draws every feature edge (a wireframe): only for comparison in tests. */
            removeHiddenLines: Boolean = true,
        ): HouseSketch {
            val view = View(yawDeg, pitchDeg)

            // Opaque triangles only: glass and markers never hide a line.
            val occluders = ArrayList<FloatArray>(scene.objects.size)
            for (obj in scene.objects) {
                for (part in obj.parts) {
                    if (part.part.isTranslucent || part.count < 3) continue
                    occluders.add(obj.positions.copyOfRange(part.first * 3, (part.first + part.count) * 3))
                }
            }

            // The whole design is on the drawing: a shared seam is drawn only
            // when none of its neighbours is — with everything present, never.
            val present = scene.objects.mapTo(HashSet()) { it.id }
            val groups = edges.groups.filter { g -> g.partners.none { it in present } }

            // Frame the drawing on what is inked, so a stray far marker does not shrink the house.
            var minX = Double.POSITIVE_INFINITY
            var maxX = Double.NEGATIVE_INFINITY
            var minY = Double.POSITIVE_INFINITY
            var maxY = Double.NEGATIVE_INFINITY
            for (g in groups) {
                val p = g.positions
                var i = 0
                while (i < p.size) {
                    val sx = view.x(p[i], p[i + 1], p[i + 2])
                    val sy = view.y(p[i], p[i + 1], p[i + 2])
                    if (sx < minX) minX = sx
                    if (sx > maxX) maxX = sx
                    if (sy < minY) minY = sy
                    if (sy > maxY) maxY = sy
                    i += 3
                }
            }
            if (!minX.isFinite() || maxX - minX <= 0.0 || maxY - minY <= 0.0) return HouseSketch(1f, emptyMap())

            val spanX = maxX - minX
            val spanY = maxY - minY
            val cell = max(spanX, spanY) / RASTER
            val w = ceil(spanX / cell).toInt() + 3
            val h = ceil(spanY / cell).toInt() + 3
            val depth = DepthBuffer(w, h, view, minX - cell, maxY + cell, cell)
            if (removeHiddenLines) for (tris in occluders) depth.rasterize(tris)

            // A line lies ON its own faces; a small tolerance keeps it from losing to them.
            val bias = depth.depthRange() * DEPTH_BIAS + cell * 1.5
            val out = LinkedHashMap<String, FloatArray>()
            val pieces = FloatList()
            for (g in groups) {
                pieces.clear()
                val p = g.positions
                var i = 0
                while (i < p.size) {
                    depth.visiblePieces(
                        p[i].toDouble(), p[i + 1].toDouble(), p[i + 2].toDouble(),
                        p[i + 3].toDouble(), p[i + 4].toDouble(), p[i + 5].toDouble(),
                        bias, pieces,
                    )
                    i += 6
                }
                if (pieces.size == 0) continue
                // Normalise to the drawing: x ∈ [0, aspect], y ∈ [0, 1].
                val normalised = FloatArray(pieces.size)
                for (k in 0 until pieces.size step 2) {
                    normalised[k] = (pieces[k] / h).toFloat()
                    normalised[k + 1] = (pieces[k + 1] / h).toFloat()
                }
                out[g.objectId] = out[g.objectId]?.let { it + normalised } ?: normalised
            }
            return HouseSketch((w.toFloat() / h.toFloat()), out)
        }

        /** Share of the scene's depth range a line may sit behind its own surface and still be drawn. */
        private const val DEPTH_BIAS = 0.004
    }

    /** An orthographic camera looking at the house from the 3D place's home angle. */
    private class View(yawDeg: Double, pitchDeg: Double) {
        private val y = Math.toRadians(yawDeg)
        private val p = Math.toRadians(pitchDeg)

        /** From the target towards the eye, as in [OrbitCamera]. */
        private val toEye = Vec3(cos(p) * sin(y), sin(p), cos(p) * cos(y))
        private val right = (toEye * -1.0 cross Vec3.UP).normalized()
        private val up = right cross (toEye * -1.0)

        fun x(px: Float, py: Float, pz: Float): Double = px * right.x + py * right.y + pz * right.z
        fun y(px: Float, py: Float, pz: Float): Double = px * up.x + py * up.y + pz * up.z

        /** Larger is nearer the eye. */
        fun d(px: Float, py: Float, pz: Float): Double = px * toEye.x + py * toEye.y + pz * toEye.z
        fun x(px: Double, py: Double, pz: Double): Double = px * right.x + py * right.y + pz * right.z
        fun y(px: Double, py: Double, pz: Double): Double = px * up.x + py * up.y + pz * up.z
        fun d(px: Double, py: Double, pz: Double): Double = px * toEye.x + py * toEye.y + pz * toEye.z
    }

    /**
     * The nearest opaque surface under each cell, in raster coordinates:
     * column = (screenX - left) / cell, row = (top - screenY) / cell.
     */
    private class DepthBuffer(
        val w: Int,
        val h: Int,
        val view: View,
        val left: Double,
        val top: Double,
        val cell: Double,
    ) {
        private val z = DoubleArray(w * h) { Double.NEGATIVE_INFINITY }
        private var nearest = Double.NEGATIVE_INFINITY
        private var farthest = Double.POSITIVE_INFINITY

        fun depthRange(): Double = if (nearest > farthest) nearest - farthest else 1.0

        private fun col(sx: Double) = (sx - left) / cell
        private fun row(sy: Double) = (top - sy) / cell

        fun rasterize(tris: FloatArray) {
            var t = 0
            while (t + 8 < tris.size) {
                val ax = col(view.x(tris[t], tris[t + 1], tris[t + 2]))
                val ay = row(view.y(tris[t], tris[t + 1], tris[t + 2]))
                val ad = view.d(tris[t], tris[t + 1], tris[t + 2])
                val bx = col(view.x(tris[t + 3], tris[t + 4], tris[t + 5]))
                val by = row(view.y(tris[t + 3], tris[t + 4], tris[t + 5]))
                val bd = view.d(tris[t + 3], tris[t + 4], tris[t + 5])
                val cx = col(view.x(tris[t + 6], tris[t + 7], tris[t + 8]))
                val cy = row(view.y(tris[t + 6], tris[t + 7], tris[t + 8]))
                val cd = view.d(tris[t + 6], tris[t + 7], tris[t + 8])
                t += 9
                nearest = max(nearest, max(ad, max(bd, cd)))
                farthest = min(farthest, min(ad, min(bd, cd)))
                val area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
                if (abs(area) < 1e-9) continue
                val x0 = max(0, floor(min(ax, min(bx, cx))).toInt())
                val x1 = min(w - 1, ceil(max(ax, max(bx, cx))).toInt())
                val y0 = max(0, floor(min(ay, min(by, cy))).toInt())
                val y1 = min(h - 1, ceil(max(ay, max(by, cy))).toInt())
                for (r in y0..y1) {
                    val py = r + 0.5
                    for (c in x0..x1) {
                        val px = c + 0.5
                        val w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area
                        val w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area
                        val w2 = 1.0 - w0 - w1
                        if (w0 < -EDGE_EPS || w1 < -EDGE_EPS || w2 < -EDGE_EPS) continue
                        val d = w0 * ad + w1 * bd + w2 * cd
                        val k = r * w + c
                        if (d > z[k]) z[k] = d
                    }
                }
            }
        }

        /** The nearest surface around a point: the cell and its neighbours, so a line on a silhouette is judged by its own face. */
        private fun nearestAround(c: Int, r: Int): Double {
            var best = Double.NEGATIVE_INFINITY
            for (dr in -1..1) for (dc in -1..1) {
                val cc = c + dc
                val rr = r + dr
                if (cc < 0 || rr < 0 || cc >= w || rr >= h) continue
                val v = z[rr * w + cc]
                if (v > best) best = v
            }
            return best
        }

        private fun lowestAround(c: Int, r: Int): Double {
            var best = Double.POSITIVE_INFINITY
            for (dr in -1..1) for (dc in -1..1) {
                val cc = c + dc
                val rr = r + dr
                if (cc < 0 || rr < 0 || cc >= w || rr >= h) continue
                val v = z[rr * w + cc]
                if (v < best) best = v
            }
            return best
        }

        /**
         * Append the visible pieces of one 3D segment, in raster units
         * (x = column, y = row), 2 points per piece.
         */
        fun visiblePieces(x1: Double, y1: Double, z1: Double, x2: Double, y2: Double, z2: Double, bias: Double, out: FloatList) {
            val ax = col(view.x(x1, y1, z1))
            val ay = row(view.y(x1, y1, z1))
            val ad = view.d(x1, y1, z1)
            val bx = col(view.x(x2, y2, z2))
            val by = row(view.y(x2, y2, z2))
            val bd = view.d(x2, y2, z2)
            val length = sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay))
            if (length < 1e-6) return
            val steps = max(2, ceil(length * 2.0).toInt())
            var runStart = -1
            for (s in 0..steps) {
                val t = s.toDouble() / steps
                val px = ax + (bx - ax) * t
                val py = ay + (by - ay) * t
                val pd = ad + (bd - ad) * t
                val c = floor(px).toInt().coerceIn(0, w - 1)
                val r = floor(py).toInt().coerceIn(0, h - 1)
                // Visible when nothing stands in front of it: either the nearest surface here is
                // (about) the line's own depth, or the line is on a silhouette with open sky beside it.
                val front = nearestAround(c, r)
                val visible = pd >= front - bias || lowestAround(c, r) == Double.NEGATIVE_INFINITY && pd >= z[r * w + c] - bias
                if (visible && runStart < 0) runStart = s
                if ((!visible || s == steps) && runStart >= 0) {
                    val end = if (visible) s else s - 1
                    if (end > runStart) {
                        val t0 = runStart.toDouble() / steps
                        val t1 = end.toDouble() / steps
                        out.add(ax + (bx - ax) * t0, ay + (by - ay) * t0)
                        out.add(ax + (bx - ax) * t1, ay + (by - ay) * t1)
                    }
                    runStart = -1
                }
            }
        }

        private companion object {
            /** Barycentric slack, so neighbouring triangles leave no pinholes between them. */
            const val EDGE_EPS = 1e-4
        }
    }

    /** A growable pair list, so the sampling loop allocates nothing per point. */
    private class FloatList {
        private var data = DoubleArray(256)
        var size = 0
            private set

        fun clear() {
            size = 0
        }

        fun add(x: Double, y: Double) {
            if (size + 2 > data.size) data = data.copyOf(data.size * 2)
            data[size++] = x
            data[size++] = y
        }

        operator fun get(i: Int): Double = data[i]
    }
}
