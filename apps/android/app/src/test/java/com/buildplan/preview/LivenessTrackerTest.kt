package com.buildplan.preview

import com.buildplan.preview.analyzer.JobActivity
import com.buildplan.preview.analyzer.JobStatus
import com.buildplan.preview.analyzer.Liveness
import com.buildplan.preview.analyzer.LivenessTracker
import com.buildplan.preview.analyzer.local.LocalEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * BUILDPLAN-ANALYZER-005A: slow is not stuck. The phone tells a heavy step (the
 * analyzer is alive and crossing loop boundaries, its counts frozen) from an
 * analyzer that stopped answering, on its own clock, from what it received.
 */
class LivenessTrackerTest {
    private fun status(seq: Long, done: Long = 3, rings: Long = 10, activity: String = "COMPUTE", ageMs: Long? = null) = JobStatus(
        status = "EXTRACTING_OBSERVATIONS",
        progress = 0.7,
        activity = JobActivity(
            phaseId = "METRIC_FRAMES",
            subphaseId = "CALLOUT_RINGS",
            activity = activity,
            workDone = done,
            workTotal = 10,
            unit = "FRAME",
            assetIndex = done.toInt() + 1,
            assetTotal = 10,
            heartbeatSeq = seq,
            phaseElapsedMs = 2_000,
            diagnosticCounters = mapOf("rings" to rings, "ringsTotal" to 150),
            heartbeatAgeMs = ageMs,
        ),
    )

    @Test
    fun `counts that move are healthy`() {
        val t = LivenessTracker()
        for (i in 0..60) t.observe(status(seq = i.toLong(), rings = i.toLong()), now = i * 1_000L)
        assertEquals(Liveness.Healthy, t.verdict(60_000))
    }

    @Test
    fun `heartbeats with frozen counts for 30 s are a heavy step, not a stall`() {
        val t = LivenessTracker()
        for (i in 0..40) t.observe(status(seq = i.toLong()), now = i * 1_000L)
        assertEquals(Liveness.Healthy, t.verdict(29_000))
        assertTrue(t.verdict(40_000) is Liveness.HeavyStep)
    }

    @Test
    fun `no heartbeat for 45 s is no response, counted from the last heartbeat`() {
        val t = LivenessTracker()
        t.observe(status(seq = 1), now = 0)
        // the screen keeps receiving the same record (a repeat is not a heartbeat)
        for (i in 1..50) t.observe(status(seq = 1), now = i * 1_000L)
        assertTrue(t.verdict(44_000) !is Liveness.NoResponse)
        val v = t.verdict(50_000)
        assertTrue(v is Liveness.NoResponse)
        assertEquals(50_000L, (v as Liveness.NoResponse).silentForMs)
    }

    @Test
    fun `waiting on the network says so, sooner than a heavy step`() {
        val t = LivenessTracker()
        for (i in 0..20) t.observe(status(seq = i.toLong(), activity = "IO_WAIT"), now = i * 1_000L)
        assertTrue(t.verdict(20_000) is Liveness.Waiting)
    }

    @Test
    fun `a service's own heartbeat age counts, so a stale record is not mistaken for a live one`() {
        val t = LivenessTracker()
        t.observe(status(seq = 7, ageMs = 40_000), now = 100_000)
        assertTrue(t.verdict(106_000) is Liveness.NoResponse)
    }

    @Test
    fun `an analyzer that sends no activity gets no verdict`() {
        val t = LivenessTracker()
        t.observe(JobStatus(status = "EXTRACTING_OBSERVATIONS", progress = 0.63), now = 0)
        assertEquals(Liveness.Healthy, t.verdict(600_000))
    }

    @Test
    fun `the step's time is the analyzer's count at the last event plus the time since`() {
        val t = LivenessTracker()
        t.observe(status(seq = 1), now = 10_000)
        assertEquals(7_000L, t.stepElapsedMs(15_000))
    }

    @Test
    fun `a service's step time counts from its heartbeat, not from the poll`() {
        val t = LivenessTracker()
        t.observe(status(seq = 1, ageMs = 3_000), now = 10_000)
        assertEquals(5_000L, t.stepElapsedMs(10_000))
    }

    @Test
    fun `a telemetry line parses into activity, and an unknown member changes nothing`() {
        val line = """{"type":"telemetry","rssBytes":123,"event":{"kind":"HEARTBEAT","stage":"EXTRACTING_OBSERVATIONS","phaseId":"METRIC_FRAMES","phaseLabel":"reading printed dimensions and callouts","subphaseId":"OCR","activity":"COMPUTE","workDone":2,"workTotal":10,"unit":"FRAME","assetIndex":3,"assetTotal":10,"heartbeatSeq":41,"elapsedMs":90000,"phaseElapsedMs":12000,"timestamp":"2026-09-29T12:00:00Z","diagnosticCounters":{"tokenGroups":5,"tokenGroupsTotal":50},"overall":0.7,"somethingNew":true}}"""
        val event = LocalEvent.parse(line) as LocalEvent.Telemetry
        assertEquals("METRIC_FRAMES", event.activity.phaseId)
        assertEquals(3, event.activity.assetIndex)
        assertEquals(41L, event.activity.heartbeatSeq)
        assertEquals(5L, event.activity.diagnosticCounters["tokenGroups"])
        assertEquals(123L, event.rssBytes)
        assertTrue(!event.isTerminal)
    }
}
