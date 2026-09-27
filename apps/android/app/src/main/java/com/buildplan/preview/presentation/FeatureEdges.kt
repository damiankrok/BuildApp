package com.buildplan.preview.presentation

import com.buildplan.preview.render.ArchitecturalPalette
import com.buildplan.preview.scene.BundleStyling
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.ScenePart
import com.buildplan.preview.scene.SceneObject
import com.buildplan.preview.scene.Visibility
import kotlin.math.floor
import kotlin.math.sqrt

/**
 * Feature edges: the lines an architectural drawing puts on a building, found
 * in the triangles the compiler already produced.
 *
 * ## Presentation, not geometry
 *
 * Nothing here is a fact about the building. The phone receives compiled
 * triangles tagged with their semantic object; this reads those triangles and
 * says which of their sides are worth inking. It adds no vertex, moves none,
 * and is thrown away with the model. Every line it returns carries the id of
 * the object whose face it bounds, so a line hides, shows and highlights with
 * that object and never becomes a thing of its own.
 *
 * ## What is a feature edge
 *
 * A lit surface says where a face is, not where it ends: two walls meeting at
 * a shallow angle, or a window head against the wall above it, differ by a few
 * percent of grey. Inking the boundaries restores the line every drawing has.
 * But a triangle mesh has far more sides than a building has edges, so each
 * side is classified first:
 *
 * - a **triangulation diagonal** or the **seam of one surface** — two faces of
 *   the same object in one plane, one either side of the side — is not drawn
 *   ([EdgeClass.INTERNAL_SEAM]);
 * - a **crease** — faces of the object at an angle — is drawn
 *   ([EdgeClass.CREASE]);
 * - a **boundary** — one face only, the free edge of a panel — is drawn
 *   ([EdgeClass.BOUNDARY]);
 * - a **shared seam** — the object's face continued in the same plane by a
 *   NEIGHBOUR's face, as where a butting wall meets the corner that owns the
 *   junction, or a ground-storey wall meets the storey above it — is drawn
 *   only while no such neighbour is on screen ([EdgeClass.SHARED_SEAM]). The
 *   facade reads as one surface while both walls stand, and the first wall
 *   keeps its own outline when the second is hidden by a layer mode. The
 *   neighbours are recorded per line group ([EdgeGroup.partners]) so that
 *   deciding this is a set test in the renderer, not a recomputation.
 *
 * Before any of that, every side is split wherever another vertex of the
 * scene lies on it: a pier's full-height corner and the head block's short
 * corner above an opening are the same line with different endpoints, and
 * only their common piece is a seam. This port of the donor viewer's rule
 * works on the whole scene's triangle soup rather than on per-element
 * polygons, because the bundle carries triangles, not polygons.
 *
 * ## Tiers
 *
 * [EdgeTier.STRUCTURAL] lines bound the groups the bundle's own palette marks
 * with a `SOFT` edge (walls, roofs, slabs, trims, terraces, chimneys, ...);
 * [EdgeTier.DETAIL] lines bound everything else that is opaque (frames,
 * doors, railings, stairs). A presentation mode chooses the tiers it inks.
 * Translucent parts — glazing and diagnostic markers — are never inked.
 *
 * Deterministic: the same scene gives the same groups in the same order with
 * the same floats, on every JVM and every phone.
 */
object FeatureEdges {

    /** Tenths of a millimetre per metre: corners closer than that are one corner. */
    const val POSITION_QUANTUM: Double = 10_000.0

    /** Cosine above which two face normals are one plane: about a quarter of a degree. */
    const val COPLANAR_DOT: Double = 0.99999

    /** How far off a side a vertex may sit and still split it, in metres. */
    const val COLLINEAR_TOLERANCE: Double = 1e-4

    /** Twice the area, in square metres, below which a triangle has no usable normal. */
    const val MIN_DOUBLE_AREA: Double = 1e-8

    /** Spatial hash cell for the splitting pass, in metres. */
    private const val CELL: Double = 1.0

    /** Every object's feature edges, from the scene's opaque parts. */
    fun of(scene: ModelScene): FeatureEdgeSet =
        compute(scene.objects.mapNotNull { sourceOf(it, scene.styling) })

    /** Which tier a part's edges belong to, or null for a part that is never inked. */
    fun tierOf(part: ScenePart, styling: BundleStyling?): EdgeTier? {
        if (part.part.isTranslucent) return null
        val edge = ArchitecturalPalette.appearanceOf(part.semanticGroup, part.rawSemanticGroup, styling).edge
        return if (edge == "SOFT") EdgeTier.STRUCTURAL else EdgeTier.DETAIL
    }

