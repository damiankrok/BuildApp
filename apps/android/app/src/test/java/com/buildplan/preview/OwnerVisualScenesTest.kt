package com.buildplan.preview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * BUILDPLAN-OWNER-005T: the two development houses shipped for the owner's visual review parse in the app as they
 * ship — listed first, each a real scene with walls, a roof and windows under its own object ids — read from the
 * same asset the APK carries.
 */
class OwnerVisualScenesTest {

    private val keys = listOf("jarzmianki-005t-visual", "gozdzikowce-005t-visual")

    @Test
    fun `the two owner scenes are listed first and say they are approximate`() {
        assertEquals(keys, TestScenes.index.take(2).map { it.key })
        for (entry in TestScenes.index.take(2)) assertTrue(entry.subtitle, entry.subtitle.contains("MODEL ORIENTACYJNY"))
    }

    @Test
    fun `each owner scene parses into a real house with walls, a roof and windows`() {
        val scenes = keys.map { TestScenes.scene(it) }
        for (scene in scenes) {
            val bundle = TestScenes.bundle(scene.key)
            assertTrue(scene.key, bundle.scene.meshes.isNotEmpty())
            val ids = bundle.scene.meshes.map { it.objectId }.toSet()
            assertTrue("${scene.key} roof", "roof-main" in ids)
            val kinds = bundle.scene.meshes.map { it.objectKind }.toSet()
            assertTrue("${scene.key} kinds $kinds", kinds.any { it.contains("wall", ignoreCase = true) })
            assertTrue("${scene.key} kinds $kinds", kinds.any { it.contains("window", ignoreCase = true) })
            assertEquals(ids.size, scene.objects.size)
        }
        assertNotEquals(TestScenes.bundle(keys[0]).generatedFrom.modelId, TestScenes.bundle(keys[1]).generatedFrom.modelId)
    }
}
