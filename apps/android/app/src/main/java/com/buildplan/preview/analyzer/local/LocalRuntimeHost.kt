package com.buildplan.preview.analyzer.local

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.Process
import android.os.RemoteException

/** What to run: the program (an installed `main.mjs`), its arguments and environment. */
data class LocalRunRequest(val program: String, val arguments: List<String>, val environment: List<String>)

/** What a run reports, always on the thread that owns the analysis state. */
interface LocalRunListener {
    /** The analyzer process exists and Node is starting; `pid` is that process. */
    fun onStarted(pid: Int)

    /** One line the program wrote on its event pipe. */
    fun onLine(line: String)

    /** Node returned with this exit code. The process is still there until the run is terminated. */
    fun onExited(code: Int)

    /** The analyzer process is gone — ended by the app, or by Android. Always the last call. */
    fun onProcessGone()

    /** The run could not be started at all. The process (if any) is being ended; [onProcessGone] follows. */
    fun onStartFailed(code: String, message: String)
}

interface LocalRunHandle {
    /** Ask the program to stop at its next checkpoint. */
    fun cancel()

    /** End the analyzer process now, whatever it is doing. Idempotent. */
    fun terminate()
}

/** Where runs happen. The app binds [LocalAnalyzerService]; the JVM tests script one. */
interface LocalRuntimeHost {
    fun start(request: LocalRunRequest, listener: LocalRunListener): LocalRunHandle
}

/**
 * Runs each job in a fresh `:analyzer` process by binding [LocalAnalyzerService].
 *
 * A new job waits until the previous job's process is really gone (its
 * binder has died): Node cannot start twice in one process, and a bind that
 * raced the old process's death could land in it. Terminating a run unbinds
 * first — so Android does not restart the service — and then ends the
 * process by its pid, which Android allows for a process of the same app.
 */
class ServiceRuntimeHost(private val context: Context) : LocalRuntimeHost {
    private val main = Handler(Looper.getMainLooper())
    private var previous: Run? = null

    override fun start(request: LocalRunRequest, listener: LocalRunListener): LocalRunHandle {
        val run = Run(request, listener)
        val before = previous
        previous = run
        if (before == null || before.gone) {
            run.bind()
        } else {
            before.afterGone { run.bind() }
            // A process that has not died within this time is not going to hold the new job up.
            main.postDelayed({ if (!run.bindRequested) run.bind() }, PREVIOUS_PROCESS_WAIT_MS)
        }
        return run
    }

    private inner class Run(private val request: LocalRunRequest, private val listener: LocalRunListener) : ServiceConnection, LocalRunHandle, IBinder.DeathRecipient {
        var gone = false
            private set
        var bindRequested = false
            private set
        private var bound = false
        private var binder: IBinder? = null
        private var service: Messenger? = null
        private var pid = 0
        private var terminated = false
        private val waiting = mutableListOf<() -> Unit>()

        private val incoming = Messenger(Handler(Looper.getMainLooper()) { message ->
            if (!gone) {
                when (message.what) {
                    LocalAnalyzerService.MSG_STARTED -> {
                        pid = message.data.getInt(LocalAnalyzerService.KEY_PID)
                        listener.onStarted(pid)
                    }
                    LocalAnalyzerService.MSG_EVENT -> message.data.getString(LocalAnalyzerService.KEY_LINE)?.let(listener::onLine)
                    LocalAnalyzerService.MSG_EXITED -> listener.onExited(message.data.getInt(LocalAnalyzerService.KEY_EXIT_CODE))
                    LocalAnalyzerService.MSG_START_FAILED -> {
                        listener.onStartFailed(
                            message.data.getString(LocalAnalyzerService.KEY_CODE) ?: "RUNTIME_UNAVAILABLE",
                            message.data.getString(LocalAnalyzerService.KEY_MESSAGE) ?: "the analyzer could not start",
                        )
                        terminate()
                    }
                }
            }
            true
        })

        fun afterGone(action: () -> Unit) {
            if (gone) action() else waiting.add(action)
        }

        fun bind() {
            if (bindRequested || terminated) return
            bindRequested = true
            bound = try {
                context.bindService(Intent(context, LocalAnalyzerService::class.java), this, Context.BIND_AUTO_CREATE)
            } catch (e: SecurityException) {
                false
            }
            if (!bound) {
                listener.onStartFailed("RUNTIME_UNAVAILABLE", "the analyzer process could not be started")
                markGone()
            }
        }

        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            if (service == null || terminated) return
            binder = service
            try {
                service.linkToDeath(this, 0)
            } catch (e: RemoteException) {
                markGone()
                return
            }
            val messenger = Messenger(service)
            this.service = messenger
            val start = Message.obtain(null, LocalAnalyzerService.MSG_START)
            start.replyTo = incoming
            start.data = Bundle().apply {
                putString(LocalAnalyzerService.KEY_PROGRAM, request.program)
                putStringArrayList(LocalAnalyzerService.KEY_ARGUMENTS, ArrayList(request.arguments))
                putStringArrayList(LocalAnalyzerService.KEY_ENVIRONMENT, ArrayList(request.environment))
            }
            try {
                messenger.send(start)
            } catch (e: RemoteException) {
                markGone()
            }
        }

        // The process died; binderDied carries it.
        override fun onServiceDisconnected(name: ComponentName?) = Unit

        override fun binderDied() {
            main.post { markGone() }
        }

        override fun cancel() {
            val messenger = service ?: return
            try {
                messenger.send(Message.obtain(null, LocalAnalyzerService.MSG_CANCEL))
            } catch (e: RemoteException) {
                // already gone; binderDied follows
            }
        }

        override fun terminate() {
            if (terminated) return
            terminated = true
            if (bound) {
                bound = false
                try {
                    context.unbindService(this)
                } catch (e: IllegalArgumentException) {
                    // not bound after all
                }
            }
            // Never this app's own process: only the analyzer's.
            if (pid > 0 && pid != Process.myPid()) Process.killProcess(pid)
            if (binder == null) markGone()
        }

        private fun markGone() {
            if (gone) return
            gone = true
            binder?.let {
                try {
                    it.unlinkToDeath(this, 0)
                } catch (e: Exception) {
                    // already unlinked by its death
                }
            }
            if (bound) {
                bound = false
                try {
                    context.unbindService(this)
                } catch (e: IllegalArgumentException) {
                    // not bound
                }
            }
            listener.onProcessGone()
            val actions = waiting.toList()
            waiting.clear()
            actions.forEach { it() }
        }
    }

    private companion object {
        const val PREVIOUS_PROCESS_WAIT_MS = 5_000L
    }
}