    /** The inkable triangles of one object, or null when it has none. */
    fun sourceOf(obj: SceneObject, styling: BundleStyling?): EdgeSource? {
        val parts = obj.parts.mapNotNull { part -> tierOf(part, styling)?.let { part to it } }
        if (parts.isEmpty()) return null
        val triangleCount = parts.sumOf { it.first.count / 3 }
        if (triangleCount == 0) return null
        val triangles = FloatArray(triangleCount * 9)
        val tiers = ArrayList<EdgeTier>(triangleCount)
        var cursor = 0
        for ((part, tier) in parts) {
            System.arraycopy(obj.positions, part.first * 3, triangles, cursor, part.count * 3)
            cursor += part.count * 3
            repeat(part.count / 3) { tiers.add(tier) }
        }
        return EdgeSource(obj.id, Visibility.classOf(obj), triangles, tiers)
    }

    /**
     * Classify every side of every triangle of [sources] and group what is
     * drawn by object, tier and partner set.
     */
    fun compute(sources: List<EdgeSource>): FeatureEdgeSet {
        val vertices = VertexTable()
        val faces = ArrayList<Face>()
        val sides = LinkedHashMap<Long, MutableList<SideFace>>()

        for ((objectIndex, source) in sources.withIndex()) {
            val tris = source.triangles
            for (t in 0 until tris.size / 9) {
                val a = vertices.idOf(tris[t * 9], tris[t * 9 + 1], tris[t * 9 + 2])
                val b = vertices.idOf(tris[t * 9 + 3], tris[t * 9 + 4], tris[t * 9 + 5])
                val c = vertices.idOf(tris[t * 9 + 6], tris[t * 9 + 7], tris[t * 9 + 8])
                if (a == b || b == c || a == c) continue
                val normal = vertices.normalOf(a, b, c) ?: continue
                val face = Face(objectIndex, source.tiers[t], normal)
                faces.add(face)
                addSide(sides, vertices, face, a, b, c)
                addSide(sides, vertices, face, b, c, a)
                addSide(sides, vertices, face, c, a, b)
            }
        }

        val pieces = split(sides, vertices)
        val classById = sources.associate { it.objectId to it.visibilityClass }
        val counts = LinkedHashMap<EdgeClass, Int>()
        EdgeClass.entries.forEach { counts[it] = 0 }
        val groups = LinkedHashMap<String, GroupBuilder>()

        for ((key, pieceFaces) in pieces) {
            val from = (key ushr 32).toInt()
            val to = key.toInt()
            val byObject = LinkedHashMap<Int, MutableList<SideFace>>()
            for (f in pieceFaces) byObject.getOrPut(f.face.objectIndex) { ArrayList(2) }.add(f)

            for ((objectIndex, own) in byObject) {
                val cls: EdgeClass
                var partners: List<String> = emptyList()
                if (hasContinuingPair(own, own)) {
                    cls = EdgeClass.INTERNAL_SEAM
                } else {
                    val continuing = byObject.keys
                        .filter { other -> other != objectIndex && hasContinuingPair(own, byObject.getValue(other)) }
                    if (continuing.isNotEmpty()) {
                        cls = EdgeClass.SHARED_SEAM
                        partners = continuing.map { sources[it].objectId }
                    } else {
                        cls = if (own.size == 1) EdgeClass.BOUNDARY else EdgeClass.CREASE
                    }
                }
                counts[cls] = counts.getValue(cls) + 1
                if (cls == EdgeClass.INTERNAL_SEAM) continue

                val tier = if (own.any { it.face.tier == EdgeTier.STRUCTURAL }) EdgeTier.STRUCTURAL else EdgeTier.DETAIL
                val source = sources[objectIndex]
                // Grouped by the CLASSES of the neighbours, not by the
                // neighbours themselves: every mode shows or hides a class as
                // one, so one group per class set is exact and keeps the
                // number of renderables small.
                val partnerClasses = partners.map { id -> classById.getValue(id) }.distinct().sorted()
                val groupKey = "$objectIndex|$tier|${partnerClasses.joinToString(",")}"
                groups.getOrPut(groupKey) { GroupBuilder(source.objectId, source.visibilityClass, tier, partnerClasses) }
                    .add(vertices, from, to, partners)
            }
        }

        return FeatureEdgeSet(groups.values.map { it.build() }, counts)
    }

    // -----------------------------------------------------------------------
    // Sides
    // -----------------------------------------------------------------------

