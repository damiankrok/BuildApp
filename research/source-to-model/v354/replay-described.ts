/**
 * v3.54 strategy B replay: a RECORDED whole-house description (no reader call) through today's checker, builder, emitter
 * and compiler, with the page's published figures as the product passes them. No reference reaches it.
 * vite-node research/source-to-model/v354/replay-described.ts -- <description.json> <source-package.json> <outDir>
 */
import { readFileSync } from 'node:fs'
import type { PublishedFigure } from '@buildapp/source-vision'
import { buildDescribed } from '../s53/build-described.js'

const [input, pkgPath, out] = process.argv.slice(2).filter((a) => a !== '--')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { publishedFacts?: PublishedFigure[] }
const published = (pkg.publishedFacts ?? []).filter((f) => typeof f.value === 'number')
const t0 = Date.now()
const r = buildDescribed(JSON.parse(readFileSync(input, 'utf8')), out, 'described', published)
console.log(JSON.stringify({ ms: Date.now() - t0, ...r }, null, 1))
