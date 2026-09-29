package com.buildplan.preview.ui

/**
 * A sheet over the house: one at a time, each a matter of the open house.
 *
 * `MENU` is the house menu (the houses on this phone, adding one from a
 * link, the ways to the other sheets and the named place of the future cost
 * workspace); `STAGES` is the owner's account of the build, the only place
 * it is edited; `SOURCE` is where the model came from, what the analysis
 * left open, and the technical figures.
 */
enum class Sheet { MENU, STAGES, SOURCE }

/**
 * A task the owner leaves the house for, and comes back from to the same
 * house and the same camera. Today there is one: adding a house from a link.
 */
enum class Task { ANALYZER }

/**
 * Where the owner is, as plain data (INTEGRATION-004A, house-first).
 *
 * The house workspace is the root whenever a house exists: there is no place
 * to go "to" it and none to go back to from it. Over it stands at most one
 * [Sheet]; a [Task] takes the whole screen and closes the sheet. Every
 * transition, back included, is a pure function here, so the navigation can
 * be tested without a screen.
 *
 * Back retraces one step and leaves the app only from the bare workspace:
 * a task returns to the workspace; a sheet closes. Surfaces inside the
 * workspace (a tool pane, the details, a selection) handle back themselves
 * first, and only while they are open.
 */
data class ShellState(
    val task: Task? = null,
    val sheet: Sheet? = null,
) {
    val analyzerOpen: Boolean get() = task == Task.ANALYZER

    /** One sheet at a time: opening one replaces another, and closes no task (a task has no sheets). */
    fun open(sheet: Sheet): ShellState = if (task != null) this else copy(sheet = sheet)

    fun closeSheet(): ShellState = copy(sheet = null)

    fun openAnalyzer(): ShellState = ShellState(task = Task.ANALYZER)

    /** What back does here, or null when it leaves the app. */
    fun back(): ShellState? = when {
        task != null -> ShellState()
        sheet != null -> copy(sheet = null)
        else -> null
    }

    /** One line, for `rememberSaveable`: `HOUSE`, `HOUSE:STAGES` or `ANALYZER`. */
    fun encode(): String = when {
        task != null -> task.name
        sheet != null -> "$HOUSE:${sheet.name}"
        else -> HOUSE
    }

    companion object {
        private const val HOUSE = "HOUSE"

        /**
         * The launch extra that opens a surface directly, used for screenshots
         * and shortcuts: `HOUSE` (or the older `MODEL`) for the workspace,
         * `STAGES`, `SOURCE` or `MENU` for the workspace with that sheet, and
         * `ANALYZER` for the task.
         */
        const val EXTRA_PLACE = "com.buildplan.preview.PLACE"

        /** The launch extra (`true`) that hides the scenes shipped in the APK, so the no-house state can be seen and captured. */
        const val EXTRA_WITHOUT_BUNDLED = "com.buildplan.preview.WITHOUT_BUNDLED"

        fun decode(text: String?): ShellState? {
            if (text.isNullOrBlank()) return null
            val (head, tail) = text.split(':', limit = 2).let { it[0].uppercase() to it.getOrNull(1)?.uppercase() }
            if (head == Task.ANALYZER.name) return ShellState().openAnalyzer()
            val sheetName = when (head) {
                HOUSE, "MODEL" -> tail
                else -> head
            }
            if (sheetName == null) return ShellState()
            val sheet = Sheet.entries.firstOrNull { it.name == sheetName } ?: return null
            return ShellState().open(sheet)
        }
    }
}
