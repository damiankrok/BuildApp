package com.buildplan.preview

import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Test

/**
 * The whole path from asset to Filament scene, printed.
 *
 * Diagnostics rather than assertions: when a model looks wrong on a phone this
 * is what says at which step it stopped being the building — the bundle's
 * objects, the SceneObjects decoded from them, the entities those become, and
 * the entities each layer mode actually puts in the scene, grouped the way a
 * person reads a building.
 */
class RenderTraceTest {

    private fun byKindAndLevel(objects: List<com.buildplan.preview.scene.SceneObject>): String =
        objects.groupingBy { "${it.kind}@${it.levelId ?: "-"}" }.eachCount().toSortedMap().toString()

    private fun trace(scene: ModelScene) {
        val bundle = scene.bundle
        println("── ${scene.key}: ${scene.title}")
        println("   bundle          meshes=${bundle.scene.meshes.size} objects=${bundle.objects.size} triangles=${bundle.scene.stats.triangleCount} hash=${bundle.contentHash.take(8)}")
        println("   decoded         SceneObjects=${scene.objects.size} triangles=${scene.objects.sumOf { it.triangleCount }} levels=${scene.levels.map { it.id }}")
        println("   gpu entities    ${scene.renderableObjectIds.size} ${byKindAndLevel(scene.objects.filter { it.hasGeometry })}")
        println("   without geometry ${scene.objects.filterNot { it.hasGeometry }.map { it.id }}")
        for (mode in VisibilityMode.entries) {
            val visible = Visibility.visibleObjectIds(scene, mode)
            val inScene = scene.objects.filter { it.id in visible && it.id in scene.renderableObjectIds }
            println(
                "   ${mode.label.padEnd(9)} visible=${visible.size} inFilamentScene=${inScene.size} " +
                    "triangles=${inScene.sumOf { it.triangleCount }} ${byKindAndLevel(inScene)}",
            )
        }
    }

    @Test
    fun `print the render trace of every shipped scene`() {
        for (scene in TestScenes.all) trace(scene)
    }
}
