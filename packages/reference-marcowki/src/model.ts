import { createEmptyModel, type CanonicalBuildingModel } from '@buildapp/model'
import { runCommands } from '@buildapp/commands'
import { MARCOWKI_CREATED_WITH, MARCOWKI_MODEL_ID, MARCOWKI_MODEL_NAME, marcowkiCommands } from './commands.js'

/** The reference model: a replay of `marcowkiCommands()` from an empty model, and nothing else. */
export function createMarcowkiReferenceBuilding(): CanonicalBuildingModel {
  return runCommands(createEmptyModel(MARCOWKI_MODEL_ID, MARCOWKI_MODEL_NAME, MARCOWKI_CREATED_WITH), marcowkiCommands())
}
