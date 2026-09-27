package com.buildplan.preview.presentation

import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import com.buildplan.preview.scene.SemanticGroup
import com.buildplan.preview.scene.TangentFrames
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * The module a roof covering repeats: how big a tile is, how much of it
 * shows, and how far it stands off the roof plane.
 *
 * ## Every number is a display assumption
 *
 * None of these is a fact about any building. A model states a roof's planes;
 * it does not state the gauge its tiles are laid to, and a viewer that
 * pretended to know would be inventing a construction detail. The defaults
 * are a generic interlocking-tile module, chosen for how a roof reads on a
 * phone, and apply to every pitched roof the same way.
 *
 * Metres along the roof plane; the offsets are measured along the plane's
 * normal, so a tile on a steep slope stands off it by exactly what a tile on a
 * shallow one does.
 */
data class RoofCoverSpec(
    /** Across the slope: the tile's width, and the spacing of tiles in a course. */
    val moduleWidth: Double = 0.30,
    /** Up the slope: the tile's full length, of which only [exposure] shows. */
    val moduleLength: Double = 0.42,
    /** The visible length of each course, and so the row pitch. Less than [moduleLength], or nothing laps. */
    val exposure: Double = 0.33,
    /** How far the tail's corners are drawn back to round it. Under the lap. */
    val tailRound: Double = 0.045,
    /** How high the tile's middle rises above its sides. */
    val camber: Double = 0.022,
    /** How far the tile's head stands off the plane. Never zero, or it fights the plane for depth. */
    val lift: Double = 0.012,
    /** How much higher the tail stands than the head, because it rests on the course below. */
    val step: Double = 0.02,
    /** The fraction of [moduleWidth] a trimmed tile must keep to be laid at all. */
    val minimumWidthFraction: Double = 0.25,
    /** Planes flatter than this are not tiled: a membrane roof is not a tiled roof. Degrees. */
    val minimumPitchDeg: Double = 12.0,
    /** Planes steeper than this are walls, not roofs. Degrees. */
    val maximumPitchDeg: Double = 75.0,
    /** How far a tile stops short of a chimney or a rooflight: the flashing, as a gap. */
    val blockerMargin: Double = 0.03,
) {
    init {
        for ((name, value) in listOf("moduleWidth" to moduleWidth, "moduleLength" to moduleLength, "exposure" to exposure, "lift" to lift)) {
            require(value.isFinite() && value > 1e-4) { "RoofCoverSpec $name must be a positive length in metres, was $value" }
        }
        for ((name, value) in listOf("tailRound" to tailRound, "camber" to camber, "step" to step, "blockerMargin" to blockerMargin)) {
            require(value.isFinite() && value >= 0.0) { "RoofCoverSpec $name must be a finite non-negative length, was $value" }
        }
        require(exposure < moduleLength) { "RoofCoverSpec exposure $exposure must be less than moduleLength $moduleLength, or no course laps the next" }
        require(tailRound < moduleLength - exposure + 1e-4) { "RoofCoverSpec tailRound $tailRound reaches past the lap of ${moduleLength - exposure}" }
        require(minimumWidthFraction > 0.0 && minimumWidthFraction <= 1.0) { "RoofCoverSpec minimumWidthFraction must be in (0, 1]" }
        require(minimumPitchDeg >= 0.0 && minimumPitchDeg < maximumPitchDeg && maximumPitchDeg < 90.0) { "RoofCoverSpec pitch range is invalid" }
    }

    /** The furthest any point of a tile stands off the roof plane. */
    val maximumOffset: Double get() = lift + step + camber

    companion object {
        val DEFAULT = RoofCoverSpec()
    }
}

/** Why a tile position was left empty. */
enum class TileDrop {
    /** Trimmed at the plane's edge to less than the minimum width. */
    TOO_NARROW,

    /** Part of it would lie off the roof surface: past an edge that is not straight, or over a hole the model cut. */
    OFF_SURFACE,

