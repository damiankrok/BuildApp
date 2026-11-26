package com.buildplan.preview

import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import com.buildplan.preview.ui.wordsRes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * MARCOWKI-UI (audit round 2): the row at the foot says what the layers hide, read from what the filter removed —
 * never from the mode's name. On the showcase "Tylko parter" keeps the garage's roof, which stands on the ground storey
 * (the cutaway is the mode that takes every roof off: VisibilityTest), so it must not say the roof is gone.
 */
class HiddenLayersWordsTest {

    private val showcase = TestScenes.scene("marcowki-c-v35414")

    @Test
    fun `the showcase's layers are named by what they actually hide`() {
        val ground = Visibility.hidden(showcase, VisibilityMode.GROUND_ONLY)
        assertTrue("the ground storey keeps some roof (the garage's)", ground.roofKept)
        assertTrue(ground.upperHidden && ground.roofHidden)
        assertEquals(R.string.layer_hidden_upper, ground.wordsRes())

        val cutaway = Visibility.hidden(showcase, VisibilityMode.CUTAWAY)
        assertFalse("a cutaway keeps no roof", cutaway.roofKept)
        assertEquals(R.string.layer_hidden_roof_upper, cutaway.wordsRes())

        val upper = Visibility.hidden(showcase, VisibilityMode.UPPER_ONLY)
        assertEquals(R.string.layer_hidden_roof_ground, upper.wordsRes())

        val roofOff = Visibility.hidden(showcase, VisibilityMode.ROOF_OFF)
        assertFalse(roofOff.upperHidden || roofOff.groundHidden)
        assertTrue("the showcase has roof windows, and they go with the roof", roofOff.roofWindowsHidden)
        assertEquals(R.string.layer_hidden_roof, roofOff.wordsRes())

        assertEquals(R.string.layer_hidden_none, Visibility.hidden(showcase, VisibilityMode.ALL).wordsRes())
    }

    @Test
    fun `the words follow the filter on every shipped reference scene`() {
        for (scene in listOf(TestScenes.marcowki, TestScenes.demo, TestScenes.autoCandidate)) {
            for (mode in Visibility.availableModes(scene)) {
                val h = Visibility.hidden(scene, mode)
                val shown = Visibility.visibleObjectIds(scene, mode)
                assertEquals("${scene.key} $mode: roof kept", scene.objects.any { it.kind in Visibility.ROOF_KINDS && it.id in shown }, h.roofKept)
                assertEquals("${scene.key} $mode: roof hidden", scene.objects.any { it.kind in Visibility.ROOF_KINDS && it.id !in shown }, h.roofHidden)
                if (mode == VisibilityMode.ALL) assertEquals(R.string.layer_hidden_none, h.wordsRes())
            }
        }
    }
}
