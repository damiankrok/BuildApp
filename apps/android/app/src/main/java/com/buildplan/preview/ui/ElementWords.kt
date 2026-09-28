package com.buildplan.preview.ui

import androidx.annotation.StringRes
import com.buildplan.preview.R
import com.buildplan.preview.scene.BundleFact
import com.buildplan.preview.scene.SceneObject

/**
 * The owner's words for a scene element, read off the exporter's machine
 * vocabulary (INTEGRATION-003C, audit cycle 1, C1-03).
 *
 * The scene bundle describes elements in English engineering terms — kinds
 * ("wall", "roof"), fact labels ("Ridge axis", "Eave offset"), enum values
 * ("Gable", "Exterior") and, for an analysed house, fallback names like
 * "Wall main-iwall-1-x-0". The bundle is the analyzer's contract and stays
 * as it is; this file only chooses what the inspector says in Polish:
 *
 * - a headline from the kind and its type ("Ściana zewnętrzna", "Dach
 *   dwuspadowy") — so the type is not repeated as a row; a room keeps the
 *   name the source gave it;
 * - the storey by the source's own Polish name, or by its position;
 * - the facts an owner asks about, with Polish labels and decimal commas.
 *
 * Every word it does not know goes under "Dane techniczne" untranslated,
 * where the export's own terms are the honest record. Nothing is guessed
 * from a name: the mapping is from exact vocabulary to exact words.
 */
object ElementWords {
    /** The headline: what this is. A resource, or the source's own room name. */
    sealed interface Title {
        data class Words(@StringRes val res: Int) : Title
        data class SourceName(val name: String) : Title
    }

    fun title(obj: SceneObject): Title {
        val meta = obj.metadata
        if (obj.kind == "room" && meta != null && meta.label.isNotBlank() && !isFallbackName(obj)) return Title.SourceName(meta.label)
        val type = meta?.facts?.firstOrNull { it.label == "Type" }?.value
        return Title.Words(qualifiedNoun(obj.kind, type) ?: noun(obj.kind))
    }

    /** The exporter names an element it knows nothing more about "<Kind label> <id>": a name only in form. */
    fun isFallbackName(obj: SceneObject): Boolean {
        val meta = obj.metadata ?: return true
        return meta.label.isBlank() || meta.label == "${meta.kindLabel} ${obj.id}" || meta.label.endsWith(" ${obj.id}")
    }

    @StringRes
    fun noun(kind: String): Int = when (kind) {
        "wall" -> R.string.el_wall
        "opening" -> R.string.el_opening
        "room" -> R.string.el_room
        "door" -> R.string.el_door
        "window" -> R.string.el_window
        "surfaceRegion" -> R.string.el_surface
        "roofOpening" -> R.string.el_roof_opening
        "balcony" -> R.string.el_balcony
        "slab" -> R.string.el_slab
        "rooflight" -> R.string.el_rooflight
        "chimney" -> R.string.el_chimney
        "railing" -> R.string.el_railing
        "roof" -> R.string.el_roof
        "stair" -> R.string.el_stair
        else -> R.string.el_other
    }

    @StringRes
    private fun qualifiedNoun(kind: String, type: String?): Int? = when (kind to type) {
        "wall" to "Exterior" -> R.string.el_wall_exterior
        "wall" to "Interior" -> R.string.el_wall_interior
        "roof" to "Flat" -> R.string.el_roof_flat
        "roof" to "Gable" -> R.string.el_roof_gable
        "slab" to "Balcony" -> R.string.el_balcony
        "slab" to "Terrace" -> R.string.el_terrace
        else -> null
    }

    /**
     * The storey in the owner's words: the source's own name where the
     * export keeps it before an English gloss ("Parter (ground floor)"),
     * otherwise by position — the lowest is the ground floor.
     */
    sealed interface Storey {
        data class SourceName(val name: String) : Storey
        data object Ground : Storey
        data class Numbered(val number: Int) : Storey
    }

    fun storey(label: String?, index: Int?): Storey? {
        val text = label?.trim().orEmpty()
        if (text.contains(" (")) return Storey.SourceName(text.substringBefore(" (").trim())
        return when {
            index == null -> null
            index <= 0 -> Storey.Ground
            else -> Storey.Numbered(index)
        }
    }

    /** A fact an owner asks about, in Polish; null means it belongs under "Dane techniczne". */
    data class OwnerFact(@StringRes val label: Int, val value: String?, @StringRes val valueRes: Int? = null)

    fun ownerFact(fact: BundleFact): OwnerFact? {
        val label = OWNER_FACTS[fact.label] ?: return null
        return when (fact.label) {
            "Usage" -> USAGE[fact.value.lowercase()]?.let { OwnerFact(label, null, it) }
            else -> if (MEASURE.matches(fact.value)) OwnerFact(label, decimalComma(fact.value)) else null
        }
    }

    /** The material in Polish, or null when the export's word is not one this file knows. */
    @StringRes
    fun material(label: String?): Int? = label?.let { MATERIAL[it.trim().lowercase()] }

    /** "4.15 m" → "4,15 m": the decimal point of a number, never of anything else. */
    fun decimalComma(value: String): String = DECIMAL.replace(value) { "${it.groupValues[1]},${it.groupValues[2]}" }

    private val DECIMAL = Regex("""(\d)\.(\d)""")

    /** A measured value: numbers, their separators and a unit — nothing to translate. */
    private val MEASURE = Regex("""^[\d.,\s×x]+\s*(m|m²|m2|°|mm|cm)?$""")

    private val OWNER_FACTS: Map<String, Int> = mapOf(
        "Usage" to R.string.fact_usage,
        "Floor area" to R.string.fact_floor_area,
        "Area" to R.string.fact_area,
        "Length" to R.string.fact_length,
        "Width" to R.string.fact_width,
        "Height" to R.string.fact_height,
        "Thickness" to R.string.fact_thickness,
        "Footprint" to R.string.fact_footprint,
        "Pitch" to R.string.fact_pitch,
        "Sill" to R.string.fact_sill,
        "Opening size" to R.string.fact_opening_size,
        "Openings" to R.string.fact_openings,
        "Overhang" to R.string.fact_overhang,
        "Risers" to R.string.fact_risers,
    )

    private val USAGE: Map<String, Int> = mapOf(
        "bathroom" to R.string.usage_bathroom,
        "bedroom" to R.string.usage_bedroom,
        "boiler" to R.string.usage_boiler,
        "corridor" to R.string.usage_corridor,
        "entry" to R.string.usage_entry,
        "garage" to R.string.usage_garage,
        "hall" to R.string.usage_hall,
        "kitchen" to R.string.usage_kitchen,
        "laundry" to R.string.usage_laundry,
        "living" to R.string.usage_living,
        "pantry" to R.string.usage_pantry,
        "room" to R.string.usage_room,
        "stair" to R.string.usage_stair,
        "wardrobe" to R.string.usage_wardrobe,
    )

    private val MATERIAL: Map<String, Int> = mapOf(
        "dark render" to R.string.material_dark_render,
        "light render" to R.string.material_light_render,
        "rendered wall" to R.string.material_render,
        "timber" to R.string.material_timber,
        "timber cladding" to R.string.material_timber_cladding,
        "dark joinery" to R.string.material_dark_joinery,
        "flat roof membrane" to R.string.material_roof_membrane,
        "roof covering" to R.string.material_roof_covering,
        "concrete slab" to R.string.material_concrete,
        "glazing" to R.string.material_glazing,
        "partition" to R.string.material_partition,
        "chimney" to R.string.material_chimney,
    )
}
