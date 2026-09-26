package com.buildplan.preview.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.buildplan.preview.analyzer.AnalysisStages
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalysisSummary
import com.buildplan.preview.analyzer.AnalyzerAddress
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.AnalyzerMessages
import com.buildplan.preview.analyzer.JobStatus
import com.buildplan.preview.analyzer.LocalRunReport
import com.buildplan.preview.analyzer.RetryAction
import com.buildplan.preview.analyzer.StageChecklist
import com.buildplan.preview.analyzer.StageRow
import com.buildplan.preview.analyzer.StageState
import com.buildplan.preview.analyzer.local.LocalAnalysis
import com.buildplan.preview.analyzer.local.NodeRuntime
import com.buildplan.preview.scene.DownloadedSceneEntry
import java.net.URI
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/**
 * The Analyzer: paste a project link, watch the service analyse it, open the
 * model it made.
 *
 * Everything on this screen is what the analyzer reported — the analyzer on
 * this phone (BUILDAPP-03Y2, "Analyzer: Local") or the service. The progress
 * bar is the analyzer's own `progress` and moves only when it reports; the
 * checklist is its stages. For a local run the elapsed time and memory are
 * the analyzer process's own numbers. There is no reference model, benchmark
 * or "expected" value anywhere here — the analyzer has none, and a result says
 * only what it made of the sources and how sure it is.
 */
@Composable
fun AnalyzerScreen(model: AnalyzerViewModel, onBack: () -> Unit, onOpenScene: (key: String) -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().safeDrawingPadding()) {
            Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to the model viewer" }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                    Text(
                        "Analyze a project link",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.semantics { heading() },
                    )
                }
            }
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                ModeRow(model)
                if (!model.isConfigured) {
                    NotConfigured(model)
                } else {
                    if (model.mode == AnalyzerMode.SERVICE) ServiceRow(model)
                    LinkForm(model)
                    model.notice?.let { StatusText(it, color = MaterialTheme.colorScheme.onSurface) }
                    JobSection(model, onOpenScene)
                }
                HorizontalDivider()
                Downloads(model, onOpenScene)
                if (model.localRuns.isNotEmpty()) {
                    HorizontalDivider()
                    LocalRuns(model.localRuns)
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Where the analysis runs
// ---------------------------------------------------------------------------

@Composable
private fun ModeRow(model: AnalyzerViewModel) {
    val local = model.mode == AnalyzerMode.LOCAL
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            if (local) "Analyzer: Local" else "Analyzer: Service",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading(); contentDescription = if (local) "Analyzer: Local, on this phone" else "Analyzer: Service" },
        )
        if (local) {
            Body(
                "The analysis runs on this phone, with the embedded ${NodeRuntime.RUNTIME} ${NodeRuntime.NODE_VERSION} runtime " +
                    "(${model.localAvailability.abi}). No service, no account; the phone fetches the project page itself.",
            )
        } else if (!model.localAvailability.available) {
            Body("The local analyzer is not available: ${model.localAvailability.reason ?: "unknown reason"}.")
        }
        TextButton(
            onClick = { model.selectMode(if (local) AnalyzerMode.SERVICE else AnalyzerMode.LOCAL) },
            enabled = !model.isRunning && (local || model.localAvailability.available),
            modifier = Modifier.defaultMinSize(minHeight = 48.dp),
        ) { Text(if (local) "Use the analyzer service instead" else "Analyze on this phone instead") }
    }
}

// ---------------------------------------------------------------------------
// Service address
// ---------------------------------------------------------------------------

@Composable
private fun NotConfigured(model: AnalyzerViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            "No analyzer service is configured in this build",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() },
        )
        val builtIn = model.builtInAddress.trim()
        if (builtIn.isNotEmpty()) {
            val reason = (AnalyzerAddress.check(builtIn) as? AnalyzerAddress.Check.Invalid)?.reason
            if (reason != null) Body("The address built into this app can't be used: $reason.")
        }
        Body(
            "The bundled models still open offline. To analyze a project link, enter the https address of a deployed " +
                "analyzer service. It is kept on this phone only; no key or password is needed or stored.",
        )
        AddressEditor(model, initial = model.serviceAddress, onDone = {})
    }
}

