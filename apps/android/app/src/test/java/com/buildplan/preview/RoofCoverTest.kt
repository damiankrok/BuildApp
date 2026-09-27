package com.buildplan.preview

import com.buildplan.preview.PresentationFixtures.Mesh
import com.buildplan.preview.PresentationFixtures.Tris
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.presentation.CoverPlane
import com.buildplan.preview.presentation.RoofCover
import com.buildplan.preview.presentation.RoofCoverBatch
import com.buildplan.preview.presentation.RoofCoverSpec
import com.buildplan.preview.presentation.TileDrop
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.TangentFrames
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

/**
 * The roof covering on generic fixtures: roofs that belong to no building,
 * built to exercise one rule each, then the shipped scenes held to budgets.
 */
class RoofCoverTest {

    private val spec = RoofCoverSpec.DEFAULT

    private fun gableScene(yawDeg: Double = 0.0, pitchDeg: Double = 35.0, extra: List<Mesh> = emptyList()): ModelScene =
        PresentationFixtures.scene(
            "fixture-gable",
            listOf(Mesh("roof-a", "roof", "ROOF", PresentationFixtures.gableRoof(span = 8.0, length = 11.0, pitchDeg = pitchDeg, eaveY = 3.0, yawDeg = yawDeg), levelId = null, semanticGroup = "ROOF_MAIN")) + extra,
        )

    private fun stOf(plane: CoverPlane, p: Vec3): Pair<Double, Double> = ((p - plane.origin) dot plane.across) to ((p - plane.origin) dot plane.up)

    /** The plane a covering point lies over: on its surface once projected, and within the relief above it. */
    private fun ownPlane(planes: List<CoverPlane>, p: Vec3): CoverPlane? = planes.filter { pl ->
        val off = (p - pl.origin) dot pl.normal
        val (s, t) = stOf(pl, p)
        off > -0.01 && off < spec.maximumOffset + 0.01 && t >= pl.tMin - 1e-3 && t <= pl.tMax + 1e-3 &&
            pl.coverage(t.coerceIn(pl.tMin + 1e-5, pl.tMax - 1e-5)).any { s >= it[0] - 1e-3 && s <= it[1] + 1e-3 }
    }.minByOrNull { (p - it.origin) dot it.normal }

    private fun corners(batch: RoofCoverBatch): List<Vec3> =
        (0 until batch.vertexCount).map { Vec3(batch.positions[it * 3].toDouble(), batch.positions[it * 3 + 1].toDouble(), batch.positions[it * 3 + 2].toDouble()) }

    @Test
    fun `a pitched roof is covered, a flat one and the walls are not`() {
        val flat = Tris().box(Vec3(12.0, 2.6, 0.0), Vec3(18.0, 2.9, 6.0))
        val wall = Tris().box(Vec3(0.0, 0.0, 0.0), Vec3(11.0, 3.0, 0.3))
        val scene = gableScene(extra = listOf(
            Mesh("roof-flat", "roof", "ROOF", flat, levelId = null, semanticGroup = "FLAT_ROOF"),
            Mesh("wall-a", "wall", "WALL", wall, semanticGroup = "WALL_MAIN"),
        ))
        val batches = RoofCover.of(scene)
        assertEquals(listOf("roof-a"), batches.map { it.objectId })
        val batch = batches.single()
        assertEquals(2, batch.planeCount)
        // 8 m span at 35°: each slope ≈ 4.88 m, so 15 courses of 0.325 m on it; 11 m / 0.30 m = 37 columns.
        assertTrue("tiles: ${batch.tileCount}", batch.tileCount in 900..1200)
        assertEquals(batch.tileCount * RoofCover.VERTICES_PER_TILE, batch.vertexCount)
        // Untrimmed tiles carry all their triangles; trimmed ones may lose slivers, never gain any.
        assertTrue(batch.triangleCount <= batch.tileCount * RoofCover.TRIANGLES_PER_TILE)
        assertTrue(batch.triangleCount >= batch.tileCount * RoofCover.TRIANGLES_PER_TILE * 9 / 10)
    }

