package com.buildplan.preview.evidence

import com.buildplan.preview.TestScenes
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.presentation.ScenePresentation
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * Same-model visual evidence, written only on request:
 *
 * ```
 * BUILDAPP_PRESENTATION_EVIDENCE_DIR=<dir> \
 * BUILDAPP_PRESENTATION_EXTRA_SCENES=second-house=<path to a .scene.json> \
 *   ./gradlew testDebugUnitTest --tests '*PresentationEvidenceTest*'
 * ```
 *
 * One semantic input per sheet, drawn in MODEL, CLAY and LINE from the same
 * camera poses: the input never changes between columns, only the
 * presentation does. Extra scenes are read from outside the repository, so
 * geometry derived from a third party's project never has to be committed to
 * be reviewed. Rendered by [PresentationRaster] — a stand-in for the GPU that
 * shows geometry and ink, not Filament's light.
 */
class PresentationEvidenceTest {

    private val outDir: File? = System.getenv("BUILDAPP_PRESENTATION_EVIDENCE_DIR")?.takeIf { it.isNotBlank() }?.let(::File)

    private data class View(val name: String, val visibility: VisibilityMode = VisibilityMode.ALL, val pose: (OrbitCamera, ModelScene) -> OrbitPose)

    private val views = listOf(
        View("three-quarter") { c, s -> ViewPreset.WHOLE.poseIn(c, s, c.home())!! },
        View("rear three-quarter") { c, s -> c.frame(c.home(), s.bounds, 215.0, 24.0, Projection.PERSPECTIVE, 1.35) },
        View("front elevation") { c, s -> ViewPreset.FRONT.poseIn(c, s, c.home())!! },
    )

    private val layerViews = listOf(
        View("all", VisibilityMode.ALL) { c, s -> ViewPreset.WHOLE.poseIn(c, s, c.home())!! },
        View("roof off", VisibilityMode.ROOF_OFF) { c, s -> ViewPreset.WHOLE.poseIn(c, s, c.home())!! },
        View("ground only", VisibilityMode.GROUND_ONLY) { c, s -> ViewPreset.WHOLE.poseIn(c, s, c.home())!! },
    )

    private fun scenes(): List<Pair<String, ModelScene>> {
        val shipped = listOf("marcowki-auto-v3", "demo").map { it to TestScenes.scene(it) }
        val fixtures = listOf("roof-dormer-gable").map { key -> "fixture-$key" to TestScenes.fixture(key) }
        val extra = (System.getenv("BUILDAPP_PRESENTATION_EXTRA_SCENES") ?: "").split(',').filter { it.contains('=') }.map { spec ->
            val (key, path) = spec.split('=', limit = 2)
            val bundle = (com.buildplan.preview.scene.BundleParser.parse(File(path).readText()) as com.buildplan.preview.scene.BundleResult.Ok).bundle
            key to ModelScene.from(bundle, key, key, "external bundle")
        }
        return shipped + extra + fixtures
    }

