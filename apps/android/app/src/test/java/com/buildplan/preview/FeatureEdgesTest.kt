package com.buildplan.preview

import com.buildplan.preview.PresentationFixtures.Tris
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.presentation.EdgeClass
import com.buildplan.preview.presentation.EdgeSource
import com.buildplan.preview.presentation.EdgeTier
import com.buildplan.preview.presentation.FeatureEdges
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Edge classification: which sides of the compiled triangles are inked.
 *
 * Synthetic solids pin each rule down on its own; the shipped scenes then hold
 * the whole scene to invariants that do not depend on which building it is.
 */
class FeatureEdgesTest {

    private fun source(id: String, tris: Tris, cls: String = "body@a", tier: EdgeTier = EdgeTier.STRUCTURAL): EdgeSource {
        val f = tris.floats()
        return EdgeSource(id, cls, f, List(f.size / 9) { tier })
    }

    private fun segmentKey(a: Vec3, b: Vec3): List<Long> {
        val ka = listOf(a.x, a.y, a.z).map { Math.round(it * 1e4) }
        val kb = listOf(b.x, b.y, b.z).map { Math.round(it * 1e4) }
        return if (ka.toString() < kb.toString()) ka + kb else kb + ka
    }

    @Test
    fun `a box is inked at its twelve edges and never across a face`() {
        val set = FeatureEdges.compute(listOf(source("box", Tris().box(Vec3(0.0, 0.0, 0.0), Vec3(2.0, 1.0, 1.0)))))
        assertEquals(12, set.segmentCount)
        assertEquals("the six face diagonals are seams", 6, set.counts.getValue(EdgeClass.INTERNAL_SEAM))
        assertEquals(12, set.counts.getValue(EdgeClass.CREASE))
        assertEquals(0, set.counts.getValue(EdgeClass.BOUNDARY))
        assertEquals(0, set.counts.getValue(EdgeClass.SHARED_SEAM))
    }

    @Test
    fun `a free panel is inked at its boundary, not its diagonal`() {
        val panel = Tris().quad(Vec3(0.0, 0.0, 0.0), Vec3(1.0, 0.0, 0.0), Vec3(1.0, 1.0, 0.0), Vec3(0.0, 1.0, 0.0))
        val set = FeatureEdges.compute(listOf(source("panel", panel)))
        assertEquals(4, set.segmentCount)
        assertEquals(4, set.counts.getValue(EdgeClass.BOUNDARY))
        assertEquals(1, set.counts.getValue(EdgeClass.INTERNAL_SEAM))
    }

    @Test
    fun `two blocks of one object read as one solid where their faces continue`() {
        // A wall baked as two boxes end to end: the line across its faces
        // where the boxes meet is not a line on the building.
        val wall = Tris().box(Vec3(0.0, 0.0, 0.0), Vec3(1.0, 1.0, 0.3)).box(Vec3(1.0, 0.0, 0.0), Vec3(2.0, 1.0, 0.3))
        val set = FeatureEdges.compute(listOf(source("wall", wall)))
        val drawn = set.segmentsDrawn(setOf("wall"), EdgeTier.entries.toSet(), null)
        // The four long edges and the two end rectangles: 12 box edges, the long ones split in two by the joint.
        assertEquals(16, drawn.size)
        // No vertical line on the front face at the joint.
        assertFalse(segmentKey(Vec3(1.0, 0.0, 0.3), Vec3(1.0, 1.0, 0.3)) in drawn)
        assertTrue(segmentKey(Vec3(0.0, 1.0, 0.3), Vec3(1.0, 1.0, 0.3)) in drawn)
    }

    @Test
    fun `a side is split where another corner lies on it, and only the shared piece is a seam`() {
        // A long lower block with a short block on its left half: the lower
        // block's top front edge runs the whole length, the upper block's
        // front face continues the lower one over the left half only.
        val body = Tris().box(Vec3(0.0, 0.0, 0.0), Vec3(2.0, 1.0, 1.0)).box(Vec3(0.0, 1.0, 0.0), Vec3(1.0, 2.0, 1.0))
        val set = FeatureEdges.compute(listOf(source("body", body)))
        val drawn = set.segmentsDrawn(setOf("body"), EdgeTier.entries.toSet(), null)
        assertFalse("the front faces continue over the left half", segmentKey(Vec3(0.0, 1.0, 1.0), Vec3(1.0, 1.0, 1.0)) in drawn)
        assertTrue("the right half is a real crease", segmentKey(Vec3(1.0, 1.0, 1.0), Vec3(2.0, 1.0, 1.0)) in drawn)
    }