    @Test
    fun `a plane flatter than the minimum pitch is left plain`() {
        assertTrue(RoofCover.of(gableScene(pitchDeg = 8.0)).isEmpty())
        assertTrue(RoofCover.of(gableScene(pitchDeg = 20.0)).isNotEmpty())
    }

    @Test
    fun `tiles stand just above the plane, within the module's relief`() {
        val scene = gableScene()
        val planes = RoofCover.planesOf(scene.objectById("roof-a")!!)
        val batch = RoofCover.of(scene).single()
        for (p in corners(batch)) {
            val plane = ownPlane(planes, p)
            assertNotNull("tile vertex $p lies over no roof plane", plane)
            val offset = (p - plane!!.origin) dot plane.normal
            assertTrue("a tile vertex $offset m off the roof", offset >= spec.lift * 0.5 - 1e-4 && offset <= spec.maximumOffset + 1e-4)
        }
    }

    @Test
    fun `every tile triangle faces out of the roof, the skirts down its slope`() {
        val scene = gableScene()
        val planes = RoofCover.planesOf(scene.objectById("roof-a")!!)
        val batch = RoofCover.of(scene).single()
        val points = corners(batch)
        for (t in 0 until batch.triangleCount) {
            val v = (0 until 3).map { i -> points[batch.indices[t * 3 + i]] }
            val n = ((v[1] - v[0]) cross (v[2] - v[0])).normalized()
            val plane = ownPlane(planes, (v[0] + v[1] + v[2]) * (1.0 / 3.0)) ?: error("triangle $t over no plane")
            assertTrue("triangle $t faces into the roof", (n dot plane.normal) > -0.05)
            // Each tile's vertices are its tail row, its head row, then the skirt's foot.
            val skirt = (0 until 3).any { i -> batch.indices[t * 3 + i] % RoofCover.VERTICES_PER_TILE >= 2 * RoofCover.VERTICES_ACROSS }
            if (skirt) {
                assertTrue("a skirt faces down the slope", (n dot plane.up) < 0.05)
            } else {
                assertTrue("a tile top faces up out of the plane", (n dot plane.normal) >= 0.8 - 1e-9)
            }
        }
        // And the shading normals agree with the winding.
        for (v in 0 until batch.vertexCount) {
            val q = floatArrayOf(batch.tangents[v * 4], batch.tangents[v * 4 + 1], batch.tangents[v * 4 + 2], batch.tangents[v * 4 + 3])
            val n = TangentFrames.rotate(q, Vec3(0.0, 0.0, 1.0))
            assertTrue(abs(n.length - 1.0) < 1e-3)
            assertTrue("a shading normal points into the roof", planes.any { (n dot it.normal) > 0.1 })
        }
    }

    @Test
    fun `the covering stays on the roof surface`() {
        val scene = gableScene()
        val planes = RoofCover.planesOf(scene.objectById("roof-a")!!)
        val batch = RoofCover.of(scene).single()
        for (p in corners(batch)) assertNotNull("tile vertex $p is off the roof", ownPlane(planes, p))
    }

    @Test
    fun `a hole the model cut is respected, not tiled over`() {
        // One pitched plane with a rectangular opening, triangulated around it.
        val pitch = Math.toRadians(35.0)
        fun onPlane(x: Double, t: Double): Vec3 = Vec3(x, 3.0 + t * kotlin.math.sin(pitch), 6.0 - t * kotlin.math.cos(pitch))
        val xs = doubleArrayOf(0.0, 4.0, 5.2, 10.0)
        val ts = doubleArrayOf(0.0, 1.5, 2.7, 5.0)
        val tris = Tris()
        for (i in 0 until 3) for (j in 0 until 3) {
            if (i == 1 && j == 1) continue // the opening
            tris.quad(onPlane(xs[i], ts[j]), onPlane(xs[i + 1], ts[j]), onPlane(xs[i + 1], ts[j + 1]), onPlane(xs[i], ts[j + 1]))
        }
        val scene = PresentationFixtures.scene("fixture-hole", listOf(Mesh("roof-h", "roof", "ROOF", tris, levelId = null, semanticGroup = "ROOF_MAIN")))
        val plane = RoofCover.planesOf(scene.objectById("roof-h")!!).single()
        val batch = RoofCover.of(scene).single()
        assertTrue(batch.tileCount > 100)
        assertTrue("tiles next to the opening were trimmed or left out", batch.dropped.getValue(TileDrop.OFF_SURFACE) > 0)
        // No tile vertex over the opening (with its own relief the tile sits
        // above the plane, so project back onto it).
        val hole = listOf(onPlane(4.0, 1.5), onPlane(5.2, 2.7)).map { it - plane.origin }
        val sLo = minOf(hole[0] dot plane.across, hole[1] dot plane.across)
        val sHi = maxOf(hole[0] dot plane.across, hole[1] dot plane.across)
        val tLo = minOf(hole[0] dot plane.up, hole[1] dot plane.up)
        val tHi = maxOf(hole[0] dot plane.up, hole[1] dot plane.up)
        for (p in corners(batch)) {
            val d = p - plane.origin
            val s = d dot plane.across
            val t = d dot plane.up
            assertTrue("tile vertex s=$s t=$t over the opening", !(s > sLo + 1e-3 && s < sHi - 1e-3 && t > tLo + 1e-3 && t < tHi - 1e-3))
        }
    }

