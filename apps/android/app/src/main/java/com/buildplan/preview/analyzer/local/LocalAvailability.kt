package com.buildplan.preview.analyzer.local

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.io.File

/** [Scheduler] on the main thread, where the Analyzer's state lives. */
class MainScheduler : Scheduler {
    private val handler = Handler(Looper.getMainLooper())

    override fun post(action: () -> Unit) {
        handler.post(action)
    }

    override fun postDelayed(delayMs: Long, action: () -> Unit): () -> Unit {
        val runnable = Runnable(action)
        handler.postDelayed(runnable, delayMs)
        return { handler.removeCallbacks(runnable) }
    }
}

/**
 * Whether this installation can analyse on the phone: the APK carries the
 * analyzer bundle, and the runtime library and its bridge were installed for
 * this phone's processor. Decided from what is actually on the device — not
 * from a build flag — so the screen never offers what cannot run.
 */
data class LocalAvailability(val available: Boolean, val abi: String, val reason: String?) {
    companion object {
        fun of(context: Context, files: LocalRuntimeFiles): LocalAvailability {
            val libDir = File(context.applicationInfo.nativeLibraryDir ?: "")
            val abi = abiOf(libDir.name)
            return when {
                files.manifest() == null -> LocalAvailability(false, abi, "this build does not include the local analyzer")
                !File(libDir, NodeRuntime.LIBRARY).isFile || !File(libDir, NodeRuntime.BRIDGE_LIBRARY).isFile ->
                    LocalAvailability(false, abi, "the embedded Node runtime is not included for this phone's processor ($abi)")
                else -> LocalAvailability(true, abi, null)
            }
        }

        /** The ABI name of an app's native library folder (`lib/arm64` → `arm64-v8a`). */
        fun abiOf(folder: String): String = when (folder) {
            "arm64" -> "arm64-v8a"
            "arm" -> "armeabi-v7a"
            "x86_64" -> "x86_64"
            "x86" -> "x86"
            else -> folder
        }
    }
}
