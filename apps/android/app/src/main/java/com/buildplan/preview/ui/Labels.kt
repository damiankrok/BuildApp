package com.buildplan.preview.ui

import androidx.annotation.StringRes
import com.buildplan.preview.R
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.VisibilityMode

/**
 * The owner's words for the viewer's controls. The enums keep their English
 * technical names — evidence sheets and tests speak them — and the screen
 * speaks Polish through these resources, so one never leaks into the other.
 */
@StringRes
fun ViewPreset.labelRes(): Int = when (this) {
    ViewPreset.WHOLE -> R.string.view_whole
    ViewPreset.AXONOMETRIC -> R.string.view_axonometric
    ViewPreset.FRONT -> R.string.view_front
    ViewPreset.REAR -> R.string.view_rear
    ViewPreset.LEFT -> R.string.view_left
    ViewPreset.RIGHT -> R.string.view_right
    ViewPreset.TOP -> R.string.view_top
    ViewPreset.GROUND_PLAN -> R.string.view_ground_plan
    ViewPreset.ATTIC_PLAN -> R.string.view_attic_plan
    ViewPreset.STAIRS -> R.string.view_stairs
    ViewPreset.ENTRANCE -> R.string.view_entrance
    ViewPreset.FIT -> R.string.view_fit
    ViewPreset.ISOMETRIC -> R.string.view_isometric
}

@StringRes
fun VisibilityMode.labelRes(): Int = when (this) {
    VisibilityMode.ALL -> R.string.layer_all
    VisibilityMode.ROOF_OFF -> R.string.layer_roof_off
    VisibilityMode.GROUND_ONLY -> R.string.layer_ground
    VisibilityMode.UPPER_ONLY -> R.string.layer_upper
    VisibilityMode.CUTAWAY -> R.string.layer_cutaway
}

/** The same choice in the one or two words that fit the rail's 64 dp button at font scale 1.3. */
@StringRes
fun VisibilityMode.railLabelRes(): Int = when (this) {
    VisibilityMode.ALL -> R.string.layer_all
    VisibilityMode.ROOF_OFF -> R.string.layer_rail_roof_off
    VisibilityMode.GROUND_ONLY -> R.string.layer_rail_ground
    VisibilityMode.UPPER_ONLY -> R.string.layer_rail_upper
    VisibilityMode.CUTAWAY -> R.string.layer_rail_cutaway
}

@StringRes
fun PresentationMode.labelRes(): Int = when (this) {
    PresentationMode.MODEL -> R.string.look_model
    PresentationMode.CLAY -> R.string.look_clay
    PresentationMode.LINE -> R.string.look_line
}

@StringRes
fun PresentationMode.descriptionRes(): Int = when (this) {
    PresentationMode.MODEL -> R.string.look_model_description
    PresentationMode.CLAY -> R.string.look_clay_description
    PresentationMode.LINE -> R.string.look_line_description
}

@StringRes
fun RenderStyle.labelRes(): Int = when (this) {
    RenderStyle.CONSTRUCTION -> R.string.style_construction
    RenderStyle.CLAY -> R.string.style_clay
    RenderStyle.ARCHITECTURAL -> R.string.style_architectural
}

@StringRes
fun ConstructionStageKey.labelRes(): Int = when (this) {
    ConstructionStageKey.PLOT_PURCHASE -> R.string.stage_plot_purchase
    ConstructionStageKey.DESIGN -> R.string.stage_design
    ConstructionStageKey.PERMITS -> R.string.stage_permits
    ConstructionStageKey.SITE_PREPARATION -> R.string.stage_site_preparation
    ConstructionStageKey.FOUNDATIONS -> R.string.stage_foundations
    ConstructionStageKey.WALLS -> R.string.stage_walls
    ConstructionStageKey.FLOOR_SLAB -> R.string.stage_floor_slab
    ConstructionStageKey.ROOF -> R.string.stage_roof
    ConstructionStageKey.JOINERY -> R.string.stage_joinery
    ConstructionStageKey.ELECTRICAL -> R.string.stage_electrical
    ConstructionStageKey.PLUMBING -> R.string.stage_plumbing
    ConstructionStageKey.HEATING -> R.string.stage_heating
    ConstructionStageKey.PLASTERING -> R.string.stage_plastering
    ConstructionStageKey.SCREED -> R.string.stage_screed
    ConstructionStageKey.FACADE -> R.string.stage_facade
    ConstructionStageKey.FINISHING -> R.string.stage_finishing
    ConstructionStageKey.GARDEN -> R.string.stage_garden
}
