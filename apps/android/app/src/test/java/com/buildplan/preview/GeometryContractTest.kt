package com.buildplan.preview

import com.buildplan.preview.math.Vec3
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ModelFrame
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

/**
 * The building must arrive on screen the right way round.
 *
 * These checks run on the real shipped bundles and compare the converted
 * geometry against the bundle's own untouched model coordinates. Nothing here
 * hard-codes a dimension of any particular house: an expectation is either the
 * documented transform applied to what the bundle says, or a property every
 * building has.
 */
class GeometryContractTest {

    private val scenes = listOf(TestScenes.marcowki, TestScenes.demo)

    @Test
    fun `left and right are not swapped - x passes through untouched`() {
        for (scene in scenes) {
            for (mesh in scene.bundle.scene.meshes) {
                val converted = ModelFrame.renderPositions(mesh.positions)
                var t = 0
                while (t + 8 < mesh.positions.size) {
                    // Every vertex of the triangle, wherever the re-wind put it.
                    val modelXs = listOf(mesh.positions[t], mesh.positions[t + 3], mesh.positions[t + 6]).sorted()
                    val renderXs = listOf(converted[t].toDouble(), converted[t + 3].toDouble(), converted[t + 6].toDouble()).sorted()
                    for (i in 0..2) assertEquals("${scene.key} ${mesh.objectId}: x moved", modelXs[i], renderXs[i], 1e-4)
                    t += 9
                }
            }
        }
    }

    @Test
    fun `front and rear are not mirrored - depth order reverses exactly once`() {
        for (scene in scenes) {
            val metadata = scene.bundle.objects.filter { it.bounds != null }
            assertTrue(metadata.size > 4)
            for (meta in metadata) {
                val obj = scene.objectById(meta.id) ?: continue
                val modelBounds = meta.bounds!!
                // The model's front (smallest z) must become the render frame's
                // largest z, and its back the smallest.
                assertEquals("${scene.key} ${meta.id} front", -modelBounds.max.z, obj.bounds.min.z, 1e-3)
                assertEquals("${scene.key} ${meta.id} back", -modelBounds.min.z, obj.bounds.max.z, 1e-3)
            }

            // And the ordering of two objects by depth is reversed, not kept.
            val sortedByModel = metadata.sortedBy { it.bounds!!.min.z }
            val front = scene.objectById(sortedByModel.first().id)!!
            val back = scene.objectById(sortedByModel.last().id)!!
            assertTrue(
                "${scene.key}: the object nearest the front facade must end up nearest the camera at yaw 0",
                front.bounds.center.z > back.bounds.center.z,
            )
        }
    }

    @Test
    fun `heights are untouched - y passes through`() {
        for (scene in scenes) {
            for (meta in scene.bundle.objects) {
                val obj = scene.objectById(meta.id) ?: continue
                val b = meta.bounds ?: continue
                assertEquals("${scene.key} ${meta.id} bottom", b.min.y, obj.bounds.min.y, 1e-3)
                assertEquals("${scene.key} ${meta.id} top", b.max.y, obj.bounds.max.y, 1e-3)
            }
        }
    }

    @Test
    fun `triangle winding survives - every structural solid encloses a positive volume`() {
        for (scene in scenes) {
            val bySolid = HashMap<String, MutableList<Float>>()
            for (mesh in scene.bundle.scene.meshes) {
                if (!mesh.structural) continue
                val converted = ModelFrame.renderPositions(mesh.positions)
                bySolid.getOrPut(mesh.solidId) { mutableListOf() }.addAll(converted.toTypedArray())
            }
            assertTrue("${scene.key} must have structural solids", bySolid.isNotEmpty())
            for ((solidId, coords) in bySolid) {
                val volume6 = ModelFrame.signedVolume6(coords.toFloatArray())
                assertTrue(
                    "${scene.key} solid $solidId is wound inside-out in the render frame (6V = $volume6); back-face culling would hollow it out",
                    volume6 > 0.0,
                )
            }
        }
    }

    @Test
    fun `roofs point upward - the ridge face's outward normal has positive y`() {
        for (scene in scenes) {
            val roofs = scene.objects.filter { o -> o.parts.any { it.part == GeometryPart.ROOF } }
            assertTrue("${scene.key} should have a roof", roofs.isNotEmpty())
            for (roof in roofs) {
                val triangles = roofTriangles(roof)
                assertTrue(triangles.isNotEmpty())
                // The highest-sitting roof triangle is on the top surface, so
                // its outward normal must point up and out, never down.
                val highest = triangles.maxByOrNull { (it.first.y + it.second.y + it.third.y) / 3.0 }!!
                val n = normalOf(highest)
                assertTrue(
                    "${scene.key} ${roof.id}: the topmost roof face points down (n.y = ${n.y}) — the roof is inside out",
                    n.y > 0.0,
                )
                // Some of the roof faces up and an equal amount faces down: a
                // roof is a closed plate, not a single surface.
                assertTrue(triangles.any { normalOf(it).y > 0.1 })
                assertTrue(triangles.any { normalOf(it).y < -0.1 })
            }
        }
    }

