package com.buildplan.preview.progress

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull

/** What reading one house's saved progress found. */
sealed interface ProgressLoad {
    /** Nothing saved for this house yet. */
    data object Missing : ProgressLoad

    data class Loaded(val state: ConstructionProgressState) : ProgressLoad

    /**
     * The file could not be read as a valid record. It was moved aside, not
     * deleted or overwritten, so the owner's data is still on the phone.
     */
    data class Corrupt(val reason: String, val keptAs: File?) : ProgressLoad

    /** Written by a newer app. Left exactly as it is; this build will not overwrite it. */
    data class Unsupported(val schemaVersion: Int) : ProgressLoad
}

sealed interface ProgressSave {
    data object Saved : ProgressSave

    data class Failed(val reason: String) : ProgressSave
}

/**
 * Construction progress, one small JSON file per house in the app's private
 * storage. Offline, no account, nothing leaves the phone.
 *
 * - The file name is derived from the house id (a readable part plus a hash
 *   of the whole id), and the id is stored inside and checked on read.
 * - Writes are atomic: the new record goes to a temporary file, is synced,
 *   and replaces the old one by a rename. A crash mid-write leaves the
 *   previous record, never half of one.
 * - The serialization is deterministic: fixed field order, stages in order,
 *   no clock or locale in the bytes beyond the record's own `updatedAt`.
 * - A record that fails to parse or breaks an invariant is moved aside to
 *   `*.corrupt-<n>.json` and reported; a record from a newer schema is left
 *   untouched and reported. Neither is silently replaced.
 */
class ProgressStore(private val dir: File) {
    private val lock = Any()

    fun load(houseId: HouseId): ProgressLoad = synchronized(lock) {
        val file = fileFor(houseId)
        if (!file.isFile) return ProgressLoad.Missing
        val text = try {
            file.readText()
        } catch (e: IOException) {
            return ProgressLoad.Corrupt("the file could not be read: ${e.message}", null)
        }
        // The version is read before the strict decode: a newer record may carry
        // fields this build does not know, and must be reported, not quarantined.
        val version = schemaVersionOf(text) ?: return ProgressLoad.Corrupt("not a progress record", quarantine(file))
        if (version > ConstructionProgressState.SCHEMA_VERSION) return ProgressLoad.Unsupported(version)
        val stored = try {
            JSON.decodeFromString(StoredProgress.serializer(), text)
        } catch (e: IllegalArgumentException) {
            return ProgressLoad.Corrupt("not a progress record: ${e.message?.take(200)}", quarantine(file))
        }
        if (stored.houseId != houseId.value) return ProgressLoad.Corrupt("the record belongs to another house", quarantine(file))
        return try {
            ProgressLoad.Loaded(stored.toState())
        } catch (e: IllegalArgumentException) {
            ProgressLoad.Corrupt("the record breaks a rule: ${e.message}", quarantine(file))
        }
    }

    fun save(state: ConstructionProgressState): ProgressSave = synchronized(lock) {
        val file = fileFor(state.houseId)
        val existing = if (file.isFile) (try { schemaVersionOf(file.readText()) } catch (e: IOException) { null }) else null
        if (existing != null && existing > ConstructionProgressState.SCHEMA_VERSION) {
            return ProgressSave.Failed("a newer app wrote this house's progress (schema $existing); it is not overwritten")
        }
        return try {
            dir.mkdirs()
            val tmp = File(dir, "${file.name}.tmp")
            FileOutputStream(tmp).use { out ->
                out.write(encode(state).toByteArray(Charsets.UTF_8))
                out.fd.sync()
            }
            if (!tmp.renameTo(file)) {
                tmp.delete()
                ProgressSave.Failed("could not replace ${file.name}")
            } else {
                ProgressSave.Saved
            }
        } catch (e: IOException) {
            ProgressSave.Failed("could not write the progress: ${e.message}")
        }
    }

    fun fileFor(houseId: HouseId): File {
        val readable = houseId.value.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').take(40).ifEmpty { "house" }
        val digest = MessageDigest.getInstance("SHA-256").digest(houseId.value.toByteArray(Charsets.UTF_8))
        val hash = digest.take(6).joinToString("") { "%02x".format(it) }
        return File(dir, "$readable-$hash.json")
    }

    private fun quarantine(file: File): File? {
        var n = 1
        var target: File
        do {
            target = File(dir, "${file.nameWithoutExtension}.corrupt-$n.json")
            n++
        } while (target.exists())
        return if (file.renameTo(target)) target else null
    }

    /** The record's schema version, read leniently; null when the text is not this record type at all. */
    private fun schemaVersionOf(text: String): Int? = try {
        val root = JSON.parseToJsonElement(text) as? JsonObject
        val schema = (root?.get("schema") as? JsonPrimitive)?.takeIf { it.isString }?.content
        if (schema != SCHEMA) null else (root["schemaVersion"] as? JsonPrimitive)?.intOrNull
    } catch (e: IllegalArgumentException) {
        null
    }

    companion object {
        const val SCHEMA = "buildplan.construction-progress"

        private val JSON = Json {
            prettyPrint = true
            encodeDefaults = true
            explicitNulls = true
            ignoreUnknownKeys = false
        }

        /** The exact bytes a state is saved as. Same state, same text. */
        fun encode(state: ConstructionProgressState): String = JSON.encodeToString(StoredProgress.serializer(), StoredProgress.of(state)) + "\n"
    }
}

/**
 * The file format. Property names are the JSON keys, in this order; renaming
 * or retyping one changes the format and needs a schema version bump.
 */
@Serializable
private data class StoredProgress(
    val schema: String,
    val schemaVersion: Int,
    val houseId: String,
    val updatedAtEpochMs: Long,
    val currentTaskLabel: String?,
    val stages: List<StoredStage>,
) {
    fun toState(): ConstructionProgressState = ConstructionProgressState(
        houseId = HouseId(houseId),
        stages = stages.map { it.toStage() },
        currentTaskLabel = currentTaskLabel,
        updatedAtEpochMs = updatedAtEpochMs,
        schemaVersion = schemaVersion,
    )

    companion object {
        fun of(state: ConstructionProgressState) = StoredProgress(
            schema = ProgressStore.SCHEMA,
            schemaVersion = state.schemaVersion,
            houseId = state.houseId.value,
            updatedAtEpochMs = state.updatedAtEpochMs,
            currentTaskLabel = state.currentTaskLabel,
            stages = state.stages.map { StoredStage.of(it) },
        )
    }
}

@Serializable
private data class StoredStage(
    val stageId: String,
    val definitionKey: String,
    val order: Int,
    val status: String,
    val completion: Double,
    val weight: Double,
    val note: String?,
) {
    fun toStage(): ConstructionStageProgress = ConstructionStageProgress(
        stageId = stageId,
        definitionKey = definitionKey,
        order = order,
        status = StageStatus.entries.firstOrNull { it.name == status } ?: throw IllegalArgumentException("unknown stage status '$status'"),
        completion = completion,
        weight = weight,
        note = note,
    )

    companion object {
        fun of(stage: ConstructionStageProgress) = StoredStage(
            stageId = stage.stageId,
            definitionKey = stage.definitionKey,
            order = stage.order,
            status = stage.status.name,
            completion = stage.completion,
            weight = stage.weight,
            note = stage.note,
        )
    }
}
