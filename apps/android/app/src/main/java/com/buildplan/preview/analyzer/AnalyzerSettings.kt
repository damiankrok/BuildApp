package com.buildplan.preview.analyzer

import android.content.Context
import android.content.SharedPreferences

/** The analysis that was running when the app last saw it, so reopening the app resumes it. */
data class ActiveJob(val jobId: String, val baseUrl: String, val sourceUrl: String)

/**
 * The little the Analyzer remembers between launches, in the app's private
 * SharedPreferences: a service address the owner typed (for a build that has
 * none), the running job, and the last link. No secret is stored — the API
 * has none.
 */
class AnalyzerSettings(context: Context) {
    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /** The address the owner entered on the phone; empty when none. */
    var serviceAddress: String
        get() = prefs.getString(KEY_SERVICE, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_SERVICE, value.trim()).apply()

    var lastLink: String
        get() = prefs.getString(KEY_LAST_LINK, "").orEmpty()
        set(value) = prefs.edit().putString(KEY_LAST_LINK, value).apply()

    /** The running job, only if both its id and its service address are still well formed. */
    val activeJob: ActiveJob?
        get() {
            val id = prefs.getString(KEY_JOB_ID, null)
            val base = AnalyzerAddress.normalize(prefs.getString(KEY_JOB_BASE, null))
            if (!JobIds.isValid(id) || base == null) return null
            return ActiveJob(id!!, base, prefs.getString(KEY_JOB_SOURCE, "").orEmpty())
        }

    fun saveActiveJob(job: ActiveJob) {
        prefs.edit()
            .putString(KEY_JOB_ID, job.jobId)
            .putString(KEY_JOB_BASE, job.baseUrl)
            .putString(KEY_JOB_SOURCE, job.sourceUrl)
            .apply()
    }

    fun clearActiveJob() {
        prefs.edit().remove(KEY_JOB_ID).remove(KEY_JOB_BASE).remove(KEY_JOB_SOURCE).apply()
    }

    private companion object {
        const val FILE = "analyzer"
        const val KEY_SERVICE = "service_address"
        const val KEY_LAST_LINK = "last_link"
        const val KEY_JOB_ID = "active_job_id"
        const val KEY_JOB_BASE = "active_job_base_url"
        const val KEY_JOB_SOURCE = "active_job_source_url"
    }
}