    /** Its plan footprint meets a chimney or a rooflight unit. */
    BLOCKED,
}

/**
 * The covering of one roof object: every tile of every coverable plane, in one
 * batch, answering with the roof's own id.
 *
 * There is no tile entity, no tile id and no tile pick. A tap on a tile is a
 * tap on the roof, and hiding the roof hides its covering through the same id
 * that hides its planes.
 */
class RoofCoverBatch(
    val objectId: String,
    /** Render-frame positions, 3 floats per vertex. */
    val positions: FloatArray,
    /** Tangent-frame quaternions, 4 floats per vertex, following each tile's curve. */
    val tangents: FloatArray,
    val indices: IntArray,
    val tileCount: Int,
    val planeCount: Int,
    val bounds: Bounds,
    val dropped: Map<TileDrop, Int>,
) {
    val vertexCount: Int get() = positions.size / 3
    val triangleCount: Int get() = indices.size / 3
}

/**
 * One coverable plane of a roof: the upward faces of the roof's own compiled
 * triangles that lie in one plane, in that plane's frame.
 *
 * [across] × [up] = [normal]; `s` runs across the slope and `t` up it.
 */
class CoverPlane(
    val objectId: String,
    val origin: Vec3,
    val across: Vec3,
    val up: Vec3,
    val normal: Vec3,
    /** The plane's triangles in `(s, t)`: 6 doubles per triangle. */
    val region: DoubleArray,
    val pitchDeg: Double,
) {
    val triangleCount: Int get() = region.size / 6

    fun at(s: Double, t: Double, offset: Double): Vec3 =
        origin + across * s + up * t + normal * offset

    /** Area of the plane's surface, square metres. */
    val area: Double
        get() {
            var sum = 0.0
            for (i in 0 until triangleCount) {
                val o = i * 6
                sum += abs((region[o + 2] - region[o]) * (region[o + 5] - region[o + 1]) - (region[o + 4] - region[o]) * (region[o + 3] - region[o + 1])) / 2.0
            }
            return sum
        }

    val tMin: Double get() = (0 until triangleCount * 3).minOf { region[it * 2 + 1] }
    val tMax: Double get() = (0 until triangleCount * 3).maxOf { region[it * 2 + 1] }
    val sMin: Double get() = (0 until triangleCount * 3).minOf { region[it * 2] }
    val sMax: Double get() = (0 until triangleCount * 3).maxOf { region[it * 2] }

    /**
     * The spans of `s` the surface covers on the line at [t]: the union of
     * every triangle's crossing, merged. Exact for any outline, holes included,
     * because it is read off the triangles themselves.
     */
    fun coverage(t: Double): List<DoubleArray> {
        val spans = ArrayList<DoubleArray>()
        for (i in 0 until triangleCount) {
            val o = i * 6
            var low = Double.POSITIVE_INFINITY
            var high = Double.NEGATIVE_INFINITY
            for (e in 0 until 3) {
                val ps = region[o + e * 2]; val pt = region[o + e * 2 + 1]
                val qs = region[o + ((e + 1) % 3) * 2]; val qt = region[o + ((e + 1) % 3) * 2 + 1]
                if ((pt - t) * (qt - t) > 0.0) continue
                if (abs(qt - pt) < 1e-12) {
                    low = min(low, min(ps, qs)); high = max(high, max(ps, qs))
                } else {
                    val s = ps + (t - pt) / (qt - pt) * (qs - ps)
                    low = min(low, s); high = max(high, s)
                }
            }
            if (low <= high) spans.add(doubleArrayOf(low, high))
        }
        spans.sortBy { it[0] }
        val merged = ArrayList<DoubleArray>()
        for (span in spans) {
            val last = merged.lastOrNull()
            if (last != null && span[0] <= last[1] + MERGE_TOLERANCE) last[1] = max(last[1], span[1]) else merged.add(span.copyOf())
        }
        return merged
    }

    private companion object {
        /** Spans closer than this are one span: the shared side of two triangles. */
        const val MERGE_TOLERANCE = 1e-5
    }
}