@Composable
private fun ServiceRow(model: AnalyzerViewModel) {
    var editing by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            val base = model.effectiveBaseUrl.orEmpty()
            val source = if (AnalyzerAddress.normalize(model.serviceAddress) != null) "set on this phone" else "built into this app"
            StatusText("Service: ${hostOf(base)} ($source)", modifier = Modifier.weight(1f))
            TextButton(
                onClick = { editing = !editing },
                enabled = !model.isRunning,
                modifier = Modifier.semantics { contentDescription = "Change the analyzer service address" },
            ) { Text(if (editing) "Close" else "Change") }
        }
        if (editing && !model.isRunning) {
            AddressEditor(model, initial = model.serviceAddress.ifEmpty { model.effectiveBaseUrl.orEmpty() }, onDone = { editing = false })
            if (model.serviceAddress.isNotEmpty() && AnalyzerAddress.normalize(model.builtInAddress) != null) {
                TextButton(onClick = { model.saveServiceAddress(""); editing = false }) { Text("Use the address built into this app") }
            }
        }
    }
}

@Composable
private fun AddressEditor(model: AnalyzerViewModel, initial: String, onDone: () -> Unit) {
    var text by rememberSaveable { mutableStateOf(initial) }
    var problem by remember { mutableStateOf<String?>(null) }
    val save = {
        problem = if (text.isBlank()) "Enter an https:// address." else model.saveServiceAddress(text)
        if (problem == null) onDone()
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it; problem = null },
        label = { Text("Service address") },
        placeholder = { Text("https://analyzer.example.com") },
        singleLine = true,
        isError = problem != null,
        supportingText = { Text(problem ?: "https only, e.g. https://analyzer.example.com") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done, autoCorrectEnabled = false),
        keyboardActions = KeyboardActions(onDone = { save() }),
        modifier = Modifier.fillMaxWidth(),
    )
    Button(onClick = { save() }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Save address") }
}

// ---------------------------------------------------------------------------
// The link and the job
// ---------------------------------------------------------------------------

@Composable
private fun LinkForm(model: AnalyzerViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = model.link,
            onValueChange = model::onLinkChange,
            label = { Text("Project page link") },
            placeholder = { Text("https://www.archon.pl/projekty-domow/…") },
            singleLine = true,
            enabled = !model.isRunning,
            isError = model.linkProblem != null,
            supportingText = model.linkProblem?.let { problem -> { Text(problem) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go, autoCorrectEnabled = false),
            keyboardActions = KeyboardActions(onGo = { model.analyze() }),
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = { model.analyze() },
            enabled = !model.isRunning && model.link.isNotBlank(),
            modifier = Modifier
                .defaultMinSize(minHeight = 48.dp)
                .semantics {
                    contentDescription = if (model.isRunning) "Analyze project. Disabled while an analysis runs." else "Analyze project"
                },
        ) { Text("Analyze project") }
    }
}

@Composable
private fun JobSection(model: AnalyzerViewModel, onOpenScene: (String) -> Unit) {
    when (val state = model.state) {
        AnalysisState.Idle -> Unit
        is AnalysisState.Submitting -> Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            Box(Modifier.width(10.dp))
            Body(if (model.mode == AnalyzerMode.LOCAL) "Preparing the analyzer on this phone…" else "Sending the link to the analyzer…")
        }
        is AnalysisState.Polling -> JobProgress(
            status = state.status,
            headline = null,
            connectionLost = state.connectionLost,
            lastFailure = state.lastFailure,
            cancelling = model.cancelling,
            onCancel = { model.cancel() },
            local = state.local,
        )
        is AnalysisState.Finishing -> JobProgress(
            status = state.status,
            headline = if (state.local != null) "Analysis finished. Checking and storing the model…" else "Analysis finished. Downloading and checking the model…",
            connectionLost = state.connectionLost,
            lastFailure = state.lastFailure,
            cancelling = false,
            onCancel = null,
            local = state.local,
        )
        is AnalysisState.Completed -> ResultCard(state.summary, state.entry, state.local, onOpen = { onOpenScene(state.entry.key) })
        is AnalysisState.Failed -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            FailureCard(state.failure, state.retry, onRetry = { model.retry() }, onDismiss = { model.dismiss() })
            state.local?.let { LocalCost(it) }
            state.status?.let { Checklist(StageChecklist.rows(it)) }
        }
        is AnalysisState.Cancelled -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("The analysis was cancelled.", style = MaterialTheme.typography.titleSmall)
            state.local?.let { LocalCost(it) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { model.analyze() }, enabled = model.link.isNotBlank()) { Text("Analyze again") }
                TextButton(onClick = { model.dismiss() }) { Text("Dismiss") }
            }
        }
    }
}

