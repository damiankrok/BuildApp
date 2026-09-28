package com.buildplan.preview.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.buildplan.preview.presentation.HouseSketch
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionTimeline
import com.buildplan.preview.progress.EditOutcome
import com.buildplan.preview.progress.ProgressSession
import com.buildplan.preview.progress.ProgressView
import com.buildplan.preview.progress.ProgressStore
import com.buildplan.preview.progress.TimelineCursor
import com.buildplan.preview.scene.ModelScene
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The open house's construction progress for the screens: a [ProgressSession]
 * (the rules, without Android) held above the Activity, re-bound whenever
 * another house is opened.
 *
 * Screens read [view], an immutable snapshot re-read after every change of
 * the saved record or the cursor, so they recompose exactly then. The cursor is view state:
 * it survives a rotation with this view model, returns to `Now` when another
 * house opens, and is never written anywhere.
 *
 * The Dom drawing ([sketch]) is computed once per house, off the main thread.
 */
class ProgressViewModel(application: Application) : AndroidViewModel(application) {
    private val store = ProgressStore(File(application.filesDir, "progress"))

    var session: ProgressSession? by mutableStateOf(null)
        private set

    /** What the screens draw: re-read from the session after every change of the record or the cursor. */
    var view: ProgressView? by mutableStateOf(null)
        private set

    var sketch: HouseSketch? by mutableStateOf(null)
        private set

    /** The last edit's outcome, for a transient notice; cleared by [consumeOutcome]. */
    var lastOutcome: EditOutcome? by mutableStateOf(null)
        private set

    private var boundKey: String? = null
    private var boundScene: ModelScene? = null

    /** Bind to the open scene; a different scene (or the same key reloaded) starts a new session at `Now`. */
    fun bind(scene: ModelScene?) {
        if (scene == null) {
            session = null
            boundKey = null
            boundScene = null
            sketch = null
            refresh()
            return
        }
        if (scene === boundScene) return
        boundKey = scene.key
        boundScene = scene
        session = ProgressSession(scene, store)
        sketch = null
        refresh()
        viewModelScope.launch {
            val drawn = withContext(Dispatchers.Default) { runCatching { HouseSketch.of(scene) }.getOrNull() }
            if (boundScene === scene) sketch = drawn
        }
    }

    // -- the cursor --------------------------------------------------------

    fun previewStop(stop: Int) {
        val s = session ?: return
        val cursor = ConstructionTimeline.STOPS.getOrNull(stop) ?: return
        if (s.cursor == cursor) return
        s.preview(cursor)
        refresh()
    }

    fun preview(stage: ConstructionStageKey) {
        val s = session ?: return
        s.preview(TimelineCursor.Stage(stage))
        refresh()
    }

    fun returnToNow() {
        val s = session ?: return
        if (s.cursor == TimelineCursor.Now) return
        s.returnToNow()
        refresh()
    }

    // -- edits (Etapy only) ------------------------------------------------

    fun startStage(stageId: String, completion: Double = 0.0) = apply { it.startStage(stageId, completion) }

    fun setCompletion(stageId: String, completion: Double) = apply { it.setCompletion(stageId, completion) }

    fun markDone(stageId: String) = apply { it.markDone(stageId) }

    fun resetStage(stageId: String) = apply { it.resetStage(stageId) }

    fun markDoneBefore(stageId: String) = apply { it.markDoneBefore(stageId) }

    fun setCurrentTask(label: String?) = apply { it.setCurrentTask(label) }

    /** The screen has said [outcome]; a newer one that arrived meanwhile is kept, never wiped. */
    fun consumeOutcome(outcome: EditOutcome) {
        if (lastOutcome === outcome) lastOutcome = null
    }

    private fun refresh() {
        view = session?.view()
    }

    private fun apply(edit: (ProgressSession) -> EditOutcome): EditOutcome {
        val s = session ?: return EditOutcome.NotEditable
        val outcome = edit(s)
        lastOutcome = outcome
        refresh()
        return outcome
    }
}
