package com.buildplan.preview

import com.buildplan.preview.camera.ContentFrame
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.PresetTarget
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.scene.ModelScene
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.tan

/**
 * MARCOWKI-UI: the parallel views of the whole house — the four elevations, the plans and the axonometry — show the
 * whole house in the space the chrome leaves free, upright and on its side. On the emulator (API 29, 411 × 914 dp)
 * "Z prawej" of the showcase was cut by a bay at the left edge while "Z lewej" fitted: both were framed by a bounding
 * sphere in a SQUARE field, and the house's box is not centred in the free portrait strip that way. The geometry is
 * not touched; only the camera's zoom and focus.
 */
class ParallelViewFramingTest {

    private val showcase: ModelScene = TestScenes.scene("marcowki-c-v35414")

    /** A phone upright (1080 × 2400) with the resting chrome of the workspace, and the same phone on its side. */
    private val spans = mapOf(
        "portrait" to ContentFrame.fitSpan(1080, 2400, ContentInsets(top = 210, right = 220, bottom = 520)),
        "landscape" to ContentFrame.fitSpan(2400, 1080, ContentInsets(top = 160, right = 230, bottom = 230)),
    )

    private val parallel = ViewPreset.entries.filter { it.projection == Projection.ORTHOGRAPHIC && it.target == PresetTarget.WHOLE_MODEL }

    @Test
    fun `every parallel view of the whole house keeps all its corners inside the free span`() {
        for (scene in listOf(showcase, TestScenes.marcowki, TestScenes.demo)) {
            val camera = OrbitCamera(scene.bounds)
            for ((name, span) in spans) for (preset in parallel) {
                if (!preset.isAvailableIn(scene)) continue
                val pose = preset.poseIn(camera, scene, camera.home(span), span = span) ?: continue
                assertEquals(Projection.ORTHOGRAPHIC, pose.projection)
                val worst = worstEdgeShare(camera, pose, scene, span)
                assertTrue("${scene.key} ${preset.label} $name: a corner at ${"%.3f".format(worst)} of the free half-field", worst <= 1.0 / OrbitCamera.BOX_MARGIN + 1e-9)
                // and the house uses the space: one side of its box reaches the margin
                assertTrue("${scene.key} ${preset.label} $name: the house fills only ${"%.3f".format(worst)}", worst >= 1.0 / OrbitCamera.BOX_MARGIN - 1e-6 || pose.distance <= camera.minDistance + 1e-9)
            }
        }
    }

    @Test
    fun `the two side elevations show the house at the same size, centred`() {
        val camera = OrbitCamera(showcase.bounds)
        for ((name, span) in spans) {
            val left = ViewPreset.LEFT.poseIn(camera, showcase, camera.home(span), span = span)!!
            val right = ViewPreset.RIGHT.poseIn(camera, showcase, camera.home(span), span = span)!!
            assertEquals("$name: left and right elevations at one zoom", left.distance, right.distance, 1e-9)
            assertEquals(showcase.bounds.center, left.target)
            assertEquals(showcase.bounds.center, right.target)
        }
    }

    @Test
    fun `a parallel view never puts the eye inside the house, however tight the fit`() {
        // Audit round 2: on a wide window the box fit of a gable end is shorter than the house is deep; the zoom may
        // be, the eye may not — else the near plane cuts the front of the house away.
        for (scene in listOf(showcase, TestScenes.marcowki, TestScenes.demo)) {
            val camera = OrbitCamera(scene.bounds)
            val wide = OrbitCamera.FitSpan(3.0, 1.0)
            for (span in spans.values + wide) for (preset in parallel) {
                if (!preset.isAvailableIn(scene)) continue
                val pose = preset.poseIn(camera, scene, camera.home(span), span = span) ?: continue
                val eye = camera.eye(pose)
                val (near, far) = camera.clipPlanes(pose)
                val depths = scene.bounds.corners().map { (it - eye) dot camera.basis(pose).forward }
                assertTrue("${scene.key} ${preset.label}: a corner behind the near plane (${depths.min()} < $near)", depths.min() > near)
                assertTrue("${scene.key} ${preset.label}: a corner past the far plane", depths.max() < far)
            }
        }
    }

    @Test
    fun `a long low house seen end-on keeps the eye outside it`() {
        // 30 m long, 4 m wide, 3 m high, seen from its gable end in a wide field: the box fit's zoom is far shorter
        // than the house is deep. Without the eye stepping back, half the house lies behind the eye.
        val bounds = com.buildplan.preview.math.Bounds(com.buildplan.preview.math.Vec3(-2.0, 0.0, -15.0), com.buildplan.preview.math.Vec3(2.0, 3.0, 15.0))
        val camera = OrbitCamera(bounds)
        val start = camera.home(OrbitCamera.FitSpan(3.0, 1.0))
        val pose = camera.frameBoxOrthographic(start, bounds, 0.0, 0.0, OrbitCamera.FitSpan(3.0, 1.0))
        assertTrue("the zoom is shorter than the house is deep (${pose.distance})", pose.distance < 15.0)
        val eye = camera.eye(pose)
        val (near, far) = camera.clipPlanes(pose)
        val depths = bounds.corners().map { (it - eye) dot camera.basis(pose).forward }
        assertTrue("a corner behind the near plane (${depths.min()} < $near)", depths.min() > near)
        assertTrue("a corner past the far plane", depths.max() < far)
        // the parallel image is the same: its extent comes from the zoom alone
        assertEquals(pose.distance * tan(Math.toRadians(camera.fovDeg) / 2.0), camera.orthoHalfHeight(pose), 1e-12)
    }

    @Test
    fun `without a known free span the parallel views frame as before`() {
        val camera = OrbitCamera(showcase.bounds)
        for (preset in parallel.filter { !it.fitsViewport }) {
            val pose = preset.poseIn(camera, showcase, camera.home()) ?: continue
            assertEquals(camera.distanceToFit(showcase.bounds, preset.margin), pose.distance, 1e-9)
        }
    }

    /** How far out the box's corners reach, as a share of the free half-field (1.0 = the edge of the free space). */
    private fun worstEdgeShare(camera: OrbitCamera, pose: OrbitPose, scene: ModelScene, span: OrbitCamera.FitSpan): Double {
        val half = pose.distance * tan(Math.toRadians(camera.fovDeg) / 2.0)
        val b = camera.basis(pose)
        return scene.bounds.corners().maxOf { c ->
            val q = c - pose.target
            maxOf(abs(q dot b.right) / (half * span.horizontal), abs(q dot b.up) / (half * span.vertical))
        }
    }
}