/**
 * Lays a presentation-only tile covering over the pitched roof planes of a
 * compiled scene.
 *
 * ## Derived, and only derived
 *
 * The input is the scene's own triangles. A plane is found, not stated: the
 * upward faces of an object's ROOF or ROOF_PLANE parts, grouped by plane, with
 * a pitch between the spec's limits. Nothing here knows a gable, a ridge
 * direction, a house or a project, and nothing it produces goes back into the
 * scene: the roof's planes, its area and every quantity read off it are what
 * they were without a covering.
 *
 * ## Holes and penetrations
 *
 * A roof opening the compiler cut is a hole in the plane's triangles, so a
 * tile that would lie over it is found off the surface and trimmed to its
 * edge or dropped — the covering respects the opening because the geometry
 * does, whatever fills it (a rooflight, a dormer, a stack). A chimney or a
 * rooflight unit is also a blocker: its plan footprint, grown by the flashing
 * margin, keeps tiles off even where the compiler cut nothing (a stack
 * standing through an uncut roof). An opening's reveal is deliberately NOT a
 * blocker: a dormer's reveal spans the dormer, and would strip the dormer's
 * own roof. A tile whose trimmed outline cannot be proved to lie on the
 * surface is not laid: the covering never clips an arbitrary hole into
 * itself, it leaves a whole tile out.
 *
 * ## The tile
 *
 * Adapted from the donor viewer's curved tile: five vertices at the tail and
 * five at the head, a shallow barrel across, a rounded tail, and a tilt so the
 * tail stands on the course below — eight triangles. One adaptation: a short
 * skirt drops from the tail towards the course below (eight more triangles).
 * The donor relied on a 2048-texel shadow map and high-quality occlusion to
 * separate the courses; this viewer keeps Filament's default shadow map and
 * low-quality occlusion for the phone's sake, and the skirt makes each course
 * edge a real face the light can see. Courses are laid on a gauge that divides
 * the slope exactly; tiles in a course are aligned so the rolls run straight
 * down the slope.
 */
object RoofCover {

    /** The parts whose upward faces are roof surface. */
    val COVERED_PARTS: Set<GeometryPart> = setOf(GeometryPart.ROOF, GeometryPart.ROOF_PLANE)

    /** The parts whose footprint no tile may cross: what stands through or sits in a roof. */
    val BLOCKER_PARTS: Set<GeometryPart> = setOf(
        GeometryPart.CHIMNEY,
        GeometryPart.ROOFLIGHT_FRAME,
        GeometryPart.ROOFLIGHT_GLASS,
    )

    const val VERTICES_ACROSS: Int = 5

    /** Tail and head rows of the tile, then the skirt's foot. */
    const val VERTICES_PER_TILE: Int = VERTICES_ACROSS * 3

    /** Eight for the tile, eight for the skirt. */
    const val TRIANGLES_PER_TILE: Int = (VERTICES_ACROSS - 1) * 4

    /** Plane grouping: normals within this cosine and offsets within this many metres are one plane. */
    private const val PLANE_DOT = 0.99995
    private const val PLANE_OFFSET = 0.002

    /** How far off the surface a trimmed tile may reach and still count as on it, metres. */
    private const val ON_SURFACE_TOLERANCE = 1e-4

    /** Twice the area, square metres, below which a tile triangle is not emitted: one square millimetre. */
    private const val DEGENERATE_DOUBLE_AREA = 2e-6

    /** The least a tile-top triangle may face along the plane's normal (cosine): the barrel's steepest facet is far above it. */
    private const val MIN_TOP_FACING = 0.8

    /** Every roof covering in [scene], one batch per roof object that has a coverable plane. */
    fun of(scene: ModelScene, spec: RoofCoverSpec = RoofCoverSpec.DEFAULT): List<RoofCoverBatch> {
        val blockers = blockersOf(scene)
        return scene.objects.mapNotNull { obj ->
            val planes = planesOf(obj, spec)
            if (planes.isEmpty()) null else cover(obj.id, planes, spec, blockers)
        }
    }