    @Test
    fun `a neighbour's coplanar face makes a shared seam, drawn only while the neighbour is hidden`() {
        val lower = Tris().box(Vec3(0.0, 0.0, 0.0), Vec3(2.0, 1.0, 1.0))
        val upper = Tris().box(Vec3(0.0, 1.0, 0.0), Vec3(2.0, 2.0, 1.0))
        val set = FeatureEdges.compute(listOf(source("ground-wall", lower, "body@ground"), source("upper-wall", upper, "body@upper")))
        val seam = segmentKey(Vec3(0.0, 1.0, 1.0), Vec3(2.0, 1.0, 1.0))
        val tiers = EdgeTier.entries.toSet()

        assertFalse("both shown: the facade is one surface", seam in set.segmentsDrawn(setOf("ground-wall", "upper-wall"), tiers, null))
        assertTrue("upper hidden: the ground wall keeps its outline", seam in set.segmentsDrawn(setOf("ground-wall"), tiers, null))
        assertTrue("ground hidden: the upper wall keeps its outline", seam in set.segmentsDrawn(setOf("upper-wall"), tiers, null))

        val shared = set.groups.filter { it.isShared }
        assertEquals(setOf("ground-wall", "upper-wall"), shared.map { it.objectId }.toSet())
        assertEquals(listOf("body@upper"), shared.first { it.objectId == "ground-wall" }.partnerClasses)
        assertEquals(listOf("upper-wall"), shared.first { it.objectId == "ground-wall" }.partners)
    }

    @Test
    fun `a face lying ON another does not erase that one's crease`() {
        // A finish band lying on a wall's front face, touching its top edge:
        // same plane, same facing, but the SAME side of the edge — an
        // overlap, not a continuation.
        val wall = Tris().box(Vec3(0.0, 0.0, 0.0), Vec3(2.0, 1.0, 0.3))
        val band = Tris().quad(Vec3(0.0, 0.5, 0.3), Vec3(2.0, 0.5, 0.3), Vec3(2.0, 1.0, 0.3), Vec3(0.0, 1.0, 0.3))
        val set = FeatureEdges.compute(listOf(source("wall", wall), source("band", band)))
        val topFront = segmentKey(Vec3(0.0, 1.0, 0.3), Vec3(2.0, 1.0, 0.3))
        assertTrue(topFront in set.segmentsDrawn(setOf("wall", "band"), EdgeTier.entries.toSet(), null))
        assertTrue(set.groups.none { it.objectId == "wall" && it.isShared })
    }

    @Test
    fun `tiers follow the palette's edge treatment and glazing is never inked`() {
        val scene = TestScenes.autoCandidateV3
        for (obj in scene.objects) for (part in obj.parts) {
            val tier = FeatureEdges.tierOf(part, scene.styling)
            if (part.part.isTranslucent) assertEquals("${obj.id} ${part.part} is translucent", null, tier)
        }
        val walls = scene.objects.flatMap { it.parts }.filter { it.part == GeometryPart.WALL }
        assertTrue(walls.isNotEmpty())
        assertTrue(walls.all { FeatureEdges.tierOf(it, scene.styling) == EdgeTier.STRUCTURAL })
        val frames = scene.objects.flatMap { it.parts }.filter { it.part == GeometryPart.WINDOW_FRAME }
        assertTrue(frames.isNotEmpty())
        assertTrue(frames.all { FeatureEdges.tierOf(it, scene.styling) == EdgeTier.DETAIL })
        assertEquals(setOf(EdgeTier.STRUCTURAL), PresentationMode.CLAY.edgeTiers)
        assertEquals(EdgeTier.entries.toSet(), PresentationMode.LINE.edgeTiers)
        assertEquals(emptySet<EdgeTier>(), PresentationMode.MODEL.edgeTiers)
    }

    @Test
    fun `classification is deterministic`() {
        for (scene in listOf(TestScenes.autoCandidateV3, TestScenes.demo)) {
            val a = FeatureEdges.of(scene)
            val b = FeatureEdges.of(scene)
            assertEquals(a.counts, b.counts)
            assertEquals(a.groups.size, b.groups.size)
            for (i in a.groups.indices) {
                assertEquals(a.groups[i].objectId, b.groups[i].objectId)
                assertTrue("${scene.key} group $i differs", a.groups[i].positions.contentEquals(b.groups[i].positions))
            }
        }
    }