@Composable
private fun JobProgress(
    status: JobStatus?,
    headline: String?,
    connectionLost: Boolean,
    lastFailure: AnalyzerFailure?,
    cancelling: Boolean,
    onCancel: (() -> Unit)?,
    local: LocalRunReport? = null,
) {
    // Exactly the analyzer's value. It is never animated or advanced here.
    val progress = (status?.progress ?: 0.0).coerceIn(0.0, 1.0).toFloat()
    val stage = status?.stage
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            headline ?: when {
                status == null -> "Asking the analyzer how the job is going…"
                status.status == LocalAnalysis.STARTING -> "Starting the analyzer on this phone…"
                status.status == AnalysisStages.QUEUED -> "Waiting in the analyzer's queue"
                stage != null -> stage.label.ifBlank { AnalysisStages.DEFAULT_LABELS[stage.id] ?: stage.id }
                else -> status.status
            },
            style = MaterialTheme.typography.titleSmall,
        )
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Analysis progress ${(progress * 100).roundToInt()} percent" },
        )
        val position = if (stage != null && stage.count > 0) " · stage ${stage.index + 1} of ${stage.count}" else ""
        StatusText("${(progress * 100).roundToInt()} %$position")
        stage?.detail?.takeIf { it.isNotBlank() }?.let { Body(it) }
        local?.let { report ->
            val runtime = report.runtime?.let { "${it.node} · ${it.arch}" } ?: "${NodeRuntime.RUNTIME} ${NodeRuntime.NODE_VERSION}"
            StatusText("On this phone ($runtime) · elapsed ${duration(report.elapsedMs)} · memory ${megabytes(report.rssBytes)}")
        }
        if (connectionLost) {
            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small) {
                Column(Modifier.padding(10.dp)) {
                    Text("Connection lost — retrying", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.error)
                    lastFailure?.let { StatusText(AnalyzerMessages.describe(it)) }
                    StatusText("The job keeps running on the service; this screen picks it up again when the connection returns.")
                }
            }
        }
        Checklist(StageChecklist.rows(status))
        if (onCancel != null) {
            OutlinedButton(
                onClick = onCancel,
                enabled = !cancelling,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp).semantics { contentDescription = "Cancel the analysis" },
            ) { Text(if (cancelling) "Cancelling…" else "Cancel") }
        }
    }
}