    /** The coverable planes of one object, in first-triangle order. */
    fun planesOf(obj: SceneObject, spec: RoofCoverSpec = RoofCoverSpec.DEFAULT): List<CoverPlane> {
        class Cluster(val normal: Vec3, val offset: Double) {
            val triangles = ArrayList<Array<Vec3>>()
            var weighted = Vec3.ZERO
        }
        val clusters = ArrayList<Cluster>()
        for (part in obj.parts) {
            if (part.part !in COVERED_PARTS || part.semanticGroup == SemanticGroup.FLAT_ROOF) continue
            for (t in 0 until part.count / 3) {
                val base = (part.first + t * 3) * 3
                val a = vertex(obj.positions, base)
                val b = vertex(obj.positions, base + 3)
                val c = vertex(obj.positions, base + 6)
                val cross = (b - a) cross (c - a)
                val doubleArea = cross.length
                if (doubleArea <= DEGENERATE_DOUBLE_AREA) continue
                val n = cross * (1.0 / doubleArea)
                if (n.y <= 0.0) continue
                val pitch = Math.toDegrees(acos(n.y.coerceIn(-1.0, 1.0)))
                if (pitch < spec.minimumPitchDeg || pitch > spec.maximumPitchDeg) continue
                val offset = n dot a
                val cluster = clusters.firstOrNull { (it.normal dot n) > PLANE_DOT && abs(it.offset - offset) < PLANE_OFFSET }
                    ?: Cluster(n, offset).also { clusters.add(it) }
                cluster.triangles.add(arrayOf(a, b, c))
                cluster.weighted = cluster.weighted + cross
            }
        }
        return clusters.mapNotNull { cluster ->
            val n = cluster.weighted.normalized()
            val horizontal = sqrt(n.x * n.x + n.z * n.z)
            if (horizontal <= 1e-9) return@mapNotNull null
            // Steepest ascent in the plane — world up projected onto it — and the direction across it.
            val up = (Vec3.UP - n * n.y) * (1.0 / horizontal)
            val across = up cross n
            val origin = cluster.triangles.first()[0]
            val region = DoubleArray(cluster.triangles.size * 6)
            for ((i, tri) in cluster.triangles.withIndex()) {
                for (v in 0 until 3) {
                    val d = tri[v] - origin
                    region[i * 6 + v * 2] = d dot across
                    region[i * 6 + v * 2 + 1] = d dot up
                }
            }
            CoverPlane(obj.id, origin, across, up, n, region, Math.toDegrees(acos(n.y.coerceIn(-1.0, 1.0))))
        }
    }

    /** The bounds of every chimney, rooflight and roof-opening part in [scene]. */
    fun blockersOf(scene: ModelScene): List<Bounds> = scene.objects.flatMap { obj ->
        obj.parts.filter { it.part in BLOCKER_PARTS && it.count > 0 }.map { part ->
            var b = Bounds.EMPTY
            for (v in 0 until part.count) b = b.union(Bounds.around(vertex(obj.positions, (part.first + v) * 3)))
            b
        }
    }

    /** Lays the tiles of [planes] into one batch for [objectId]. */
    fun cover(objectId: String, planes: List<CoverPlane>, spec: RoofCoverSpec, blockers: List<Bounds>): RoofCoverBatch? {
        val batch = Batch(spec, blockers)
        for (plane in planes) batch.coverPlane(plane)
        return batch.build(objectId, planes.size)
    }

    private fun vertex(positions: FloatArray, offset: Int): Vec3 =
        Vec3(positions[offset].toDouble(), positions[offset + 1].toDouble(), positions[offset + 2].toDouble())

