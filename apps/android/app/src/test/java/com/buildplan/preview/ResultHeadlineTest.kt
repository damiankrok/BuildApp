package com.buildplan.preview

import com.buildplan.preview.analyzer.AnalysisSummary
import com.buildplan.preview.scene.ModelCompleteness
import com.buildplan.preview.scene.PartialPreview
import com.buildplan.preview.scene.PreviewOutcome
import com.buildplan.preview.scene.ProvisionalValue
import com.buildplan.preview.scene.UnexplainedWalls
import com.buildplan.preview.ui.ResultHeadline
import com.buildplan.preview.ui.headlineText
import com.buildplan.preview.ui.outcomeHeadline
import com.buildplan.preview.ui.resultHeadline
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** N7-FIX-04 follow-up: the completeness verdict reaches every result that carries one, and its headline. */
class ResultHeadlineTest {
    private fun summary(verdict: String?, warnings: List<String> = emptyList()) = AnalysisSummary(
        warnings = warnings,
        preview = PreviewOutcome(completeness = verdict?.let { ModelCompleteness(verdict = it) }),
    )

    @Test
    fun `a whole model with open questions is shown with its completeness and never headed as plainly ready`() {
        val s = summary(ModelCompleteness.COMPLETE_WITH_OPEN_QUESTIONS)
        assertEquals(ResultHeadline.OPEN_QUESTIONS, resultHeadline(s))
        assertTrue(s.preview.hasDetails)
        assertFalse(s.preview.isPartial)
        assertTrue(s.preview.provisional.isEmpty())
    }

    @Test
    fun `a COMPLETE verdict without anything provisional still shows the completeness section`() {
        val s = summary(ModelCompleteness.COMPLETE)
        assertEquals(ResultHeadline.READY, resultHeadline(s))
        assertTrue(s.preview.hasDetails)
    }

    @Test
    fun `an older analyzer without completeness and without provisional values shows no details`() {
        val s = summary(null)
        assertEquals(ResultHeadline.READY, resultHeadline(s))
        assertFalse(s.preview.hasDetails)
        assertTrue(PreviewOutcome(provisional = listOf(ProvisionalValue())).hasDetails)
    }

    @Test
    fun `limiting warnings outrank open questions, and a PARTIAL verdict on a whole model is at least limited`() {
        assertEquals(ResultHeadline.LIMITED, resultHeadline(summary(ModelCompleteness.COMPLETE_WITH_OPEN_QUESTIONS, warnings = listOf("x"))))
        assertEquals(ResultHeadline.LIMITED, resultHeadline(summary(ModelCompleteness.PARTIAL)))
    }

    @Test
    fun `a record from before the band and the unexplained length were kept apart has no band length`() {
        val json = Json { ignoreUnknownKeys = true }
        val old = json.decodeFromString(UnexplainedWalls.serializer(), """{"count":1,"lengthM":9.453752}""")
        assertNull(old.bandLengthM)
        val now = json.decodeFromString(UnexplainedWalls.serializer(), """{"count":1,"lengthM":1.794087,"bandLengthM":9.453752}""")
        assertEquals(1.794087, now.lengthM, 0.0)
        assertEquals(9.453752, now.bandLengthM ?: 0.0, 0.0)
    }

    @Test
    fun `the source sheet shows completeness on the same condition and heads it by the record's own verdict`() {
        val open = PreviewOutcome(completeness = ModelCompleteness(verdict = ModelCompleteness.COMPLETE_WITH_OPEN_QUESTIONS))
        assertTrue(open.hasDetails)
        assertEquals(ResultHeadline.OPEN_QUESTIONS, outcomeHeadline(open))
        assertEquals(R.string.analyzer_result_open_questions, headlineText(outcomeHeadline(open)))
        val complete = PreviewOutcome(completeness = ModelCompleteness(verdict = ModelCompleteness.COMPLETE))
        assertTrue(complete.hasDetails)
        assertEquals(R.string.analyzer_result_ready, headlineText(outcomeHeadline(complete)))
        // a model with questions is never said partial; only a partial record is
        assertFalse(outcomeHeadline(open) == ResultHeadline.PARTIAL)
        val partial = PreviewOutcome(outcome = PreviewOutcome.PARTIAL_3D_PREVIEW, partial = PartialPreview(), completeness = ModelCompleteness(verdict = ModelCompleteness.PARTIAL))
        assertEquals(R.string.analyzer_result_partial, headlineText(outcomeHeadline(partial)))
        assertEquals(ResultHeadline.LIMITED, outcomeHeadline(PreviewOutcome(completeness = ModelCompleteness(verdict = ModelCompleteness.PARTIAL))))
    }

    @Test
    fun `a stored record without completeness keeps its old behaviour on the sheet`() {
        assertFalse(PreviewOutcome().hasDetails)
        assertNull(outcomeHeadline(PreviewOutcome()))
        val provisionalOnly = PreviewOutcome(provisional = listOf(ProvisionalValue("ROOF_PITCH", "assumed")))
        assertTrue(provisionalOnly.hasDetails)
        assertEquals(R.string.house_model_outcome, headlineText(outcomeHeadline(provisionalOnly)))
        val oldPartial = PreviewOutcome(outcome = PreviewOutcome.PARTIAL_3D_PREVIEW, partial = PartialPreview())
        assertEquals(R.string.analyzer_result_partial, headlineText(outcomeHeadline(oldPartial)))
    }
}
