// Usage: vite-node research/source-to-model/s53/build-described-cli.ts -- <description.json> <outDir> [modelId]
import { readFileSync } from 'node:fs'
import { buildDescribed } from './build-described.js'
const [input, out, id] = process.argv.slice(2).filter((a) => a !== '--')
console.log(JSON.stringify(buildDescribed(JSON.parse(readFileSync(input, 'utf8')), out, id ?? 'described'), null, 1))