    @Test
    fun `a chimney through an uncut roof keeps the tiles off its footprint`() {
        val chimney = Tris().box(Vec3(4.0, 2.5, 3.0), Vec3(4.6, 8.5, 3.6))
        val scene = gableScene(extra = listOf(Mesh("stack-a", "chimney", "CHIMNEY", chimney, levelId = null, semanticGroup = "CHIMNEY")))
        val batch = RoofCover.of(scene).single()
        assertTrue(batch.dropped.getValue(TileDrop.BLOCKED) > 0)
        val m = spec.blockerMargin
        // The render frame of the fixture puts the plan centre at the origin; the chimney box is where it was written.
        val blocker = RoofCover.blockersOf(scene).single()
        for (p in corners(batch)) {
            val inside = p.x > blocker.min.x - m + 1e-3 && p.x < blocker.max.x + m - 1e-3 && p.z > blocker.min.z - m + 1e-3 && p.z < blocker.max.z + m - 1e-3
            assertTrue("tile vertex $p inside the chimney's footprint", !inside)
        }
        // A chimney standing well clear of the roof blocks nothing.
        val far = Tris().box(Vec3(40.0, 0.0, 40.0), Vec3(40.6, 9.0, 40.6))
        val clear = RoofCover.of(gableScene(extra = listOf(Mesh("stack-far", "chimney", "CHIMNEY", far, levelId = null, semanticGroup = "CHIMNEY")))).single()
        assertEquals(0, clear.dropped.getValue(TileDrop.BLOCKED))
    }

    @Test
    fun `a triangular hip facet is trimmed to its sloping edges`() {
        val apex = Vec3(5.0, 6.0, 3.0)
        val tris = Tris().tri(Vec3(0.0, 3.0, 6.0), Vec3(10.0, 3.0, 6.0), apex)
        val scene = PresentationFixtures.scene("fixture-hip", listOf(Mesh("roof-hip", "roof", "ROOF", tris, levelId = null, semanticGroup = "ROOF_MAIN")))
        val plane = RoofCover.planesOf(scene.objectById("roof-hip")!!).single()
        val batch = RoofCover.of(scene).single()
        assertTrue(batch.tileCount > 50)
        assertTrue(batch.dropped.getValue(TileDrop.TOO_NARROW) + batch.dropped.getValue(TileDrop.OFF_SURFACE) > 0)
        for (p in corners(batch)) {
            val d = p - plane.origin
            val s = d dot plane.across
            val t = d dot plane.up
            val span = plane.coverage(t.coerceIn(plane.tMin + 1e-5, plane.tMax - 1e-5))
            assertTrue("vertex s=$s t=$t outside the triangle", span.any { s >= it[0] - 1e-3 && s <= it[1] + 1e-3 })
        }
    }

    @Test
    fun `the covering does not depend on how the roof is turned`() {
        val counts = listOf(0.0, 30.0, 90.0, 217.0).map { yaw -> RoofCover.of(gableScene(yawDeg = yaw)).single().tileCount }
        assertTrue("tile counts $counts", counts.all { it == counts.first() })
    }

