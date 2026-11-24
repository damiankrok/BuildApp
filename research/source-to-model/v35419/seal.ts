/**
 * v3.54.19 — seals a delivered model for the phone: `seal.ts <model.json> <key>` writes
 * packages/candidates/src/owner-v35419/<key>.model.json (the canonical serialization) and prints the SHA-256 the scene
 * registry pins (packages/mobile-scene/scripts/scenes.ts → sealedOwnerModel(key, sha256, 'owner-v35419')).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseModel, serializeModel } from '@buildapp/model'
const [file, key] = process.argv.slice(2).filter((a) => a !== '--')
if (!file || !key) throw new Error('give the model file and the scene key')
const dir = join(__dirname, '../../../packages/candidates/src/owner-v35419')
mkdirSync(dir, { recursive: true })
const text = serializeModel(parseModel(readFileSync(file, 'utf8')))
writeFileSync(join(dir, `${key}.model.json`), text)
process.stdout.write(`${key} ${createHash('sha256').update(text).digest('hex')}\n`)