    /**
     * Records the side [from]–[to] of [face], with the in-plane direction
     * from the side towards the face's third corner [opposite]: two coplanar
     * faces continue each other across a side only when those directions
     * point away from each other.
     */
    private fun addSide(sides: MutableMap<Long, MutableList<SideFace>>, v: VertexTable, face: Face, from: Int, to: Int, opposite: Int) {
        val dx = v.x(to) - v.x(from)
        val dy = v.y(to) - v.y(from)
        val dz = v.z(to) - v.z(from)
        val rx = v.x(opposite) - v.x(from)
        val ry = v.y(opposite) - v.y(from)
        val rz = v.z(opposite) - v.z(from)
        val dd = dx * dx + dy * dy + dz * dz
        val k = if (dd > 0.0) (rx * dx + ry * dy + rz * dz) / dd else 0.0
        var sx = rx - dx * k
        var sy = ry - dy * k
        var sz = rz - dz * k
        val len = sqrt(sx * sx + sy * sy + sz * sz)
        if (len > 0.0) {
            sx /= len; sy /= len; sz /= len
        }
        sides.getOrPut(sideKey(from, to)) { ArrayList(2) }.add(SideFace(face, doubleArrayOf(sx, sy, sz)))
    }

    /**
     * Splits every side at each vertex of the scene lying strictly inside it,
     * and hands each piece the faces of every side it came from.
     */
    private fun split(sides: Map<Long, List<SideFace>>, v: VertexTable): LinkedHashMap<Long, MutableList<SideFace>> {
        val grid = HashMap<Long, MutableList<Int>>()
        for (id in 0 until v.size) grid.getOrPut(cellKey(cell(v.x(id)), cell(v.y(id)), cell(v.z(id)))) { ArrayList() }.add(id)

        val pieces = LinkedHashMap<Long, MutableList<SideFace>>()
        for ((key, sideFaces) in sides) {
            val from = (key ushr 32).toInt()
            val to = key.toInt()
            val inside = ArrayList<Pair<Double, Int>>()
            val x0 = cell(minOf(v.x(from), v.x(to)) - COLLINEAR_TOLERANCE)
            val x1 = cell(maxOf(v.x(from), v.x(to)) + COLLINEAR_TOLERANCE)
            val y0 = cell(minOf(v.y(from), v.y(to)) - COLLINEAR_TOLERANCE)
            val y1 = cell(maxOf(v.y(from), v.y(to)) + COLLINEAR_TOLERANCE)
            val z0 = cell(minOf(v.z(from), v.z(to)) - COLLINEAR_TOLERANCE)
            val z1 = cell(maxOf(v.z(from), v.z(to)) + COLLINEAR_TOLERANCE)
            for (cx in x0..x1) for (cy in y0..y1) for (cz in z0..z1) {
                val bucket = grid[cellKey(cx, cy, cz)] ?: continue
                for (id in bucket) {
                    if (id == from || id == to) continue
                    val t = v.strictlyBetween(id, from, to) ?: continue
                    inside.add(t to id)
                }
            }
            val chain = ArrayList<Int>(inside.size + 2)
            chain.add(from)
            inside.sortWith(compareBy<Pair<Double, Int>> { it.first }.thenBy { it.second })
            for ((_, id) in inside) chain.add(id)
            chain.add(to)
            for (i in 0 until chain.size - 1) {
                if (chain[i] == chain[i + 1]) continue
                pieces.getOrPut(sideKey(chain[i], chain[i + 1])) { ArrayList(2) }.addAll(sideFaces)
            }
        }
        return pieces
    }

