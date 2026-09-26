package com.buildplan.preview.analyzer.local

import com.buildplan.preview.analyzer.LocalRunReport
import java.io.File
import java.io.IOException
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.SecureRandom
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/** One analysis on this phone: its id, its link, and its private folders. */
data class LocalJob(
    val jobId: String,
    val sourceUrl: String,
    /** `files/local-analyzer/jobs/<jobId>`: everything the job writes, removed when it ends. */
    val dir: File,
    /** Scratch: the fetched source bytes live under `work/bytes` while the analyzer runs. */
    val workDir: File,
    /** The four result files the analyzer writes when it finishes. */
    val outDir: File,
    val startedAtMs: Long,
)

/** A job the app was running when it last stopped. It did not finish: nothing of it was kept. */
data class InterruptedJob(val jobId: String, val sourceUrl: String, val startedAtMs: Long)

/**
 * Where local analyses live while they run, in the app's private storage
 * (`filesDir/local-analyzer`), and the record that survives the app.
 *
 *  - Each job gets `jobs/<jobId>/work` (the byte cache of the sources it
 *    fetches) and `jobs/<jobId>/out` (its result files). The whole folder is
 *    removed when the job ends — completed, failed, cancelled or stopped — so
 *    no source image and no partial result outlives the job; a completed
 *    scene has by then been verified and moved into the analyses store.
 *  - `active-job.json` names the job that is running. It is written before
 *    the analyzer starts and removed after the folder is: if the app is killed
 *    in between, the next start finds it, reports the job as INTERRUPTED (never
 *    as finished) and removes whatever the job left.
 *  - `runs.json` keeps the reports of the last [MAX_RUNS] runs, whatever their
 *    outcome, so the time and memory an analysis took can still be read after
 *    the screen that showed them is gone.
 */
class LocalJobs(
    val root: File,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newId: () -> String = ::randomJobId,
) {
    val jobsDir: File = File(root, "jobs")
    private val journal = File(root, ACTIVE_JOB)
    private val runLog = File(root, RUN_LOG)
    private val lock = Any()

    /** Create the folders and the journal for a new job. */
    fun create(sourceUrl: String): LocalJob = synchronized(lock) {
        val jobId = newId()
        require(JOB_ID.matches(jobId)) { "a job id is 32 lowercase hex characters" }
        val dir = File(jobsDir, jobId)
        val job = LocalJob(jobId, sourceUrl, dir, File(dir, "work"), File(dir, "out"), clock())
        if (!job.workDir.mkdirs() || !job.outDir.mkdirs()) throw IOException("cannot create the job folder in the app storage")
        writeAtomically(journal, JSON.encodeToString(Journal.serializer(), Journal(jobId, sourceUrl, job.startedAtMs)).encodeToByteArray())
        job
    }

    /** The job ended, however it ended: remove its folder, then its journal. True when nothing of it is left. */
    fun finish(job: LocalJob): Boolean = synchronized(lock) {
        job.dir.deleteRecursively()
        val gone = !job.dir.exists()
        if (gone && readJournal()?.jobId == job.jobId) journal.delete()
        gone
    }

    /**
     * Called when the app starts, before any job: a journal left behind names
     * a job that was running when the app stopped. It is reported as
     * interrupted, and every job folder is removed.
     */
    fun recoverInterrupted(): InterruptedJob? = synchronized(lock) {
        val left = readJournal()
        jobsDir.deleteRecursively()
        journal.delete()
        left?.let { InterruptedJob(it.jobId, it.sourceUrl, it.startedAtMs) }
    }

    /** Bytes currently held in job folders: zero whenever no job runs. */
    fun scratchBytes(): Long = if (!jobsDir.exists()) 0 else jobsDir.walkBottomUp().filter { it.isFile }.sumOf { it.length() }

    /** Record a finished run's report (newest first, at most [MAX_RUNS]). A failure to record changes nothing else. */
    fun record(report: LocalRunReport) {
        synchronized(lock) {
            try {
                val runs = (listOf(report) + runs().filter { it.jobId != report.jobId }).take(MAX_RUNS)
                root.mkdirs()
                writeAtomically(runLog, JSON.encodeToString(ListSerializer(LocalRunReport.serializer()), runs).encodeToByteArray())
            } catch (e: Exception) {
                // the log is a convenience
            }
        }
    }

    fun runs(): List<LocalRunReport> = synchronized(lock) {
        if (!runLog.isFile) return emptyList()
        try {
            JSON.decodeFromString(ListSerializer(LocalRunReport.serializer()), runLog.readText())
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun readJournal(): Journal? = try {
        if (journal.isFile) JSON.decodeFromString(Journal.serializer(), journal.readText()).takeIf { JOB_ID.matches(it.jobId) } else null
    } catch (e: Exception) {
        null
    }

    private fun writeAtomically(target: File, bytes: ByteArray) {
        target.parentFile?.mkdirs()
        val temp = File(target.parentFile, ".${target.name}.${System.nanoTime()}.tmp")
        try {
            temp.outputStream().use { out ->
                out.write(bytes)
                out.fd.sync()
            }
            try {
                Files.move(temp.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } catch (e: AtomicMoveNotSupportedException) {
                throw IOException("this storage cannot rename files atomically", e)
            }
        } finally {
            if (temp.exists()) temp.delete()
        }
    }

    @Serializable
    private data class Journal(val jobId: String = "", val sourceUrl: String = "", val startedAtMs: Long = 0)

    companion object {
        const val ACTIVE_JOB = "active-job.json"
        const val RUN_LOG = "runs.json"
        const val MAX_RUNS = 10
        val JOB_ID = Regex("^[0-9a-f]{32}$")
        private val JSON = Json { ignoreUnknownKeys = true; coerceInputValues = true; encodeDefaults = true }
        private val RANDOM = SecureRandom()

        fun randomJobId(): String {
            val bytes = ByteArray(16)
            RANDOM.nextBytes(bytes)
            return bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
        }
    }
}