    private class Batch(private val spec: RoofCoverSpec, private val blockers: List<Bounds>) {
        val positions = ArrayList<Float>()
        val tangents = ArrayList<Float>()
        val indices = ArrayList<Int>()
        var tiles = 0
        val dropped = LinkedHashMap<TileDrop, Int>().apply { TileDrop.entries.forEach { put(it, 0) } }

        private fun drop(reason: TileDrop) { dropped[reason] = dropped.getValue(reason) + 1 }

        fun coverPlane(plane: CoverPlane) {
            val tMin = plane.tMin
            val tMax = plane.tMax
            val sMin = plane.sMin
            val sMax = plane.sMax
            val slope = tMax - tMin
            val width = sMax - sMin
            if (slope <= 1e-4 || width <= 1e-4) return
            val inset = 1e-5
            fun inside(t: Double): Double = t.coerceIn(tMin + inset, tMax - inset)
            val vertexTs = (0 until plane.triangleCount * 3).map { plane.region[it * 2 + 1] }.distinct().sorted()

            val rowCount = max(1, ceil(slope / spec.exposure - 1e-9).toInt())
            val gauge = slope / rowCount
            val columnCount = max(1, ceil(width / spec.moduleWidth - 1e-9).toInt())

            for (row in 0 until rowCount) {
                val tail = tMin + row * gauge
                val head = min(tail + spec.moduleLength, tMax)
                val length = head - tail
                if (length <= 1e-4) continue
                val round = min(spec.tailRound, length / 2.0)

                val tailCoverage = intersect(plane.coverage(inside(tail)), plane.coverage(inside(tail + round)))
                val headCoverage = plane.coverage(inside(head))
                // Every place along the row where the outline may bend, and
                // between them, so a trimmed tile is proved to lie on the
                // surface along its whole length rather than at its two ends.
                val marks = (listOf(tail, tail + round, head) + vertexTs.filter { it > tail && it < head }).distinct().sorted()
                val samples = (marks + marks.zipWithNext { a, b -> (a + b) / 2.0 }).distinct().sorted()
                val sampleCoverage = samples.map { plane.coverage(inside(it)) }

                for (column in 0 until columnCount) {
                    val start = sMin + column * spec.moduleWidth
                    layTile(plane, start, tail, head, round, tailCoverage, headCoverage, samples, sampleCoverage)
                }
            }
        }

