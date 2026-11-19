import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseModel, serializeModel } from '@buildapp/model'
const [, , ...pairs] = process.argv.filter((a) => a !== '--')
for (const p of pairs) {
  const [src, dst] = p.split('=')
  const text = serializeModel(parseModel(readFileSync(src, 'utf8')))
  writeFileSync(dst, text)
  console.log(dst, createHash('sha256').update(text).digest('hex'))
}