    /** Every inked segment lies along a side of one of its own object's triangles: no line is invented. */
    @Test
    fun `every line lies on its own object's triangles`() {
        for (scene in TestScenes.all) {
            val set = FeatureEdges.of(scene)
            for (g in set.groups) {
                val obj = scene.objectById(g.objectId)!!
                val sides = sidesOf(obj.positions)
                for (s in 0 until g.segmentCount) {
                    val a = Vec3(g.positions[s * 6].toDouble(), g.positions[s * 6 + 1].toDouble(), g.positions[s * 6 + 2].toDouble())
                    val b = Vec3(g.positions[s * 6 + 3].toDouble(), g.positions[s * 6 + 4].toDouble(), g.positions[s * 6 + 5].toDouble())
                    assertTrue("${scene.key} ${g.objectId}: segment $a–$b lies on none of its sides", sides.any { onSide(a, it) && onSide(b, it) })
                }
            }
        }
    }

    /**
     * Batching by class is an optimisation, not a rule: for every layer mode,
     * isolation and selection of every shipped scene, the batched draw shows
     * exactly the segments the per-object rule shows.
     */
    @Test
    fun `batched lines are exactly the per-object rule, in every layer state`() {
        for (scene in TestScenes.all) {
            val set = FeatureEdges.of(scene)
            val states = VisibilityMode.entries.map { Visibility.visibleObjectIds(scene, it) to null as String? } +
                scene.objects.filter { it.hasGeometry }.take(12).map { setOf(it.id) to it.id } +
                listOf(Visibility.visibleObjectIds(scene, VisibilityMode.ALL) to scene.objects.first { it.kind == "wall" }.id)
            for (tiers in listOf(PresentationMode.CLAY.edgeTiers, PresentationMode.LINE.edgeTiers)) {
                for ((visible, selected) in states) {
                    val expected = HashSet<List<Long>>()
                    for (g in set.groups) if (g.isDrawn(visible, tiers)) {
                        for (s in 0 until g.segmentCount) expected.add(key(g.positions, s))
                    }
                    assertEquals("${scene.key} ${visible.size} visible, selected $selected", expected, set.segmentsDrawn(visible, tiers, selected))
                }
            }
        }
    }

    @Test
    fun `a hidden object's lines are never drawn`() {
        for (scene in TestScenes.all) {
            val set = FeatureEdges.of(scene)
            val roofOff = Visibility.visibleObjectIds(scene, VisibilityMode.ROOF_OFF)
            val drawn = set.drawn(roofOff, PresentationMode.LINE.edgeTiers, null)
            val owners = drawn.merged.flatMap { set.merged[it].members } + drawn.perObject.map { set.groups[it].objectId }
            assertTrue(scene.key, owners.all { it in roofOff })
            assertTrue(scene.key, owners.none { scene.objectById(it)!!.kind in Visibility.ROOF_KINDS })
        }
    }

    @Test
    fun `layer modes draw a handful of batches, not one line object per wall`() {
        for (scene in TestScenes.all) {
            val set = FeatureEdges.of(scene)
            val all = Visibility.visibleObjectIds(scene, VisibilityMode.ALL)
            val drawn = set.drawn(all, PresentationMode.LINE.edgeTiers, null)
            assertTrue("${scene.key}: ${drawn.perObject.size} per-object groups drawn with every layer on", drawn.perObject.isEmpty())
            assertTrue("${scene.key}: ${drawn.merged.size} batches", drawn.merged.size <= 40)
        }
    }

    private fun key(p: FloatArray, s: Int): List<Long> {
        val a = (0 until 3).map { Math.round(p[s * 6 + it] * 1e4) }
        val b = (0 until 3).map { Math.round(p[s * 6 + 3 + it] * 1e4) }
        return if (a.toString() < b.toString()) a + b else b + a
    }

    private fun sidesOf(positions: FloatArray): List<Pair<Vec3, Vec3>> {
        val out = ArrayList<Pair<Vec3, Vec3>>()
        for (t in 0 until positions.size / 9) {
            val v = (0 until 3).map { i -> Vec3(positions[t * 9 + i * 3].toDouble(), positions[t * 9 + i * 3 + 1].toDouble(), positions[t * 9 + i * 3 + 2].toDouble()) }
            out.add(v[0] to v[1]); out.add(v[1] to v[2]); out.add(v[2] to v[0])
        }
        return out
    }

    private fun onSide(p: Vec3, side: Pair<Vec3, Vec3>): Boolean {
        val d = side.second - side.first
        val dd = d dot d
        if (dd <= 0.0) return false
        val t = ((p - side.first) dot d) / dd
        if (t < -1e-6 || t > 1 + 1e-6) return false
        val off = p - (side.first + d * t)
        return (off dot off) <= 1e-7
    }
}
