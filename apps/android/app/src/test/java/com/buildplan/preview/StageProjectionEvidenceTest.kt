package com.buildplan.preview

import com.buildplan.preview.progress.ConstructionGroup
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionView
import com.buildplan.preview.progress.StageProjection
import com.buildplan.preview.scene.BundleParser
import com.buildplan.preview.scene.BundleResult
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.ViewerState
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Evidence, not a gate: the stage projection over scene bundles that are not
 * in the APK — a house analysed live (the second house of 03Y2G), a download
 * from a phone. Runs only when told where they are:
 *
 *   BUILDPLAN_STAGE_SCENES=a.scene.json,b.scene.json   bundles to project
 *   BUILDPLAN_STAGE_EVIDENCE_OUT=<dir>                  where the summary goes (optional)
 *
 * The same generic rules as every other house: nothing here names one. Each
 * bundle must project without error, only ever add objects along the stages
 * and end at the whole model minus what no rule places; the summary records
 * the counts per stage and group, the unplaced objects by kind, and how long
 * projecting took.
 */
class StageProjectionEvidenceTest {
    @Test
    fun projectExternalScenes() {
        val paths = System.getenv("BUILDPLAN_STAGE_SCENES")?.split(',')?.map { it.trim() }?.filter { it.isNotEmpty() }.orEmpty()
        assumeTrue("BUILDPLAN_STAGE_SCENES not set", paths.isNotEmpty())
        val reports = buildJsonArray {
            for (path in paths) {
                val file = File(path)
                val bundle = when (val r = BundleParser.parse(file.readText())) {
                    is BundleResult.Ok -> r.bundle
                    is BundleResult.Failure -> throw AssertionError("$path did not parse: ${r.message}")
                }
                val scene = ModelScene.from(bundle, file.nameWithoutExtension, bundle.generatedFrom.modelName, "evidence")
                val t0 = System.nanoTime()
                val projection = StageProjection(scene)
                val buildNs = System.nanoTime() - t0

                var previous = emptySet<String>()
                val perStage = buildJsonObject {
                    for (stage in ConstructionStageKey.entries) {
                        val now = checkNotNull(projection.visibleIds(ConstructionView.AtStage(stage)))
                        assertTrue("$path: $stage removes something", now.containsAll(previous))
                        put(stage.key, now.size)
                        previous = now
                    }
                }
                assertEquals("$path: last stage + unplaced = whole model", scene.objects.map { it.id }.toSet(), previous + projection.unmapped)

                // One scrub step, as the viewer does it: a new construction filter, then the visible set.
                val viewer = ViewerState()
                val t1 = System.nanoTime()
                var steps = 0
                for (stage in ConstructionStageKey.entries) {
                    viewer.withConstruction(projection.visibleIds(ConstructionView.AtStage(stage))).visibleObjectIds(scene)
                    steps++
                }
                val scrubNs = (System.nanoTime() - t1) / steps

                add(
                    buildJsonObject {
                        put("file", file.name)
                        put("modelId", bundle.generatedFrom.modelId)
                        put("objects", scene.objects.size)
                        put("objectsPerStage", perStage)
                        put(
                            "objectsPerGroup",
                            buildJsonObject { for (g in ConstructionGroup.entries) put(g.name, projection.groups.values.count { it == g }) },
                        )
                        put(
                            "unplacedByKind",
                            buildJsonObject {
                                for ((kind, n) in scene.objects.filter { it.id in projection.unmapped }.groupingBy { it.kind }.eachCount().toSortedMap()) put(kind, n)
                            },
                        )
                        put("stagesWithoutGeometry", buildJsonArray { ConstructionStageKey.entries.filterNot { projection.hasGeometry(it) }.forEach { add(kotlinx.serialization.json.JsonPrimitive(it.key)) } })
                        put("projectionBuildMs", buildNs / 1e6)
                        put("scrubStepMs", scrubNs / 1e6)
                    },
                )
            }
        }
        val text = Json { prettyPrint = true }.encodeToString(kotlinx.serialization.json.JsonArray.serializer(), reports)
        println(text)
        System.getenv("BUILDPLAN_STAGE_EVIDENCE_OUT")?.let { dir ->
            File(dir).mkdirs()
            File(dir, "stage-projection-evidence.json").writeText(text + "\n")
        }
    }
}