    @Test
    fun `the staircase rises, and turns the same way it does in the model`() {
        val scene = TestScenes.marcowki
        val stairId = scene.stairObjectId
        assertTrue("the reference model has a real staircase", stairId != null)
        val stair = scene.objectById(stairId)!!
        assertTrue("the staircase must be built from real steps", stair.parts.any { it.part == GeometryPart.STAIR_STEP })

        // Compare the stair's own geometry before and after conversion: the
        // travel from the lowest step to the highest must be the model's
        // travel with z mirrored, and nothing else.
        val meshes = scene.bundle.scene.meshes.filter { it.objectId == stairId && it.part == "STAIR_STEP" }
        assertTrue(meshes.isNotEmpty())

        var lowest = Vec3(0.0, Double.MAX_VALUE, 0.0)
        var highest = Vec3(0.0, -Double.MAX_VALUE, 0.0)
        for (mesh in meshes) {
            var i = 0
            while (i + 2 < mesh.positions.size) {
                val p = Vec3(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2])
                if (p.y < lowest.y) lowest = p
                if (p.y > highest.y) highest = p
                i += 3
            }
        }
        assertTrue("a staircase must gain height", highest.y - lowest.y > 0.5)

        val modelTravel = highest - lowest
        val renderLow = ModelFrame.point(lowest.x, lowest.y, lowest.z)
        val renderHigh = ModelFrame.point(highest.x, highest.y, highest.z)
        val renderTravel = renderHigh - renderLow
        assertEquals("the stair must not slide sideways", modelTravel.x, renderTravel.x, 1e-6)
        assertEquals("the stair must still go up", modelTravel.y, renderTravel.y, 1e-6)
        assertEquals("the stair must turn the same way, mirrored once", -modelTravel.z, renderTravel.z, 1e-6)
        assertTrue("a rise of ${renderTravel.y} m must be upward in the render frame", renderTravel.y > 0.0)
    }

    @Test
    fun `rooflights stay real holes - their glazing sits inside the roof it cut`() {
        val scene = TestScenes.marcowki
        val rooflights = scene.objects.filter { it.kind == "rooflight" }
        assertTrue("the reference model has rooflights", rooflights.isNotEmpty())
        val roofs = scene.objects.filter { o -> o.parts.any { it.part == GeometryPart.ROOF } }
        for (light in rooflights) {
            assertTrue("a rooflight must be glazed", light.parts.any { it.part == GeometryPart.ROOFLIGHT_GLASS })
            assertTrue("a rooflight must have a frame", light.parts.any { it.part == GeometryPart.ROOFLIGHT_FRAME })
            val inside = roofs.any { roof ->
                light.bounds.center.x in roof.bounds.min.x..roof.bounds.max.x &&
                    light.bounds.center.z in roof.bounds.min.z..roof.bounds.max.z
            }
            assertTrue("${light.id} must sit within a roof", inside)
        }
        // The compiler reports a hole it could not cut; the bundle carries its
        // diagnostics, so an uncut rooflight would show up here.
        val uncut = scene.bundle.scene.diagnostics.filter { it.code == "ROOF_OPENING_NOT_CUT" }
        assertTrue("roof openings must be real holes, but got $uncut", uncut.isEmpty())
    }

    @Test
    fun `the compiler reported no errors for the shipped scenes`() {
        for (scene in scenes) {
            val errors = scene.bundle.scene.diagnostics.filter { it.severity == "ERROR" }
            assertTrue("${scene.key} ships with compiler errors: $errors", errors.isEmpty())
        }
    }

    @Test
    fun `every mesh keeps its semantic owner through the conversion`() {
        for (scene in scenes) {
            val fromBundle = scene.bundle.scene.meshes.map { it.objectId }.toSet()
            assertEquals("${scene.key}: an object was lost or invented", fromBundle, scene.objects.map { it.id }.toSet())
            assertEquals(scene.bundle.scene.stats.objectCount, scene.objects.size)
            // Triangle counts must survive too.
            assertEquals(
                scene.bundle.scene.stats.triangleCount,
                scene.objects.sumOf { it.triangleCount },
            )
            for (obj in scene.objects) assertEquals("${obj.id} vertex count", obj.triangleCount * 3, obj.vertexCount)
        }
    }

    @Test
    fun `parts of one semantic object stay one selectable thing`() {
        val scene = TestScenes.marcowki
        // A door assembly is several compiled meshes; it must be one object.
        val door = scene.objects.first { it.kind == "door" && it.parts.size > 2 }
        assertTrue("a door is made of several parts", door.parts.size >= 3)
        val ranges = door.parts.map { it.first until (it.first + it.count) }
        // The parts tile the object's vertices exactly once each.
        assertEquals(door.vertexCount, ranges.sumOf { it.count() })
        assertEquals(0, ranges.first().first)
        for (i in 1 until ranges.size) assertEquals(ranges[i - 1].last + 1, ranges[i].first)
    }

    private data class Tri(val first: Vec3, val second: Vec3, val third: Vec3)

    private fun roofTriangles(obj: SceneObject): List<Tri> {
        val out = ArrayList<Tri>()
        for (part in obj.parts) {
            if (part.part != GeometryPart.ROOF) continue
            var v = part.first
            while (v + 2 < part.first + part.count) {
                out.add(
                    Tri(
                        vertex(obj, v), vertex(obj, v + 1), vertex(obj, v + 2),
                    ),
                )
                v += 3
            }
        }
        return out
    }

    private fun vertex(obj: SceneObject, index: Int) = Vec3(
        obj.positions[index * 3].toDouble(),
        obj.positions[index * 3 + 1].toDouble(),
        obj.positions[index * 3 + 2].toDouble(),
    )

    private fun normalOf(t: Tri): Vec3 = ((t.second - t.first) cross (t.third - t.first)).normalized()
}