    @Test
    fun `write the same-model comparison sheets`() {
        val dir = outDir
        assumeTrue("set BUILDAPP_PRESENTATION_EVIDENCE_DIR to write evidence", dir != null)
        dir!!.mkdirs()
        val summary = StringBuilder("{\n")
        val list = scenes()
        for ((index, entry) in list.withIndex()) {
            val (key, scene) = entry
            val presentation = ScenePresentation.of(scene)
            val camera = OrbitCamera(scene.bounds)
            val modes = PresentationMode.entries

            val cells = views.map { view ->
                val visible = Visibility.visibleObjectIds(scene, view.visibility) intersect scene.renderableObjectIds
                modes.map { mode -> PresentationRaster(TILE_W, TILE_H).render(scene, presentation, mode, visible, camera, view.pose(camera, scene)) }
            }
            write(sheet(views.map { it.name }, modes.map { it.label }, cells), File(dir, "$key-modes.png"))

            val layerModes = listOf(PresentationMode.CLAY, PresentationMode.LINE)
            val layerCells = layerModes.map { mode ->
                layerViews.map { view ->
                    val visible = Visibility.visibleObjectIds(scene, view.visibility) intersect scene.renderableObjectIds
                    PresentationRaster(TILE_W, TILE_H).render(scene, presentation, mode, visible, camera, view.pose(camera, scene))
                }
            }
            write(sheet(layerModes.map { it.label }, layerViews.map { it.name }, layerCells), File(dir, "$key-layers.png"))

            // A close study of the covering and the lines, larger than a sheet cell.
            val close = camera.frame(camera.home(), scene.bounds, 30.0, 30.0, Projection.PERSPECTIVE, 0.62)
            val all = Visibility.visibleObjectIds(scene, VisibilityMode.ALL) intersect scene.renderableObjectIds
            for (mode in listOf(PresentationMode.CLAY, PresentationMode.LINE)) {
                write(PresentationRaster(1100, 800).render(scene, presentation, mode, all, camera, close), File(dir, "$key-close-${mode.label.lowercase()}.png"))
            }

            // What each mode puts in the Filament scene with every layer on and nothing selected.
            val surfaces = scene.objects.filter { it.id in all }.sumOf { o ->
                (if (o.parts.any { !it.part.isTranslucent }) 1 else 0) + (if (o.parts.any { it.part.isTranslucent }) 1 else 0)
            }
            val drawnJson = PresentationMode.entries.joinToString(", ") { mode ->
                val drawn = presentation.edges.drawn(all, mode.edgeTiers, null)
                val lines = drawn.merged.size + drawn.perObject.size
                val segments = drawn.merged.sumOf { presentation.edges.merged[it].segmentCount } + drawn.perObject.sumOf { presentation.edges.groups[it].segmentCount }
                val covers = if (mode.showsRoofCover) presentation.roofCovers.filter { it.objectId in all } else emptyList()
                val triangles = scene.objects.filter { it.id in all }.sumOf { it.triangleCount } + covers.sumOf { it.triangleCount }
                "\"${mode.label}\": {\"renderables\": ${surfaces + lines + covers.size}, \"surfaceRenderables\": $surfaces, \"lineRenderables\": $lines, \"coverRenderables\": ${covers.size}, \"triangles\": $triangles, \"lineSegments\": $segments}"
            }
            val stats = presentation.stats(scene)
            summary.append("  \"$key\": {\"contentHash\": \"${scene.bundle.contentHash}\", \"renderablesBeforeThisStage\": ${scene.objects.count { it.id in all }}, \"drawnWholeModel\": {$drawnJson}, \"stats\": \"$stats\", \"deriveMillisJvm\": ${presentation.buildMillis}, ")
            summary.append("\"covers\": [${presentation.roofCovers.joinToString { "{\"object\": \"${it.objectId}\", \"planes\": ${it.planeCount}, \"tiles\": ${it.tileCount}, \"triangles\": ${it.triangleCount}, \"dropped\": \"${it.dropped}\"}" }}]}")
            summary.append(if (index < list.size - 1) ",\n" else "\n")
        }
        summary.append("}\n")
        File(dir, "presentation-evidence.json").writeText(summary.toString())
    }

    /**
     * Cells laid out row by row with a thin gutter; no text (the unit-test
     * classpath has no font rasteriser). The README beside the sheets names
     * the rows and columns.
     */
    private fun sheet(rows: List<String>, columns: List<String>, cells: List<List<RgbImage>>): RgbImage {
        val gap = 6
        val img = RgbImage(columns.size * (TILE_W + gap) + gap, rows.size * (TILE_H + gap) + gap)
        img.fill(0x202226)
        for (r in rows.indices) for (c in columns.indices) img.draw(cells[r][c], gap + c * (TILE_W + gap), gap + r * (TILE_H + gap))
        return img
    }

    private fun write(img: RgbImage, file: File) {
        img.writePng(file)
        println("wrote ${file.path}")
    }

    private companion object {
        const val TILE_W = 560
        const val TILE_H = 420
    }
}