@Composable
private fun Checklist(rows: List<StageRow>) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        for (row in rows) {
            val stateWord = when (row.state) {
                StageState.PENDING -> "pending"
                StageState.RUNNING -> "running"
                StageState.DONE -> "done"
                StageState.FAILED -> "failed"
                StageState.CANCELLED -> "cancelled"
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "${row.label}: $stateWord" },
            ) {
                Box(Modifier.size(22.dp), contentAlignment = Alignment.Center) {
                    when (row.state) {
                        StageState.DONE -> Icon(Icons.Filled.CheckCircle, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                        StageState.RUNNING -> CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        StageState.FAILED -> Icon(Icons.Filled.Warning, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                        StageState.CANCELLED -> Icon(Icons.Filled.Close, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                        StageState.PENDING -> Box(
                            Modifier.size(14.dp).border(1.5.dp, MaterialTheme.colorScheme.outline, CircleShape),
                        )
                    }
                }
                Box(Modifier.width(10.dp))
                Text(
                    row.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (row.state == StageState.PENDING) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                    fontWeight = if (row.state == StageState.RUNNING) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

@Composable
private fun FailureCard(failure: AnalyzerFailure, retry: RetryAction, onRetry: () -> Unit, onDismiss: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium, tonalElevation = 2.dp) {
        Column(Modifier.padding(14.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Warning, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                Box(Modifier.width(8.dp))
                Text("No model this time", style = MaterialTheme.typography.titleSmall)
            }
            Body(AnalyzerMessages.describe(failure))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (retry != RetryAction.NONE) {
                    Button(onClick = onRetry, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
                        Text(if (retry == RetryAction.REFINISH) "Download again" else "Retry")
                    }
                }
                TextButton(onClick = onDismiss, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Dismiss") }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

@Composable
private fun ResultCard(summary: AnalysisSummary, entry: DownloadedSceneEntry, local: LocalRunReport?, onOpen: () -> Unit) {
    var diagnostics by rememberSaveable { mutableStateOf(false) }
    Surface(color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium, tonalElevation = 2.dp) {
        Column(Modifier.padding(14.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(summary.title.ifBlank { entry.title }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Mono("candidate ${summary.candidateHash.take(12)}")
            local?.let { LocalCost(it) }
            Text("Solved features by level", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                LevelCell("L0", "topology only", summary.quality.levels.l0, Modifier.weight(1f))
                LevelCell("L1", "metric", summary.quality.levels.l1, Modifier.weight(1f))
                LevelCell("L2", "metric, corroborated", summary.quality.levels.l2, Modifier.weight(1f))
            }
            DataRow("Unresolved", "${summary.unresolved.size}")
            DataRow("Warnings", "${summary.warnings.size}")
            Body(visionText(summary))
            Button(
                onClick = onOpen,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp).semantics { contentDescription = "Open model ${entry.label} in the viewer" },
            ) { Text("Open model") }
            TextButton(
                onClick = { diagnostics = !diagnostics },
                modifier = Modifier.semantics { contentDescription = if (diagnostics) "Hide diagnostics" else "Show diagnostics" },
            ) {
                Text("Diagnostics")
                Icon(if (diagnostics) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown, contentDescription = null)
            }
            if (diagnostics) {
                local?.let { LocalDiagnostics(it) }
                Diagnostics(summary)
            }
        }
    }
}

@Composable
private fun LevelCell(level: String, meaning: String, count: Int, modifier: Modifier) {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small, modifier = modifier) {
        Column(
            Modifier.padding(8.dp).semantics(mergeDescendants = true) { contentDescription = "$level, $meaning: $count" },
        ) {
            Text("$count", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            StatusText("$level · $meaning")
        }
    }
}

private fun visionText(summary: AnalysisSummary): String = when (summary.vision.mode) {
    "LIVE_PROVIDER" -> "Vision provider: ${summary.vision.provider ?: "unnamed"}"
    "REPLAYED_GRAPH" -> "Replayed observation graph — no vision provider ran"
    else -> "Deterministic analyzer — no vision provider"
}

/** Every diagnostic as labelled rows. Never raw JSON. */
@Composable
private fun Diagnostics(summary: AnalysisSummary) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Section("Warnings") {
            if (summary.warnings.isEmpty()) Body("None")
            for (w in summary.warnings) Body("• $w")
        }
        Section("Unresolved") {
            if (summary.unresolved.isEmpty()) Body("Nothing left unresolved")
            for (u in summary.unresolved) {
                Column(Modifier.padding(bottom = 4.dp)) {
                    Text(u.what, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    StatusText(if (u.status.isBlank()) u.reason else "${u.reason} (${u.status.lowercase().replace('_', ' ')})")
                }
            }
        }
        Section("Hashes") {
            HashRow("Source package", summary.sourcePackageHash)
            HashRow("Observation graph", summary.observationGraphHash)
            HashRow("Metric evidence", summary.metricEvidenceHash)
            HashRow("Candidate", summary.candidateHash)
            HashRow("Model", summary.modelHash)
            HashRow("Model file (sha256)", summary.modelSha256)
            HashRow("Scene content", summary.sceneContentHash)
            HashRow("Scene file (sha256)", summary.sceneSha256)
        }
        Section("Counts") {
            val c = summary.counts
            DataRow("Source drawings", "${c.assets}")
            for ((document, n) in c.assetsByDocument.toSortedMap()) DataRow("  $document", "$n")
            DataRow("Observations", "${c.observations}")
            DataRow("Coordinate frames", "${c.frames}")
            DataRow("Metric evidence", "${c.metricEvidence}")
            DataRow("Opening callouts", "${c.callouts}")
            DataRow("Program commands", "${c.commands}")
            DataRow("Masses", "${c.masses}")
            DataRow("Openings", "${c.openings}")
            DataRow("Rooms", "${c.rooms}")
            DataRow("Balconies", "${c.balconies}")
            DataRow("Terraces", "${c.terraces}")
            DataRow("Railings", "${c.railings}")
            DataRow("Chimneys", "${c.chimneys}")
            DataRow("Rooflights", "${c.rooflights}")
            DataRow("Meshes", "${c.meshes}")
            DataRow("Triangles", "${c.triangles}")
        }
        Section("Checks") {
            val v = summary.verification
            DataRow("Replay", if (v.replay == "BYTE_IDENTICAL") "byte-identical" else v.replay.lowercase().replace('_', ' '))
            DataRow("Source-view checks outside tolerance", "${v.residualsOutsideTolerance} of ${v.residuals}")
            DataRow("Exterior joint errors", "${v.closure.exteriorErrors}")
            DataRow("Exterior closure findings", "${v.closure.exteriorFindings}")
            DataRow("Interior closure findings", "${v.closure.interiorFindings}")
            if (summary.vision.mode == "LIVE_PROVIDER") {
                DataRow("Vision readings accepted", "${summary.vision.accepted} of ${summary.vision.attempted}")
            }
        }
        Section("Source") {
            DataRow("Publisher", summary.publisher)
            DataRow("Adapter", listOf(summary.adapter.id, summary.adapter.version).filter { it.isNotBlank() }.joinToString(" "))
            DataRow("Page", summary.canonicalUrl.ifBlank { summary.sourceUrl })
            DataRow("Analyzer", "service ${summary.analyzer.service} · solver ${summary.analyzer.solver}")
            DataRow("Started", summary.startedAt)
            DataRow("Completed", summary.completedAt)
        }
    }
}

// ---------------------------------------------------------------------------
// What a local run cost
// ---------------------------------------------------------------------------

/** The numbers the owner reads off the phone: status, total time, peak memory, scene size. */
@Composable
private fun LocalCost(report: LocalRunReport) {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small) {
        Column(Modifier.padding(10.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Analysed on this phone", style = MaterialTheme.typography.labelLarge)
            DataRow("Status", outcomeText(report))
            DataRow("Total time", duration(report.timings?.totalMs ?: report.elapsedMs))
            DataRow("Peak memory (analyzer process)", report.peakRssBytes?.let { megabytes(it) } ?: "not reported")
            report.sceneBytes?.let { DataRow("Scene size", megabytes(it, decimals = 2)) }
            DataRow("Runtime", runtimeText(report))
        }
    }
}

@Composable
private fun LocalDiagnostics(report: LocalRunReport) {
    Section("Local run") {
        DataRow("Job", report.jobId.take(12))
        DataRow("Runtime", runtimeText(report))
        report.runtime?.let {
            DataRow("V8 / ICU", "${it.v8} / ${it.icu ?: "none"}")
            DataRow("Processor cores", "${it.cpus}")
            DataRow("Phone memory", megabytes(it.totalMemoryBytes))
        }
        DataRow("Analyzer", "service ${report.analyzerService} · solver ${report.analyzerSolver}")
        report.timings?.let { t ->
            DataRow("Fetching sources", duration(t.acquisitionMs))
            DataRow("Reading the drawings", duration(t.observationMs))
            DataRow("Reading printed dimensions", duration(t.metricExtractionMs))
            DataRow("Solving the building", duration(t.reconstructionMs))
            DataRow("Compiling the scene", duration(t.compileMs))
            DataRow("Verifying", duration(t.verificationMs))
            DataRow("Total", duration(t.totalMs))
        }
        DataRow("Peak memory", report.peakRssBytes?.let { "${megabytes(it)} (${report.peakSource ?: "?"})" } ?: "not reported")
        report.sceneBytes?.let { DataRow("Scene size", "$it bytes") }
    }
}

@Composable
private fun LocalRuns(runs: List<LocalRunReport>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Local runs on this phone", style = MaterialTheme.typography.titleSmall, modifier = Modifier.semantics { heading() })
        for (run in runs) {
            Surface(color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium, tonalElevation = 1.dp) {
                Column(Modifier.padding(12.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("${outcomeText(run)} · ${hostOf(run.sourceUrl)}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    StatusText(
                        listOfNotNull(
                            RUN_DATE.format(Date(run.startedAtMs)),
                            "total ${duration(run.timings?.totalMs ?: run.elapsedMs)}",
                            run.peakRssBytes?.let { "peak ${megabytes(it)}" },
                            run.sceneBytes?.let { "scene ${megabytes(it, decimals = 2)}" },
                            run.abi.ifBlank { null },
                        ).joinToString(" · "),
                    )
                }
            }
        }
    }
}

private val RUN_DATE = SimpleDateFormat("d MMM yyyy HH:mm", Locale.ENGLISH)

private fun outcomeText(report: LocalRunReport): String = when (report.outcome) {
    LocalRunReport.OUTCOME_COMPLETED -> "Completed"
    LocalRunReport.OUTCOME_CANCELLED -> if (report.forcedStop) "Cancelled (process ended)" else "Cancelled"
    LocalRunReport.OUTCOME_FAILED -> "Failed (${report.code ?: "?"})"
    LocalRunReport.OUTCOME_INTERRUPTED -> "Interrupted (app closed)"
    else -> "Running"
}

private fun runtimeText(report: LocalRunReport): String {
    val node = report.runtime?.node ?: "v${NodeRuntime.NODE_VERSION}"
    return "${NodeRuntime.RUNTIME} $node · ${report.abi.ifBlank { report.runtime?.arch ?: "?" }}"
}

private fun duration(ms: Long): String {
    val seconds = ms / 1000.0
    return if (seconds < 60) "%.1f s".format(Locale.ENGLISH, seconds) else "%d min %02d s".format(Locale.ENGLISH, (ms / 60_000), (ms / 1000) % 60)
}

private fun megabytes(bytes: Long, decimals: Int = 0): String = "%.${decimals}f MB".format(Locale.ENGLISH, bytes / (1024.0 * 1024.0))

// ---------------------------------------------------------------------------
// Downloaded analyses
// ---------------------------------------------------------------------------

@Composable
private fun Downloads(model: AnalyzerViewModel, onOpenScene: (String) -> Unit) {
    var confirmDelete by remember { mutableStateOf<DownloadedSceneEntry?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Analyses on this phone", style = MaterialTheme.typography.titleSmall, modifier = Modifier.semantics { heading() })
        val entries = model.downloads
        if (entries.isEmpty()) {
            Body("None yet. A finished analysis — made on this phone or downloaded — is kept here and in the Model menu.")
        }
        for (entry in entries) {
            Surface(color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium, tonalElevation = 1.dp) {
                Column(Modifier.padding(12.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(entry.label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                    StatusText(entry.subtitle)
                    StatusText(
                        "L0 ${entry.qualityL0} · L1 ${entry.qualityL1} · L2 ${entry.qualityL2} · " +
                            "${entry.unresolvedCount} unresolved · ${entry.warningsCount} warnings · ${hostOf(entry.sourceUrl)}",
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Button(
                            onClick = { onOpenScene(entry.key) },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp).semantics { contentDescription = "Open ${entry.label}" },
                        ) { Text("Open") }
                        TextButton(
                            onClick = { confirmDelete = entry },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp).semantics { contentDescription = "Delete ${entry.label} from this phone" },
                        ) {
                            Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
                            Box(Modifier.width(4.dp))
                            Text("Delete")
                        }
                    }
                }
            }
        }
    }
    confirmDelete?.let { entry ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text("Delete this analysis?") },
            text = { Text("${entry.label} will be removed from this phone. The link can be analyzed again at any time.") },
            confirmButton = {
                TextButton(onClick = { model.deleteDownload(entry.key); confirmDelete = null }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = null }) { Text("Keep") } },
        )
    }
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        content()
    }
}

@Composable
private fun DataRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun HashRow(label: String, value: String) {
    Column(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Mono(value.ifBlank { "—" })
    }
}

@Composable
private fun Mono(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
}

@Composable
private fun Body(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

private fun hostOf(url: String): String = try {
    URI(url).host ?: url
} catch (e: Exception) {
    url
}
