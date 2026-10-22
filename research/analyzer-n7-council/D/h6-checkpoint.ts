/** Council D: the owner's counters (failure at command 21 on ring-attached-1-0, checkpoint 16 commands) and the program shape that gives them. */
import { emitBuilding } from '../../../packages/reconstruction/src/v2/emit.js'
import { previewCheckpoint } from '../../../packages/reconstruction/src/candidate.js'
import { building, mass, check, done } from './lib.js'
for (const [label, levels, mainStoreys] of [['1 level, main 1 storey', 1, [0]], ['2 levels, main 2 storeys', 2, [0, 1]], ['2 levels, main 1 storey', 2, [0]]] as const) {
  const b = building([mass('main', 'MAIN', 0, 0, 10, 8, [...mainStoreys]), mass('attached-0', 'ATTACHED', 3, 8, 7, 11), mass('attached-1', 'ATTACHED', 9.95, 1, 10.57, 7)], levels)
  const prog = emitBuilding(b, 'x').program
  const cp = previewCheckpoint(prog, 'main', 'x', 'm')
  const idx = prog.findIndex((c) => (c as { id?: string }).id === 'ring-attached-1-0')
  console.log(`${label}: checkpoint ${cp?.commands} commands, ring-attached-1-0 at ${idx}`)
  if (levels === 1) check('1 level / main one storey / attached-0 a full ring reproduces 16 and 21', cp?.commands === 16 && idx === 21)
}
done()
