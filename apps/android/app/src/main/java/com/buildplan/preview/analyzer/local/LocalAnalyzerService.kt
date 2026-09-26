package com.buildplan.preview.analyzer.local

import android.app.Service
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.ParcelFileDescriptor
import android.os.Process
import android.os.RemoteException
import android.util.Log
import java.io.IOException
import java.io.OutputStream

/**
 * The process the local analyzer runs in (`android:process=":analyzer"`,
 * not exported: only this app can bind it).
 *
 * Why a process of its own:
 *
 *  - the analyzer computes for minutes; in its own process it can never stall
 *    the viewer, and a run that exhausts memory ends this process, not the app;
 *  - Node starts once per process and cannot be stopped from outside, so the
 *    one reliable stop — for a cancel, for a job whose owner went away — is to
 *    end the process; the app does that, and every job gets a fresh one;
 *  - its memory is its own, so the peak the kernel reports is the analyzer's.
 *
 * What it does: on [MSG_START] it creates two pipes, starts Node on a thread
 * with a large stack running the program the message names, forwards every
 * event line the program writes as [MSG_EVENT], and reports [MSG_EXITED] when
 * Node returns. [MSG_CANCEL] writes `cancel` to the program's control pipe.
 * When the app unbinds, the process ends — whatever Node is doing.
 */
class LocalAnalyzerService : Service() {

    private lateinit var messenger: Messenger

    @Volatile
    private var control: OutputStream? = null

    override fun onCreate() {
        super.onCreate()
        messenger = Messenger(Handler(Looper.getMainLooper()) { message -> handle(message); true })
    }

    override fun onBind(intent: Intent?): IBinder = messenger.binder

    override fun onUnbind(intent: Intent?): Boolean {
        // The app let go of the job (it ended, it was cancelled, or the app itself is gone).
        endProcess()
        return false
    }

    override fun onDestroy() {
        super.onDestroy()
        endProcess()
    }

    private fun handle(message: Message) {
        when (message.what) {
            MSG_START -> start(message.data, message.replyTo)
            MSG_CANCEL -> requestCancel()
        }
    }

    private fun start(data: Bundle, client: Messenger?) {
        if (client == null) return
        if (NodeRuntime.hasRun) {
            reply(client, MSG_START_FAILED) { putString(KEY_CODE, "RUNTIME_REUSED"); putString(KEY_MESSAGE, "the analyzer process was still finishing the previous job") }
            endProcess()
            return
        }
        NodeRuntime.load()?.let { reason ->
            reply(client, MSG_START_FAILED) { putString(KEY_CODE, "RUNTIME_UNAVAILABLE"); putString(KEY_MESSAGE, reason) }
            return
        }
        val program = data.getString(KEY_PROGRAM)
        val arguments = data.getStringArrayList(KEY_ARGUMENTS)
        val environment = data.getStringArrayList(KEY_ENVIRONMENT) ?: arrayListOf()
        if (program.isNullOrBlank() || arguments == null) {
            reply(client, MSG_START_FAILED) { putString(KEY_CODE, "RUNTIME_PROTOCOL"); putString(KEY_MESSAGE, "the start request was incomplete") }
            return
        }

        val events: Array<ParcelFileDescriptor>
        val controlPipe: Array<ParcelFileDescriptor>
        try {
            events = ParcelFileDescriptor.createPipe()
            controlPipe = ParcelFileDescriptor.createPipe()
        } catch (e: IOException) {
            reply(client, MSG_START_FAILED) { putString(KEY_CODE, "RUNTIME_UNAVAILABLE"); putString(KEY_MESSAGE, "the analyzer's pipes could not be created") }
            return
        }
        control = ParcelFileDescriptor.AutoCloseOutputStream(controlPipe[1])
        // The program writes to this descriptor; this process closes it once Node has returned.
        val eventsWriteFd = events[1].detachFd()
        // The program owns this one: it reads cancel requests from it and closes it.
        val controlReadFd = controlPipe[0].detachFd()
        val argv = listOf("node", program) + arguments + listOf("--events-fd", eventsWriteFd.toString(), "--control-fd", controlReadFd.toString())

        reply(client, MSG_STARTED) { putInt(KEY_PID, Process.myPid()) }

        val reader = Thread({
            try {
                ParcelFileDescriptor.AutoCloseInputStream(events[0]).bufferedReader(Charsets.UTF_8).useLines { lines ->
                    for (line in lines) if (line.isNotBlank()) reply(client, MSG_EVENT) { putString(KEY_LINE, line) }
                }
            } catch (e: IOException) {
                Log.w(TAG, "event pipe closed: ${e.message}")
            }
        }, "local-analyzer-events")
        reader.start()

        Thread(null, {
            val code = try {
                NodeRuntime.runOnce(argv, environment)
            } catch (t: Throwable) {
                Log.e(TAG, "the runtime did not start", t)
                -1
            }
            // End of the event stream: the reader drains what is left and stops.
            try {
                ParcelFileDescriptor.adoptFd(eventsWriteFd).close()
            } catch (e: IOException) {
                Log.w(TAG, "closing the event pipe: ${e.message}")
            }
            reader.join()
            reply(client, MSG_EXITED) { putInt(KEY_EXIT_CODE, code) }
        }, "local-analyzer-node", NODE_THREAD_STACK_BYTES).start()
    }

    private fun requestCancel() {
        val out = control ?: return
        Thread({
            try {
                out.write("cancel\n".toByteArray())
                out.flush()
            } catch (e: IOException) {
                // the program has already closed its end: it is finishing anyway
            }
        }, "local-analyzer-cancel").start()
    }

    private fun reply(client: Messenger, what: Int, fill: Bundle.() -> Unit) {
        val message = Message.obtain(null, what)
        message.data = Bundle().apply(fill)
        try {
            client.send(message)
        } catch (e: RemoteException) {
            // The app is gone. Nothing is left to report to, and nothing to finish for.
            endProcess()
        }
    }

    private fun endProcess() {
        Process.killProcess(Process.myPid())
    }

    companion object {
        private const val TAG = "BuildAppLocalAnalyzer"

        const val MSG_START = 1
        const val MSG_CANCEL = 2
        const val MSG_STARTED = 10
        const val MSG_EVENT = 11
        const val MSG_EXITED = 12
        const val MSG_START_FAILED = 13

        const val KEY_PROGRAM = "program"
        const val KEY_ARGUMENTS = "arguments"
        const val KEY_ENVIRONMENT = "environment"
        const val KEY_LINE = "line"
        const val KEY_PID = "pid"
        const val KEY_EXIT_CODE = "exitCode"
        const val KEY_CODE = "code"
        const val KEY_MESSAGE = "message"

        /** V8's own stack limit is under 1 MiB; the thread under it gets far more, so a deep recursion is a RangeError, not a crash. */
        const val NODE_THREAD_STACK_BYTES = 16L * 1024 * 1024
    }
}
