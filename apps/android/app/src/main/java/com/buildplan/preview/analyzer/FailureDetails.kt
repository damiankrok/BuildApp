package com.buildplan.preview.analyzer

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull

/**
 * Why an analysis stopped, as the analyzer states it (BUILDAPP-03Y2G): the
 * solver's own reason code, the stage and step it stopped in, a heading, and
 * flat counts of how far the reading got — "1 floor plan, 41 wall bands, 0
 * enclosed cells". The same shape arrives from the analyzer on this phone
 * (`failed.failure`) and from the service (`error`).
 *
 * Every field is optional: an older analyzer sends only a code and a sentence,
 * and the screen then shows exactly that.
 */
@Serializable
data class FailureDetails(
    val reasonCode: String? = null,
    val stage: String? = null,
    val substage: String? = null,
    val title: String? = null,
    val diagnostics: Map<String, JsonElement> = emptyMap(),
) {
    private fun number(key: String): Long? = (diagnostics[key] as? JsonPrimitive)?.longOrNull
    private fun flag(key: String): Boolean? = (diagnostics[key] as? JsonPrimitive)?.booleanOrNull
    private fun text(key: String): String? = (diagnostics[key] as? JsonPrimitive)?.contentOrNull

    /** Where the run stopped, in the words of the checklist; the structural steps are one "Układ konstrukcyjny". */
    fun stoppedAt(): String? {
        if (substage in STRUCTURAL_STEPS) return "Układ konstrukcyjny"
        val id = stage ?: return null
        return AnalysisStages.DEFAULT_LABELS[id] ?: id
    }

    /** The counts a person reads, in order, one line each. Unknown keys are for the details view, not this list. */
    fun countLines(): List<String> {
        val lines = mutableListOf<String>()
        number("planFrames")?.let { lines += plural(it, "floor plan found", "floor plans found") }
        text("planSizePx")?.let { lines += "plan read at $it px" }
        number("dimensionChainsRead")?.let { read -> number("dimensionChains")?.let { all -> lines += "$read of $all dimension chains read" } }
        number("wallBands")?.let { lines += plural(it, "wall band found", "wall bands found") }
        flag("walledEnvelope")?.let { if (!it) lines += "no walled envelope" }
        val x = number("gridLinesX")
        val y = number("gridLinesY")
        if (x != null && y != null) lines += "$x × $y structural grid lines"
        number("enclosedCells")?.let { enclosed -> lines += number("cells")?.let { "$enclosed of $it grid cells enclosed" } ?: plural(enclosed, "enclosed cell", "enclosed cells") }
        number("builtRegions")?.let { lines += plural(it, "enclosed building region", "enclosed building regions") }
        number("wideOpenings")?.let { wide -> if (wide > 0) lines += "$wide wide opening${if (wide == 1L) "" else "s"} weighed, ${number("wideOpeningsClosed") ?: 0} closed" }
        number("masses")?.let { lines += plural(it, "building body", "building bodies") }
        text("gateBlocking")?.takeIf { it.isNotBlank() }?.let { lines += "layout check: $it" }
        return lines
    }

    /** Every diagnostic, as `key: value`, sorted: the details view. */
    fun detailLines(): List<String> = buildList {
        reasonCode?.let { add("reasonCode: $it") }
        stage?.let { add("stage: $it") }
        substage?.let { add("substage: $it") }
        for ((k, v) in diagnostics.toSortedMap()) add("$k: ${(v as? JsonPrimitive)?.contentOrNull ?: v.toString()}")
    }

    private fun plural(n: Long, one: String, many: String): String = "$n ${if (n == 1L) one else many}"

    companion object {
        val STRUCTURAL_STEPS = setOf("PLAN_READ", "PLAN_DECOMPOSITION", "STRUCTURAL_LAYOUT")
    }
}
