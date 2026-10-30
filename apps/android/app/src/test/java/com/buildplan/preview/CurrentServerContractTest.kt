package com.buildplan.preview

import com.buildplan.preview.FakeTransport.Companion.bytes
import com.buildplan.preview.FakeTransport.Companion.json
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalysisTracker
import com.buildplan.preview.analyzer.AnalyzerClient
import com.buildplan.preview.analyzer.ModelAssessment
import com.buildplan.preview.analyzer.Step
import com.buildplan.preview.scene.BundledScenes
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.SceneLoadResult
import com.buildplan.preview.scene.SceneRepository
import com.buildplan.preview.ui.ResultHeadline
import com.buildplan.preview.ui.resultHeadline
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * N9-01: the phone against what TODAY's analyzer service says (`src/test/resources/analyzer-contract-current/`,
 * captured by `apps/analyzer-api/scripts/capture-android-contract.ts` and reviewed). [RealServerContractTest] keeps
 * running the same job on the legacy answers (solver 2.3.0), so the parser reads both an older and the current server.
 */
class CurrentServerContractTest {

    private fun resource(name: String): ByteArray =
        requireNotNull(javaClass.classLoader?.getResourceAsStream("analyzer-contract-current/$name")) { "missing test resource $name" }.use { it.readBytes() }

    private fun text(name: String) = resource(name).decodeToString()

    private val base = "https://analyzer.example.test"
    private val job = "0123456789abcdef0123456789abcdef"
    private val project = "https://drawings.synthetic-publisher.test/projects/larchfield-lf01"
    private val statusUrl = "$base/v1/analyses/$job"

    @Test
    fun `today's job, from the server's own bytes, ends as a stored and openable model with its three assessment axes`() {
        val transport = FakeTransport()
        transport.on("POST", "$base/v1/analyses", json(202, text("submitted.json")))
        transport.on("GET", statusUrl, json(200, text("status-running.json")), json(200, text("status-completed.json")))
        transport.on("GET", "$statusUrl/result", json(200, text("result.json")))
        val sceneHeader = Regex("\"sceneSha256Header\": \"([0-9a-f]{64})\"").find(text("meta.json"))!!.groupValues[1]
        transport.on("GET", "$statusUrl/scene", bytes(200, resource("scene.json"), mapOf("X-Content-SHA256" to sceneHeader)))

        val dir = AnalyzerFixtures.tempDir("current-contract")
        val store = DownloadedScenes(dir)
        val tracker = AnalysisTracker(AnalyzerClient(base, transport), store)
        var state: AnalysisState = tracker.submit(project)
        val steps = mutableListOf<Step>()
        repeat(20) {
            val step = tracker.step(state)
            steps += step
            state = step.state
            if (step.delayMs == null) return@repeat
        }
        val completed = steps.last().state as AnalysisState.Completed
        assertNull(steps.last().delayMs)
        assertEquals(sceneHeader, completed.entry.sceneSha256)

        val summary = completed.summary
        assertEquals("1.4.0", summary.analyzer.service)
        // the older members are all still read
        assertTrue(summary.warningDetails.isNotEmpty())
        assertNotNull(summary.preview.completeness)
        // the new member: three axes, apart
        val a = requireNotNull(summary.assessment) { "the current server sends an assessment" }
        assertEquals("buildapp.model-assessment", a.schema)
        assertEquals(ModelAssessment.VALID, a.technicalValidity.status)
        assertEquals(listOf("PROGRAM_REFUSALS", "MODEL_VALIDATION", "COMPILER", "CLOSURE", "REPLAY"), a.technicalValidity.checks.map { it.check })
        assertEquals(summary.preview.completeness?.verdict, a.decompositionCompleteness.verdict)
        assertEquals(listOf("R1_ROOF_LAYERS", "R3_WALL_INK", "R4_STOREY_OUTLINE", "R5_REGISTERED_ELEVATIONS"), a.sourceFidelity.relations.map { it.id })
        assertTrue(a.sourceFidelity.relations.all { it.status in setOf(ModelAssessment.PASS, ModelAssessment.CONFLICT, ModelAssessment.UNCHECKED) })
        assertTrue(a.sourceUnchecked.counts.total == a.sourceUnchecked.items.size)
        assertTrue(a.previewAvailable)
        // N9-02A: the elevations' four-axis registration, counted before and after
        val e = requireNotNull(a.elevationRegistration) { "the current server sends the elevation registration" }
        val after = e.counts.after
        assertEquals(after.full + after.alongOnly + after.verticalOnly + after.unregistered, e.counts.before.full + e.counts.before.alongOnly + e.counts.before.verticalOnly + e.counts.before.unregistered)
        assertTrue(a.sourceUnchecked.items.filter { it.kind == "ELEVATION" }.all { it.registration != null })
        // what no relation compared is not agreement: the headline does not say "ready" on an UNCHECKED fidelity
        if (a.sourceFidelity.status != ModelAssessment.PASS) assertTrue(resultHeadline(summary) != ResultHeadline.READY)

        // and the model is stored and opens, whatever the assessment says
        val repository = SceneRepository(BundledScenes { TestScenes.text(it) }, store)
        val loaded = repository.load(repository.entries().last()) as SceneLoadResult.Ok
        assertTrue(loaded.scene.bundle.scene.meshes.isNotEmpty())
    }
}
