package com.buildplan.preview

import com.buildplan.preview.AnalyzerFixtures.CONTRACT_SHORT_RESULT
import com.buildplan.preview.AnalyzerFixtures.CONTRACT_STATUS
import com.buildplan.preview.analyzer.AnalysisStages
import com.buildplan.preview.analyzer.AnalysisSummary
import com.buildplan.preview.analyzer.AnalyzerJson
import com.buildplan.preview.analyzer.ErrorEnvelope
import com.buildplan.preview.analyzer.JobStatus
import com.buildplan.preview.analyzer.StageChecklist
import com.buildplan.preview.analyzer.StageState
import com.buildplan.preview.analyzer.SubmitResponse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The phone reads the analyzer API exactly as docs/ANALYZER_API.md writes it.
 *
 * The JSON here is the contract's own examples, pasted verbatim, so a change
 * to the contract that the app does not follow fails here and not on a phone.
 */
class AnalyzerContractTest {

    private fun status(text: String): JobStatus = AnalyzerJson.decodeFromString(JobStatus.serializer(), text)

    @Test
    fun `the contract's status record parses as written`() {
        val s = status(CONTRACT_STATUS)
        assertEquals("3f9c…", s.jobId)
        assertEquals("EXTRACTING_OBSERVATIONS", s.status)
        assertEquals(0.31, s.progress, 0.0)
        val stage = s.stage!!
        assertEquals("EXTRACTING_OBSERVATIONS", stage.id)
        assertEquals("Reading the drawings", stage.label)
        assertEquals(2, stage.index)
        assertEquals(9, stage.count)
        assertEquals(0.4, stage.fraction, 0.0)
        assertEquals("drawing 9 of 20", stage.detail)
        assertEquals(4, s.stages.size)
        assertEquals(listOf("DONE", "DONE", "RUNNING", "PENDING"), s.stages.map { it.state })
        assertEquals("Fetching the project page and its drawings", s.stages[0].label)
        assertNull(s.stages[2].completedAt)
        assertEquals("https://www.archon.pl/…", s.sourceUrl)
        assertNull(s.completedAt)
        assertNull(s.error)
        assertNull(s.result)
        assertEquals("/v1/analyses/3f9c…", s.links["self"])
        assertFalse(s.isTerminal)
    }

    @Test
    fun `a completed status carries the short result`() {
        val text = """{ "jobId": "3f9c…", "status": "COMPLETED", "progress": 1, "stage": null, "stages": [], $CONTRACT_SHORT_RESULT,
            "links": { "self": "/v1/analyses/3f9c…", "result": "/v1/analyses/3f9c…/result", "scene": "/v1/analyses/3f9c…/scene",
                       "model": "/v1/analyses/3f9c…/model", "candidate": "/v1/analyses/3f9c…/candidate" } }"""
        val s = status(text)
        assertTrue(s.isTerminal)
        val r = s.result!!
        assertEquals("Dom w marcówkach (GE)", r.title)
        assertEquals("Dom w marcówkach (GE) (analysis)", r.label)
        assertEquals(3456789L, r.sceneBytes)
        assertEquals(12, r.quality.l0)
        assertEquals(30, r.quality.l1)
        assertEquals(18, r.quality.l2)
        assertEquals(2, r.unresolved)
        assertEquals(3, r.warnings)
        assertEquals("DETERMINISTIC_ONLY", r.vision)
        assertEquals("/v1/analyses/3f9c…/scene", s.links["scene"])
    }

    @Test
    fun `a failed status carries the service's code and sentence`() {
        val s = status(
            AnalyzerFixtures.status(
                AnalysisStages.FAILED, 0.14, running = 1,
                error = """{"code":"NO_DRAWINGS","message":"the page exposes no drawing this analyzer reads"}""",
            ),
        )
        assertEquals("NO_DRAWINGS", s.error!!.code)
        assertEquals("the page exposes no drawing this analyzer reads", s.error!!.message)
        assertTrue(s.isTerminal)
    }

    @Test
    fun `the submit answer and the error envelope parse as written`() {
        val submitted = AnalyzerJson.decodeFromString(
            SubmitResponse.serializer(),
            """{ "jobId": "3f9c…", "status": "QUEUED", "links": { "self": "/v1/analyses/3f9c…" } }""",
        )
        assertEquals("3f9c…", submitted.jobId)
        assertEquals("QUEUED", submitted.status)
        val envelope = AnalyzerJson.decodeFromString(
            ErrorEnvelope.serializer(),
            """{"error": {"code": "QUEUE_FULL", "message": "The analyzer is busy."}}""",
        )
        assertEquals("QUEUE_FULL", envelope.error!!.code)
        assertEquals("The analyzer is busy.", envelope.error!!.message)
    }

