package com.buildplan.preview

import com.buildplan.preview.math.Vec3
import com.buildplan.preview.scene.BundleMesh
import com.buildplan.preview.scene.BundleObject
import com.buildplan.preview.scene.BundleScene
import com.buildplan.preview.scene.BundleStats
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneBundle
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.tan

/**
 * Synthetic geometry for the presentation tests: boxes and roof planes
 * written as triangles in the RENDER frame (x right, y up, z towards the
 * viewer, counter-clockwise outward), and a way to wrap them in a bundle the
 * way the exporter would.
 *
 * Every dimension here is invented for the test and belongs to no building.
 */
object PresentationFixtures {

    /** Triangles as 9 floats each. */
    class Tris {
        val data = ArrayList<Float>()

        fun tri(a: Vec3, b: Vec3, c: Vec3): Tris = apply {
            for (p in listOf(a, b, c)) { data.add(p.x.toFloat()); data.add(p.y.toFloat()); data.add(p.z.toFloat()) }
        }

        /** A planar quad a-b-c-d, counter-clockwise seen from its outside. */
        fun quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3): Tris = tri(a, b, c).tri(a, c, d)

        /** An axis-aligned box, every face outward. */
        fun box(min: Vec3, max: Vec3): Tris = apply {
            val (x0, y0, z0) = Triple(min.x, min.y, min.z)
            val (x1, y1, z1) = Triple(max.x, max.y, max.z)
            quad(Vec3(x0, y0, z1), Vec3(x1, y0, z1), Vec3(x1, y1, z1), Vec3(x0, y1, z1)) // +z
            quad(Vec3(x1, y0, z0), Vec3(x0, y0, z0), Vec3(x0, y1, z0), Vec3(x1, y1, z0)) // -z
            quad(Vec3(x1, y0, z1), Vec3(x1, y0, z0), Vec3(x1, y1, z0), Vec3(x1, y1, z1)) // +x
            quad(Vec3(x0, y0, z0), Vec3(x0, y0, z1), Vec3(x0, y1, z1), Vec3(x0, y1, z0)) // -x
            quad(Vec3(x0, y1, z1), Vec3(x1, y1, z1), Vec3(x1, y1, z0), Vec3(x0, y1, z0)) // +y
            quad(Vec3(x0, y0, z0), Vec3(x1, y0, z0), Vec3(x1, y0, z1), Vec3(x0, y0, z1)) // -y
        }

        fun floats(): FloatArray = data.toFloatArray()
    }

    /** One mesh of a synthetic bundle, from render-frame triangles. */
    class Mesh(
        val objectId: String,
        val kind: String,
        val part: String,
        val tris: Tris,
        val levelId: String? = "level-a",
        val semanticGroup: String? = null,
    )

    /**
     * A bundle whose meshes, once `ModelScene` has put them through the one
     * frame conversion, are exactly the render-frame triangles given: the
     * inverse of that conversion (mirror z, swap the last two corners) is
     * applied here, once.
     */
    fun scene(key: String, meshes: List<Mesh>): ModelScene {
        val bundleMeshes = meshes.map { m ->
            val f = m.tris.floats()
            val out = DoubleArray(f.size)
            for (t in 0 until f.size / 9) {
                for ((slot, from) in intArrayOf(0, 2, 1).withIndex()) {
                    out[t * 9 + slot * 3] = f[t * 9 + from * 3].toDouble()
                    out[t * 9 + slot * 3 + 1] = f[t * 9 + from * 3 + 1].toDouble()
                    out[t * 9 + slot * 3 + 2] = -f[t * 9 + from * 3 + 2].toDouble()
                }
            }
            BundleMesh(
                objectId = m.objectId,
                objectKind = m.kind,
                part = m.part,
                levelId = m.levelId,
                semanticGroup = m.semanticGroup,
                triangleCount = f.size / 9,
                positions = out,
            )
        }
        val objects = meshes.map { it.objectId }.distinct().map { id -> BundleObject(id = id, kind = meshes.first { it.objectId == id }.kind, label = id) }
        val bundle = SceneBundle(
            schema = "buildapp.mobile-scene-bundle",
            schemaVersion = "1.0.0",
            scene = BundleScene(meshes = bundleMeshes, stats = BundleStats(bundleMeshes.sumOf { it.triangleCount }, bundleMeshes.size, objects.size)),
            objects = objects,
        )
        return ModelScene.from(bundle, key, key, "synthetic")
    }

    /**
     * A gable roof slab, ridge along x, in the render frame: two sloped top
     * faces of [pitchDeg] over a [span] × [length] plan, thickness [thick],
     * rotated by [yawDeg] about the plan centre. Underside and ends included
     * so it is a closed solid like the compiler's.
     */
    fun gableRoof(span: Double, length: Double, pitchDeg: Double, eaveY: Double, thick: Double = 0.25, yawDeg: Double = 0.0): Tris {
        val rise = span / 2.0 * tan(Math.toRadians(pitchDeg))
        val c = cos(Math.toRadians(yawDeg))
        val s = sin(Math.toRadians(yawDeg))
        fun p(x: Double, y: Double, z: Double): Vec3 {
            val dx = x - length / 2.0
            val dz = z - span / 2.0
            return Vec3(dx * c - dz * s, y, dx * s + dz * c)
        }
        val t = Tris()
        val eF = p(0.0, eaveY, span); val eF1 = p(length, eaveY, span)
        val eB = p(0.0, eaveY, 0.0); val eB1 = p(length, eaveY, 0.0)
        val r0 = p(0.0, eaveY + rise, span / 2.0); val r1 = p(length, eaveY + rise, span / 2.0)
        // Top faces: front slope (towards +z) and back slope.
        t.quad(eF, eF1, r1, r0)
        t.quad(eB1, eB, r0, r1)
        // Underside, a thickness below, and the gable ends, so the slab is closed.
        val d = Vec3(0.0, -thick, 0.0)
        t.quad(r0 + d, r1 + d, eF1 + d, eF + d)
        t.quad(r1 + d, r0 + d, eB + d, eB1 + d)
        t.tri(eF, r0, r0 + d).tri(eF, r0 + d, eF + d)
        t.tri(r0, eB, eB + d).tri(r0, eB + d, r0 + d)
        t.tri(r1, eF1, eF1 + d).tri(r1, eF1 + d, r1 + d)
        t.tri(eB1, r1, r1 + d).tri(eB1, r1 + d, eB1 + d)
        return t
    }
}