    /**
     * Whether some face in [a] and some face in [b] are one surface across
     * the side: the same plane, the same facing, on opposite sides of it.
     * Two faces on the SAME side overlap rather than continue — a finish band
     * lying on its wall — and do not make a seam.
     */
    private fun hasContinuingPair(a: List<SideFace>, b: List<SideFace>): Boolean {
        for (f in a) for (g in b) {
            if (f === g) continue
            val n = f.face.normal
            val m = g.face.normal
            if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] <= COPLANAR_DOT) continue
            val s = f.side
            val r = g.side
            if (s[0] * r[0] + s[1] * r[1] + s[2] * r[2] < 0.0) return true
        }
        return false
    }

    private fun sideKey(a: Int, b: Int): Long = (minOf(a, b).toLong() shl 32) or maxOf(a, b).toLong()

    private fun cell(value: Double): Int = floor(value / CELL).toInt()

    private fun cellKey(x: Int, y: Int, z: Int): Long =
        ((x.toLong() and 0x1FFFFF) shl 42) or ((y.toLong() and 0x1FFFFF) shl 21) or (z.toLong() and 0x1FFFFF)

    private class Face(val objectIndex: Int, val tier: EdgeTier, val normal: DoubleArray)

    private class SideFace(val face: Face, val side: DoubleArray)

    private class GroupBuilder(val objectId: String, val visibilityClass: String, val tier: EdgeTier, val partnerClasses: List<String>) {
        private val floats = ArrayList<Float>()
        private val partners = sortedSetOf<String>()
        fun add(v: VertexTable, from: Int, to: Int, piecePartners: List<String>) {
            floats.add(v.x(from).toFloat()); floats.add(v.y(from).toFloat()); floats.add(v.z(from).toFloat())
            floats.add(v.x(to).toFloat()); floats.add(v.y(to).toFloat()); floats.add(v.z(to).toFloat())
            partners.addAll(piecePartners)
        }
        fun build(): EdgeGroup = EdgeGroup(objectId, visibilityClass, tier, partnerClasses, partners.toList(), floats.toFloatArray())
    }

    /**
     * Distinct corners of the scene, quantised to [POSITION_QUANTUM]: corners
     * a nanometre of arithmetic apart are the same corner, and must be for a
     * shared side to be recognised as one.
     */
    private class VertexTable {
        private val ids = HashMap<Triple<Long, Long, Long>, Int>()
        private val coords = ArrayList<Double>()
        val size: Int get() = coords.size / 3

        fun idOf(x: Float, y: Float, z: Float): Int {
            val key = Triple(Math.round(x * POSITION_QUANTUM), Math.round(y * POSITION_QUANTUM), Math.round(z * POSITION_QUANTUM))
            return ids.getOrPut(key) {
                coords.add(x.toDouble()); coords.add(y.toDouble()); coords.add(z.toDouble())
                size - 1
            }
        }

        fun x(id: Int): Double = coords[id * 3]
        fun y(id: Int): Double = coords[id * 3 + 1]
        fun z(id: Int): Double = coords[id * 3 + 2]

        fun normalOf(a: Int, b: Int, c: Int): DoubleArray? {
            val ux = x(b) - x(a); val uy = y(b) - y(a); val uz = z(b) - z(a)
            val vx = x(c) - x(a); val vy = y(c) - y(a); val vz = z(c) - z(a)
            val nx = uy * vz - uz * vy
            val ny = uz * vx - ux * vz
            val nz = ux * vy - uy * vx
            val len = sqrt(nx * nx + ny * ny + nz * nz)
            if (len <= MIN_DOUBLE_AREA) return null
            return doubleArrayOf(nx / len, ny / len, nz / len)
        }

        /** Where [id] falls along [from]–[to], when it lies strictly inside that side; else null. */
        fun strictlyBetween(id: Int, from: Int, to: Int): Double? {
            val dx = x(to) - x(from); val dy = y(to) - y(from); val dz = z(to) - z(from)
            val dd = dx * dx + dy * dy + dz * dz
            if (dd <= 0.0) return null
            val t = ((x(id) - x(from)) * dx + (y(id) - y(from)) * dy + (z(id) - z(from)) * dz) / dd
            if (t <= 0.0 || t >= 1.0) return null
            val ox = x(id) - (x(from) + dx * t)
            val oy = y(id) - (y(from) + dy * t)
            val oz = z(id) - (z(from) + dz * t)
            return if (ox * ox + oy * oy + oz * oz <= COLLINEAR_TOLERANCE * COLLINEAR_TOLERANCE) t else null
        }
    }
}

/** Which presentation modes may ink an edge. */
enum class EdgeTier {
    /** The outline of a group the bundle's palette marks with a SOFT edge: walls, roofs, slabs, trims. */
    STRUCTURAL,

    /** The outline of any other opaque part: frames, doors, railings, stairs. */
    DETAIL,
}

/** How one piece of a triangle side reads, for one object with a face on it. */
enum class EdgeClass {
    /** One face only: a free edge. Drawn. */
    BOUNDARY,

    /** Faces of the object at an angle. Drawn. */
    CREASE,

    /** Two faces of the object in one plane: a diagonal or a seam. Never drawn. */
    INTERNAL_SEAM,

    /** The object's face continued in its plane by a neighbour's. Drawn only while no such neighbour is shown. */
    SHARED_SEAM,
}

/** The triangles of one object that may be inked, in the render frame. */
class EdgeSource(
    val objectId: String,
    /** The object's visibility class ([Visibility.classOf]): objects of one class are shown and hidden together. */
    val visibilityClass: String,
    /** 9 floats per triangle. */
    val triangles: FloatArray,
    /** One tier per triangle. */
    val tiers: List<EdgeTier>,
)

