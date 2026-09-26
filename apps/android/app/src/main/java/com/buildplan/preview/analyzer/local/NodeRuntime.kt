package com.buildplan.preview.analyzer.local

import java.util.concurrent.atomic.AtomicBoolean

/**
 * The embedded Node runtime: nodejs-mobile 18.20.4's `libnode.so`, started
 * through `libbuildapp_node_bridge.so` (`app/src/main/cpp/node_bridge.cpp`).
 *
 * Used ONLY inside the `:analyzer` process ([LocalAnalyzerService]). Node can
 * be started once per process and cannot be stopped from outside except by
 * ending the process, which is exactly how the app uses it: one job, one
 * process, ended when the job ends.
 */
object NodeRuntime {
    const val RUNTIME = "nodejs-mobile"
    const val NODE_VERSION = "18.20.4"
    const val LIBRARY = "libnode.so"
    const val BRIDGE_LIBRARY = "libbuildapp_node_bridge.so"

    private val started = AtomicBoolean(false)

    @Volatile
    private var loadFailure: String? = null

    @Volatile
    private var loaded = false

    /** Load both libraries. The reason they could not be loaded, or null when they are. */
    @Synchronized
    fun load(): String? {
        if (loaded) return null
        loadFailure?.let { return it }
        return try {
            System.loadLibrary("node")
            System.loadLibrary("buildapp_node_bridge")
            loaded = true
            null
        } catch (e: UnsatisfiedLinkError) {
            "the embedded Node runtime is not part of this app for this device's processor"
                .also { loadFailure = it }
        }
    }

    /**
     * Run Node with `arguments` (argv, `node` first) and `environment`
     * (`KEY=VALUE`), on the calling thread, until the program ends. Returns
     * Node's exit code. A second call in the same process is refused.
     */
    fun runOnce(arguments: List<String>, environment: List<String>): Int {
        check(loaded) { "the runtime is not loaded" }
        check(started.compareAndSet(false, true)) { "Node has already run in this process" }
        return nativeStart(arguments.toTypedArray(), environment.toTypedArray())
    }

    val hasRun: Boolean get() = started.get()

    @JvmStatic
    private external fun nativeStart(arguments: Array<String>, environment: Array<String>): Int
}
