import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseModel, serializeModel } from '@buildapp/model'
for (const p of process.argv.slice(2).filter((x) => x !== '--')) console.log(p.split('/').pop(), createHash('sha256').update(serializeModel(parseModel(readFileSync(p, 'utf8')))).digest('hex'))