    @Test
    fun `the full result summary parses with every hash, count, level and diagnostic`() {
        val s = AnalyzerJson.decodeFromString(AnalysisSummary.serializer(), AnalyzerFixtures.summary())
        assertEquals(AnalysisSummary.SCHEMA, s.schema)
        assertEquals(AnalyzerFixtures.JOB, s.jobId)
        assertEquals("a".repeat(64), s.sourcePackageHash)
        assertEquals("b".repeat(64), s.observationGraphHash)
        assertEquals("e".repeat(64), s.metricEvidenceHash)
        assertEquals(AnalyzerFixtures.CANDIDATE, s.candidateHash)
        assertEquals(AnalyzerFixtures.MODEL, s.modelHash)
        assertEquals("f".repeat(64), s.modelSha256)
        assertEquals(AnalyzerFixtures.sceneSha256, s.sceneSha256)
        assertEquals(AnalyzerFixtures.sceneContentHash, s.sceneContentHash)
        assertEquals(20, s.counts.assets)
        assertEquals(9, s.counts.assetsByDocument["RENDER"])
        assertEquals(2332, s.counts.triangles)
        assertEquals(12, s.quality.levels.l0)
        assertEquals(30, s.quality.levels.l1)
        assertEquals(18, s.quality.levels.l2)
        assertEquals(18, s.quality.byFamily["OPENING"]!!["L2"])
        assertEquals(2, s.unresolved.size)
        assertEquals("rear roof overhang", s.unresolved[0].what)
        assertEquals("no section shows it", s.unresolved[0].reason)
        assertEquals(3, s.warnings.size)
        assertEquals("DETERMINISTIC_ONLY", s.vision.mode)
        assertNull(s.vision.provider)
        assertEquals("BYTE_IDENTICAL", s.verification.replay)
        assertEquals(2, s.verification.residualsOutsideTolerance)
        assertEquals(1, s.verification.closure.exteriorErrors)
        assertEquals("2.0.0", s.analyzer.solver)
        assertEquals("/v1/analyses/${AnalyzerFixtures.JOB}/scene", s.links["scene"])
    }

    @Test
    fun `members the app does not know, or nulls where it expects values, never break a read`() {
        val s = status(
            """{"jobId":"x","status":"QUEUED","progress":null,"stage":null,"stages":null,"newMember":{"a":[1,2]},"error":null}""",
        )
        assertEquals("QUEUED", s.status)
        assertEquals(0.0, s.progress, 0.0)
        assertTrue(s.stages.isEmpty())
    }

    // -----------------------------------------------------------------------
    // The stage checklist
    // -----------------------------------------------------------------------

    @Test
    fun `the checklist always has the nine stages in pipeline order`() {
        val rows = StageChecklist.rows(status(CONTRACT_STATUS))
        assertEquals(AnalysisStages.PIPELINE, rows.map { it.id })
        assertEquals(
            listOf(StageState.DONE, StageState.DONE, StageState.RUNNING) + List(6) { StageState.PENDING },
            rows.map { it.state },
        )
    }

    @Test
    fun `the checklist shows the server's labels, and fills only what the server did not describe`() {
        val rows = StageChecklist.rows(status(CONTRACT_STATUS))
        assertEquals("Fetching the project page and its drawings", rows[0].label)
        // The contract's example abbreviates this label to "…"; the app shows what it was sent.
        assertEquals("…", rows[1].label)
        // SOLVING_TOPOLOGY is not in the abbreviated example at all: the built-in wording fills in.
        assertEquals(AnalysisStages.DEFAULT_LABELS["SOLVING_TOPOLOGY"], rows[4].label)
    }

    @Test
    fun `before the first answer, and while queued, every stage is pending`() {
        assertTrue(StageChecklist.rows(null).all { it.state == StageState.PENDING })
        assertEquals(9, StageChecklist.rows(null).size)
        val queued = status(AnalyzerFixtures.status(AnalysisStages.QUEUED, 0.0))
        assertTrue(StageChecklist.rows(queued).all { it.state == StageState.PENDING })
    }

    @Test
    fun `failed, cancelled and unknown stage states map, and an unknown stage is kept`() {
        val s = status(
            """{"jobId":"x","status":"FAILED","stages":[
                {"id":"ACQUIRING_SOURCE","label":"A","state":"DONE"},
                {"id":"CLASSIFYING_SOURCES","label":"B","state":"FAILED"},
                {"id":"EXTRACTING_OBSERVATIONS","label":"C","state":"CANCELLED"},
                {"id":"REGISTERING_VIEWS","label":"D","state":"SOMETHING_NEW"},
                {"id":"A_FUTURE_STAGE","label":"Something newer","state":"RUNNING"}]}""",
        )
        val rows = StageChecklist.rows(s)
        assertEquals(StageState.FAILED, rows[1].state)
        assertEquals(StageState.CANCELLED, rows[2].state)
        assertEquals(StageState.PENDING, rows[3].state)
        assertEquals(10, rows.size)
        assertEquals("A_FUTURE_STAGE", rows.last().id)
        assertEquals("Something newer", rows.last().label)
        assertEquals(StageState.RUNNING, rows.last().state)
    }

    @Test
    fun `a completed job shows every stage done`() {
        val s = status(AnalyzerFixtures.status(AnalysisStages.COMPLETED, 1.0))
        assertTrue(StageChecklist.rows(s).all { it.state == StageState.DONE })
    }
}