    @Test
    fun `the covering is deterministic`() {
        for (scene in listOf(TestScenes.autoCandidateV3, gableScene(yawDeg = 30.0))) {
            val a = RoofCover.of(scene)
            val b = RoofCover.of(scene)
            assertEquals(a.size, b.size)
            for (i in a.indices) {
                assertTrue(a[i].positions.contentEquals(b[i].positions))
                assertTrue(a[i].tangents.contentEquals(b[i].tangents))
                assertTrue(a[i].indices.contentEquals(b[i].indices))
            }
        }
    }

    @Test
    fun `a batch answers with the roof it covers, one per roof object`() {
        for (scene in TestScenes.all) {
            val batches = RoofCover.of(scene)
            assertEquals(batches.map { it.objectId }.distinct(), batches.map { it.objectId })
            for (b in batches) {
                val obj = scene.objectById(b.objectId)
                assertNotNull(obj)
                assertTrue("${scene.key}: ${b.objectId} has no roof surface", obj!!.parts.any { it.part in RoofCover.COVERED_PARTS })
            }
        }
    }

    @Test
    fun `the covering of the shipped scenes stays within a phone's budget`() {
        for (scene in TestScenes.all) {
            val batches = RoofCover.of(scene)
            val area = scene.objects.flatMap { RoofCover.planesOf(it) }.sumOf { it.area }
            val tiles = batches.sumOf { it.tileCount }
            val triangles = batches.sumOf { it.triangleCount }
            assertTrue("${scene.key}: $tiles tiles on $area m²", tiles <= area / (spec.moduleWidth * spec.exposure) * 1.05 + 10)
            assertTrue("${scene.key}: $triangles covering triangles", triangles <= 40_000)
            assertTrue("${scene.key}: ${batches.size} batches", batches.size <= 8)
        }
    }

    @Test
    fun `the dormer fixture tiles its dormer roofs and leaves the cut under them bare`() {
        val scene = TestScenes.fixture("roof-dormer-gable")
        val batches = RoofCover.of(scene).associateBy { it.objectId }
        assertNotNull("the dormer's own roof is covered", batches["dormer-front-roof-l"])
        assertNotNull(batches["dormer-front-roof-r"])
        val main = batches.getValue("roof-main-plane-front")
        assertTrue(main.dropped.getValue(TileDrop.OFF_SURFACE) > 0)
        // The cut's reveal is not a blocker: nothing on this fixture is blocked.
        assertEquals(0, batches.values.sumOf { it.dropped.getValue(TileDrop.BLOCKED) })
        val cut = scene.objectById("dormer-front-cut")!!
        assertTrue(cut.parts.all { it.part == GeometryPart.ROOF_REVEAL })
        val plane: CoverPlane = RoofCover.planesOf(scene.objectById("roof-main-plane-front")!!).single()
        // The hole the cut left in the main plane follows the dormer's valleys
        // (it narrows towards the ridge), so it is read from the plane itself:
        // every main-roof tile vertex projects onto roof surface, none into the hole.
        val cutSt = (0 until cut.vertexCount).map { v -> stOf(plane, Vec3(cut.positions[v * 3].toDouble(), cut.positions[v * 3 + 1].toDouble(), cut.positions[v * 3 + 2].toDouble())) }
        val holeMid = (cutSt.minOf { it.first } + cutSt.maxOf { it.first }) / 2.0 to (cutSt.minOf { it.second } + cutSt.maxOf { it.second }) / 2.0
        assertTrue("the fixture's cut is a hole in the main plane", plane.coverage(holeMid.second).none { holeMid.first > it[0] && holeMid.first < it[1] })
        for (p in corners(main)) assertNotNull("main-roof tile vertex $p over the dormer cut", ownPlane(listOf(plane), p))
    }

    @Test
    fun `specs that cannot lap are refused`() {
        val refused = runCatching { RoofCoverSpec(moduleLength = 0.3, exposure = 0.3) }
        assertNull(refused.getOrNull())
        assertNotNull(runCatching { RoofCoverSpec(tailRound = 0.2) }.exceptionOrNull())
        assertNotNull(runCatching { RoofCoverSpec(lift = 0.0) }.exceptionOrNull())
    }
}
