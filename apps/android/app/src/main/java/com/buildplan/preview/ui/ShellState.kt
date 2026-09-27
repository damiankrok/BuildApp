package com.buildplan.preview.ui

import androidx.annotation.StringRes
import com.buildplan.preview.R

/**
 * The five places of the app, in the order the navigation bar shows them.
 *
 * `Dom` is where a house is chosen, added from a link and analysed; `3D` is
 * the model on the whole screen. `Etapy`, `Koszty` and `Dokumenty` exist as
 * places so the shape of the product is visible, and each says plainly that
 * it is not built yet — none of them shows a number, a date or a file.
 */
enum class AppPlace(@StringRes val label: Int, @StringRes val description: Int) {
    HOUSE(R.string.place_house, R.string.place_house_description),
    MODEL(R.string.place_model, R.string.place_model_description),
    STAGES(R.string.place_stages, R.string.place_stages_description),
    COSTS(R.string.place_costs, R.string.place_costs_description),
    DOCUMENTS(R.string.place_documents, R.string.place_documents_description),
}

/**
 * Where the owner is, as plain data: the place, and whether the house place
 * has its link analysis open. Every transition, back included, is a pure
 * function here, so the navigation can be tested without a screen.
 *
 * Back retraces one step and never leaves the app from anywhere but `Dom`:
 * the analysis page returns to `Dom`; `3D` returns to the place it was opened
 * from; the other places return to `Dom`; and from `Dom` back belongs to the
 * system. Surfaces inside a place (the details panel, a selection) handle
 * back themselves first, and only while they are open.
 */
data class ShellState(
    val place: AppPlace = AppPlace.HOUSE,
    val analyzerOpen: Boolean = false,
    /** The place `3D` was opened from, so back returns there. */
    val cameFrom: AppPlace? = null,
) {
    /** The model takes the whole screen: no navigation bar. */
    val immersive: Boolean get() = place == AppPlace.MODEL

    fun go(to: AppPlace): ShellState = when {
        to == place && !analyzerOpen -> this
        to == AppPlace.MODEL -> ShellState(AppPlace.MODEL, cameFrom = place)
        else -> ShellState(to)
    }

    fun openAnalyzer(): ShellState = ShellState(AppPlace.HOUSE, analyzerOpen = true)

    /** What back does here, or null when it leaves the app. */
    fun back(): ShellState? = when {
        analyzerOpen -> copy(analyzerOpen = false)
        place == AppPlace.HOUSE -> null
        place == AppPlace.MODEL -> ShellState(cameFrom?.takeIf { it != AppPlace.MODEL } ?: AppPlace.HOUSE)
        else -> ShellState(AppPlace.HOUSE)
    }

    /** One line, for `rememberSaveable`: `PLACE`, `PLACE:analyzer` or `MODEL<FROM`. */
    fun encode(): String = when {
        analyzerOpen -> "${place.name}:$ANALYZER"
        cameFrom != null -> "${place.name}<${cameFrom.name}"
        else -> place.name
    }

    companion object {
        private const val ANALYZER = "analyzer"

        /** The launch extra that opens a place directly (`HOUSE`, `MODEL`, …, or `ANALYZER`), used for screenshots and shortcuts. */
        const val EXTRA_PLACE = "com.buildplan.preview.PLACE"

        fun decode(text: String?): ShellState? {
            if (text.isNullOrBlank()) return null
            if (text.equals(ANALYZER, ignoreCase = true)) return ShellState().openAnalyzer()
            val (head, analyzer) = text.split(':', limit = 2).let { it[0] to (it.getOrNull(1) == ANALYZER) }
            val (placeName, fromName) = head.split('<', limit = 2).let { it[0] to it.getOrNull(1) }
            val place = AppPlace.entries.firstOrNull { it.name.equals(placeName, ignoreCase = true) } ?: return null
            val from = fromName?.let { name -> AppPlace.entries.firstOrNull { it.name.equals(name, ignoreCase = true) } }
            return if (analyzer) ShellState(AppPlace.HOUSE, analyzerOpen = true) else ShellState(place, cameFrom = from)
        }
    }
}