        private fun layTile(
            plane: CoverPlane,
            start: Double,
            tail: Double,
            head: Double,
            round: Double,
            tailCoverage: List<DoubleArray>,
            headCoverage: List<DoubleArray>,
            samples: List<Double>,
            sampleCoverage: List<List<DoubleArray>>,
        ) {
            val w = spec.moduleWidth
            val end = start + w
            val tailSpan = bestSpan(tailCoverage, start, end) ?: return drop(TileDrop.OFF_SURFACE)
            val headSpan = bestSpan(headCoverage, start, end) ?: return drop(TileDrop.OFF_SURFACE)
            val n = VERTICES_ACROSS
            val tailT = DoubleArray(n)
            val tailS = DoubleArray(n)
            val headS = DoubleArray(n)
            for (i in 0 until n) {
                val x = -1.0 + 2.0 * i / (n - 1)
                val nominal = start + w * i / (n - 1)
                tailT[i] = tail + round * (1.0 - sqrt(max(0.0, 1.0 - x * x)))
                tailS[i] = nominal.coerceIn(tailSpan[0], tailSpan[1])
                headS[i] = nominal.coerceIn(headSpan[0], headSpan[1])
            }
            val tailWidth = tailS[n - 1] - tailS[0]
            val headWidth = headS[n - 1] - headS[0]
            if ((tailWidth + headWidth) / 2.0 < spec.minimumWidthFraction * w) return drop(TileDrop.TOO_NARROW)

            for ((k, t) in samples.withIndex()) {
                val f = ((t - tail) / (head - tail)).coerceIn(0.0, 1.0)
                val left = tailS[0] + (headS[0] - tailS[0]) * f
                val right = tailS[n - 1] + (headS[n - 1] - tailS[n - 1]) * f
                val covered = sampleCoverage[k].any { it[0] - ON_SURFACE_TOLERANCE <= left && right <= it[1] + ON_SURFACE_TOLERANCE }
                if (!covered) return drop(TileDrop.OFF_SURFACE)
            }

            val corners = listOf(
                plane.at(tailS[0], tail, 0.0),
                plane.at(tailS[n - 1], tail, 0.0),
                plane.at(headS[n - 1], head, 0.0),
                plane.at(headS[0], head, 0.0),
            )
            if (blockers.any { blocks(it, corners) }) return drop(TileDrop.BLOCKED)

            val first = positions.size / 3
            val centre = start + w / 2.0
            val tilt = -spec.step / spec.moduleLength
            fun emit(p: Vec3, normal: Vec3) {
                positions.add(p.x.toFloat()); positions.add(p.y.toFloat()); positions.add(p.z.toFloat())
                val q = TangentFrames.fromNormal(normal)
                tangents.add(q[0]); tangents.add(q[1]); tangents.add(q[2]); tangents.add(q[3])
            }
            fun barrelAt(s: Double): Pair<Double, Double> {
                val x = ((s - centre) * 2.0 / w).coerceIn(-1.0, 1.0)
                return spec.camber * (1.0 - x * x) to x
            }
            fun vertex(s: Double, t: Double) {
                val (barrel, x) = barrelAt(s)
                val offset = spec.lift + spec.step * (head - t) / spec.moduleLength + barrel
                // The surface's own normal, from its slope along and across the tile.
                val dBarrel = -4.0 * spec.camber * x / w
                emit(plane.at(s, t, offset), (plane.normal - plane.up * tilt - plane.across * dBarrel).normalized())
            }
            for (i in 0 until n) vertex(tailS[i], tailT[i])
            for (i in 0 until n) vertex(headS[i], head)
            // The skirt's foot: under the tail, down to the course below
            // (whose surface there stands higher than lift / 2 + barrel), facing
            // down the slope.
            val skirtNormal = (plane.up * -1.0 + plane.normal * 0.25).normalized()
            for (i in 0 until n) {
                val (barrel, _) = barrelAt(tailS[i])
                emit(plane.at(tailS[i], tailT[i], spec.lift * 0.5 + barrel), skirtNormal)
            }

            // Wound about the plane's normal: across × up = normal, so each
            // triangle faces up out of the roof and back-face culling keeps it.
            for (i in 0 until n - 1) {
                val tailA = first + i
                val tailB = first + i + 1
                val headA = first + n + i
                val headB = first + n + i + 1
                triangle(tailA, tailB, headB, plane.normal)
                triangle(tailA, headB, headA, plane.normal)
            }
            // The skirt faces down the slope: (top, foot, next foot) and
            // (top, next foot, next top) both turn about -up.
            for (i in 0 until n - 1) {
                val topA = first + i
                val topB = first + i + 1
                val footA = first + 2 * n + i
                val footB = first + 2 * n + i + 1
                triangle(topA, footA, footB, null)
                triangle(topA, footB, topB, null)
            }
            tiles++
        }

        /**
         * Emits a triangle unless it is degenerate. A tile-top triangle
         * ([facing] set) must also face out of the plane: where trimming
         * clamps neighbouring vertices to the same edge, what is left between
         * them is a sliver standing on its side, and it is skipped rather
         * than baked into a fin along the roof's edge.
         */
        private fun triangle(a: Int, b: Int, c: Int, facing: Vec3?) {
            val pa = Vec3(positions[a * 3].toDouble(), positions[a * 3 + 1].toDouble(), positions[a * 3 + 2].toDouble())
            val pb = Vec3(positions[b * 3].toDouble(), positions[b * 3 + 1].toDouble(), positions[b * 3 + 2].toDouble())
            val pc = Vec3(positions[c * 3].toDouble(), positions[c * 3 + 1].toDouble(), positions[c * 3 + 2].toDouble())
            val cross = (pb - pa) cross (pc - pa)
            val doubleArea = cross.length
            if (doubleArea <= DEGENERATE_DOUBLE_AREA) return
            if (facing != null && (cross dot facing) / doubleArea < MIN_TOP_FACING) return
            indices.add(a); indices.add(b); indices.add(c)
        }

