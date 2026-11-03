package com.buildplan.preview

import com.buildplan.preview.analyzer.LiveMark
import com.buildplan.preview.analyzer.LiveSheet
import com.buildplan.preview.analyzer.LiveSourceEvent
import com.buildplan.preview.analyzer.LiveView
import com.buildplan.preview.analyzer.local.LocalEvent
import com.buildplan.preview.ui.loadVerified
import com.buildplan.preview.ui.sha256
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * SHAPE-LIVE-01: the live source preview shows what the analyzer said and derives nothing — the sheet of the step, or
 * the last sheet marked as the last one; a picture only from the job's own folder and only when its bytes are the
 * bytes the analyzer named.
 */
class LiveSourceTest {
    private val work: File = Files.createTempDirectory("live-src").toFile()
    private val sheet = LiveSheet(assetId = "a1", url = "https://x/plan.gif", byteHash = "ab".repeat(32), width = 800, height = 600, document = "FLOOR_PLAN", file = "live/plan")
    private val mark = LiveMark(kind = "DIMENSION", status = LiveMark.READ, label = "1205")

    @Test
    fun `a source line parses into the step, its sheet and its marks`() {
        val line = """{"type":"source","event":{"seq":3,"step":"NUMBERS_READ","stage":"EXTRACTING_OBSERVATIONS","sheet":{"assetId":"a1","url":"u","byteHash":"h","width":10,"height":8,"document":"SECTION","file":"live/h"},"keepsLastSheet":false,"detail":"d","marks":[{"kind":"LEVEL","status":"ACCEPTED","box":{"x0":1,"y0":2,"x1":3,"y1":4},"label":"+3,34","elementId":"feat-level-1"}],"counts":{"images":5,"imagesRead":2,"imagesRefused":0,"ocrCandidates":40,"measurementsRead":7,"measurementsUsed":0}}}"""
        val e = LocalEvent.parse(line)
        assertTrue(e is LocalEvent.Source)
        val ev = (e as LocalEvent.Source).event
        assertEquals("NUMBERS_READ", ev.step)
        assertEquals("SECTION", ev.sheet?.document)
        assertEquals(LiveMark.ACCEPTED, ev.marks.single().status)
        assertEquals(40, ev.counts.ocrCandidates)
        assertNull(ev.counts.openingsBuilt)
    }

    @Test
    fun `a step that reads no picture keeps the last sheet, marked as not current`() {
        val reading = LiveView.next(null, LiveSourceEvent(seq = 1, step = "NUMBERS_READ", sheet = sheet, marks = listOf(mark)), work)
        assertTrue(reading.current)
        val solving = LiveView.next(reading, LiveSourceEvent(seq = 2, step = "SOLVING", sheet = null, keepsLastSheet = true), work)
        assertFalse(solving.current)
        assertEquals(sheet, solving.sheet)
        assertEquals(listOf(mark), solving.sheetMarks)
        assertEquals("SOLVING", solving.event.step)
    }

    @Test
    fun `a step that drops the sheet shows none, not a stale one`() {
        val reading = LiveView.next(null, LiveSourceEvent(seq = 1, step = "DRAWING_READ", sheet = sheet), work)
        val fetching = LiveView.next(reading, LiveSourceEvent(seq = 2, step = "FETCHING", sheet = null, keepsLastSheet = false), work)
        assertNull(fetching.sheet)
    }

    @Test
    fun `a reader beginning on the same sheet keeps its marks until it reports new ones`() {
        val read = LiveView.next(null, LiveSourceEvent(seq = 1, step = "DRAWING_READ", sheet = sheet, marks = listOf(mark)), work)
        val again = LiveView.next(read, LiveSourceEvent(seq = 2, step = "READING_NUMBERS", sheet = sheet), work)
        assertEquals(listOf(mark), again.sheetMarks)
    }

    @Test
    fun `only a file inside the job folder is ever resolved`() {
        assertNull(LiveView.resolve(work, "../../etc/passwd"))
        assertNull(LiveView.resolve(work, null))
        assertEquals(File(work, "live/abc").canonicalFile, LiveView.resolve(work, "live/abc"))
    }

    @Test
    fun `a copy whose bytes are not the ones the analyzer named is refused`() {
        val f = File(work, "live/x").apply { parentFile?.mkdirs(); writeBytes(byteArrayOf(1, 2, 3)) }
        val refused = loadVerified(f, "00".repeat(32))
        assertTrue(refused.toString(), refused.toString().contains("Refused"))
        assertTrue(loadVerified(null, sha256(byteArrayOf(1, 2, 3))).toString().contains("Refused"))
    }
}
