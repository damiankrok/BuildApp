package com.buildplan.preview.analyzer

/**
 * Is the analyzer alive, and is its work moving? (BUILDPLAN-ANALYZER-005A)
 *
 * Judged from what this phone received and when, on the phone's own
 * monotonic clock — the analyzer's timestamps are display only. Two signals:
 *
 *  - a **heartbeat**: any sign the analyzer crossed a loop boundary (its
 *    heartbeat sequence moved, or its stage or position did). A heartbeat is
 *    emitted by the loop itself, so it means "the thread is working";
 *  - **meaningful progress**: the work itself changed — a new phase, step or
 *    count. A heartbeat alone is not progress.
 *
 * From those, one verdict, re-evaluated every second by the screen:
 *  - no heartbeat for [NO_RESPONSE_MS] → [Liveness.NoResponse] (the person may
 *    cancel; nothing is cancelled for them);
 *  - heartbeats but the counts frozen for [HEAVY_STEP_MS] → [Liveness.HeavyStep]:
 *    a heavy step, not a hang;
 *  - waiting on the network with nothing new for [WAITING_MS] → [Liveness.Waiting];
 *  - otherwise [Liveness.Healthy].
 *
 * An analyzer that sends no activity at all (an older runtime or service)
 * gets no verdict: its silence inside a stage says nothing, and calling it a
 * stall would be a guess.
 */
class LivenessTracker {
    private var lastHeartbeatAt: Long? = null
    private var lastMeaningfulAt: Long? = null
    private var heartbeatKey: String? = null
    private var signature: String? = null
    private var activity: JobActivity? = null
    private var activityAt: Long = 0

    /** Record a status as received at [now]. Call it for every status the screen gets, repeats included. */
    fun observe(status: JobStatus?, now: Long) {
        if (status == null) return
        val a = status.activity
        val key = "${status.status}|${status.progress}|${status.stage?.id}|${a?.heartbeatSeq}"
        val work = "${status.status}|${status.stage?.id}|${status.stage?.fraction}|${a?.signature}"
        if (key != heartbeatKey) {
            heartbeatKey = key
            // A service reports how old its own last heartbeat is; the phone counts from then.
            lastHeartbeatAt = now - (a?.heartbeatAgeMs ?: 0)
        }
        if (work != signature) {
            signature = work
            lastMeaningfulAt = now
        }
        if (a != null && a != activity) {
            activity = a
            // The step's count is as of the heartbeat, which a service reports as already this old.
            activityAt = now - (a.heartbeatAgeMs ?: 0)
        }
    }

    fun verdict(now: Long): Liveness {
        val a = activity ?: return Liveness.Healthy
        val heartbeat = lastHeartbeatAt ?: return Liveness.Healthy
        val silent = now - heartbeat
        if (silent >= NO_RESPONSE_MS) return Liveness.NoResponse(silent)
        val frozen = now - (lastMeaningfulAt ?: heartbeat)
        if (a.activity == IO_WAIT && frozen >= WAITING_MS) return Liveness.Waiting(frozen)
        if (frozen >= HEAVY_STEP_MS) return Liveness.HeavyStep(frozen)
        return Liveness.Healthy
    }

    /** How long the analyzer's current step has run: its own count at the last event, plus the time since. */
    fun stepElapsedMs(now: Long): Long? = activity?.let { it.phaseElapsedMs + (now - activityAt) }

    /** How long since the last heartbeat. */
    fun sinceHeartbeatMs(now: Long): Long? = lastHeartbeatAt?.let { now - it }

    companion object {
        const val NO_RESPONSE_MS = 45_000L
        const val HEAVY_STEP_MS = 30_000L
        const val WAITING_MS = 15_000L
        const val IO_WAIT = "IO_WAIT"
    }
}

sealed interface Liveness {
    data object Healthy : Liveness

    /** Heartbeats arrive, the counts do not move: a computationally heavy step. */
    data class HeavyStep(val frozenForMs: Long) : Liveness

    /** Waiting on the publisher's server, with nothing new. */
    data class Waiting(val forMs: Long) : Liveness

    /** Nothing at all from the analyzer. */
    data class NoResponse(val silentForMs: Long) : Liveness
}