        /**
         * Whether the plan footprint of a tile ([corners], convex) meets
         * [blocker] grown by the margin, and the two overlap in height.
         * Separating-axis test on the plan: the rectangle's two axes and the
         * quad's four edge normals.
         */
        private fun blocks(blocker: Bounds, corners: List<Vec3>): Boolean {
            val m = spec.blockerMargin
            val lowY = corners.minOf { it.y } - m
            val highY = corners.maxOf { it.y } + spec.maximumOffset + m
            if (blocker.max.y < lowY || blocker.min.y > highY) return false
            val rect = listOf(
                doubleArrayOf(blocker.min.x - m, blocker.min.z - m),
                doubleArrayOf(blocker.max.x + m, blocker.min.z - m),
                doubleArrayOf(blocker.max.x + m, blocker.max.z + m),
                doubleArrayOf(blocker.min.x - m, blocker.max.z + m),
            )
            val quad = corners.map { doubleArrayOf(it.x, it.z) }
            for (polygon in listOf(rect, quad)) {
                for (i in polygon.indices) {
                    val a = polygon[i]
                    val b = polygon[(i + 1) % polygon.size]
                    val ax = -(b[1] - a[1])
                    val az = b[0] - a[0]
                    if (abs(ax) <= 1e-9 && abs(az) <= 1e-9) continue
                    val (minA, maxA) = project(rect, ax, az)
                    val (minB, maxB) = project(quad, ax, az)
                    if (maxA < minB || maxB < minA) return false
                }
            }
            return true
        }

        private fun project(points: List<DoubleArray>, ax: Double, az: Double): Pair<Double, Double> {
            var low = Double.POSITIVE_INFINITY
            var high = Double.NEGATIVE_INFINITY
            for (p in points) {
                val d = p[0] * ax + p[1] * az
                low = min(low, d); high = max(high, d)
            }
            return low to high
        }

        fun build(objectId: String, planeCount: Int): RoofCoverBatch? {
            if (tiles == 0 || indices.isEmpty()) return null
            var bounds = Bounds.EMPTY
            for (v in 0 until positions.size / 3) {
                bounds = bounds.union(Bounds.around(Vec3(positions[v * 3].toDouble(), positions[v * 3 + 1].toDouble(), positions[v * 3 + 2].toDouble())))
            }
            return RoofCoverBatch(
                objectId = objectId,
                positions = positions.toFloatArray(),
                tangents = tangents.toFloatArray(),
                indices = indices.toIntArray(),
                tileCount = tiles,
                planeCount = planeCount,
                bounds = bounds,
                dropped = dropped.toMap(),
            )
        }
    }

    /** The span among [spans] that overlaps `[start, end]` most, or null when none does. */
    private fun bestSpan(spans: List<DoubleArray>, start: Double, end: Double): DoubleArray? {
        var best: DoubleArray? = null
        var bestOverlap = 0.0
        for (span in spans) {
            val overlap = min(span[1], end) - max(span[0], start)
            if (overlap > bestOverlap) {
                best = span
                bestOverlap = overlap
            }
        }
        return best
    }

    /** The common part of two span lists. */
    private fun intersect(a: List<DoubleArray>, b: List<DoubleArray>): List<DoubleArray> {
        val out = ArrayList<DoubleArray>()
        for (x in a) for (y in b) {
            val low = max(x[0], y[0])
            val high = min(x[1], y[1])
            if (low <= high) out.add(doubleArrayOf(low, high))
        }
        return out.sortedBy { it[0] }
    }
}
