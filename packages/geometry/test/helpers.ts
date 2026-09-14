import { createEmptyModel, type CanonicalBuildingModel } from '@buildapp/model'
import { runCommands, type BuildingCommand } from '@buildapp/commands'

/** A model with one building and one ground level, plus whatever commands follow. */
export const withGround = (...cmds: BuildingCommand[]): CanonicalBuildingModel =>
  runCommands(createEmptyModel('t', 't'), [
    { type: 'createBuilding', id: 'b' },
    { type: 'createLevel', id: 'ground', index: 0, elevation: 0, height: 3 },
    ...cmds,
  ])

export const V = (x: number, y: number, z: number) => ({ x, y, z })