/**
 * One object's lines of one tier whose neighbours fall in the same classes.
 *
 * [partnerClasses] empty: the lines are the object's own outline and are
 * drawn whenever the object is. Otherwise they are shared seams, drawn only
 * while none of [partners] — the neighbours whose surface continues the
 * object's across them — is on screen.
 */
class EdgeGroup(
    val objectId: String,
    val visibilityClass: String,
    val tier: EdgeTier,
    val partnerClasses: List<String>,
    val partners: List<String>,
    /** A line list in the render frame: 6 floats per segment. */
    val positions: FloatArray,
) {
    val segmentCount: Int get() = positions.size / 6
    val isShared: Boolean get() = partners.isNotEmpty()

    /** Whether this group is drawn when [visible] objects are on screen and [tiers] are inked. */
    fun isDrawn(visible: Set<String>, tiers: Set<EdgeTier>): Boolean =
        objectId in visible && tier in tiers && partners.none { it in visible }
}

/**
 * The lines of every object of one visibility class, one tier and one
 * partner-class set, concatenated: what is drawn while the class is shown
 * whole, so a storey's outline costs one renderable instead of one per wall.
 */
class MergedEdgeGroup(
    val visibilityClass: String,
    val tier: EdgeTier,
    val partnerClasses: List<String>,
    /** The per-object groups this concatenates, in scene order. */
    val parts: List<EdgeGroup>,
) {
    val members: List<String> = parts.map { it.objectId }.distinct()
    val partners: Set<String> = parts.flatMapTo(LinkedHashSet()) { it.partners }
    val positions: FloatArray = FloatArray(parts.sumOf { it.positions.size }).also { out ->
        var cursor = 0
        for (p in parts) {
            System.arraycopy(p.positions, 0, out, cursor, p.positions.size)
            cursor += p.positions.size
        }
    }
    val segmentCount: Int get() = positions.size / 6
}

/** Which uploaded line groups are on screen for one viewer state. */
data class DrawnEdges(val merged: Set<Int>, val perObject: Set<Int>)

/** Every line group of a scene, with the classification counts that produced them. */
class FeatureEdgeSet(
    /** Per object, per tier, per partner-class set, in scene order. */
    val groups: List<EdgeGroup>,
    /** How many (piece, object) pairs fell into each class. */
    val counts: Map<EdgeClass, Int>,
) {
    val byObject: Map<String, List<EdgeGroup>> = groups.groupBy { it.objectId }
    val segmentCount: Int get() = groups.sumOf { it.segmentCount }

    /** The per-object groups batched by class, tier and partner classes. */
    val merged: List<MergedEdgeGroup> = groups
        .groupBy { Triple(it.visibilityClass, it.tier, it.partnerClasses) }
        .map { (key, parts) -> MergedEdgeGroup(key.first, key.second, key.third, parts) }

    private val groupIndex: Map<EdgeGroup, Int> = groups.withIndex().associate { it.value to it.index }

    /**
     * The groups to draw when [visible] objects are shown, [tiers] are inked
     * and [selected] is highlighted.
     *
     * A batch is drawn whole when every member is shown, no partner is, and
     * the selection is not among its members — true of every class-based
     * layer mode. Otherwise (an isolated object, a selected one whose lines
     * take the highlight) its members' own groups stand in, each drawn by the
     * per-object rule. Either way exactly the same lines are on screen.
     */
    fun drawn(visible: Set<String>, tiers: Set<EdgeTier>, selected: String?): DrawnEdges {
        val merged = LinkedHashSet<Int>()
        val single = LinkedHashSet<Int>()
        for ((i, m) in this.merged.withIndex()) {
            if (m.tier !in tiers) continue
            val whole = m.members.all { it in visible } && m.partners.none { it in visible } && (selected == null || selected !in m.members)
            if (whole) {
                merged.add(i)
            } else {
                for (g in m.parts) if (g.isDrawn(visible, tiers)) single.add(groupIndex.getValue(g))
            }
        }
        return DrawnEdges(merged, single)
    }

    /** The line segments a state shows, as an order-free set of rounded endpoints: for tests. */
    fun segmentsDrawn(visible: Set<String>, tiers: Set<EdgeTier>, selected: String?): Set<List<Long>> {
        val d = drawn(visible, tiers, selected)
        val arrays = d.merged.map { merged[it].positions } + d.perObject.map { groups[it].positions }
        val out = HashSet<List<Long>>()
        for (p in arrays) for (s in 0 until p.size / 6) {
            val a = (0 until 3).map { Math.round(p[s * 6 + it] * 1e4) }
            val b = (0 until 3).map { Math.round(p[s * 6 + 3 + it] * 1e4) }
            out.add(if (a.toString() < b.toString()) a + b else b + a)
        }
        return out
    }
}
