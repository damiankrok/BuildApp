/**
 * `vite-node packages/mobile-scene/scripts/scene-views.ts -- <scene.json> <out.png>`
 *
 * One scene bundle, drawn from four cameras onto one PNG (`scene-sheet.ts`).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import type { MobileSceneBundle } from '../src/index.js'
import { renderSceneSheet } from './scene-sheet.js'

if (!process.env.VITEST) {
  const [input, output] = process.argv.slice(2).filter((a) => a !== '--')
  const bundle = JSON.parse(readFileSync(input, 'utf8')) as MobileSceneBundle
  writeFileSync(output, PNG.sync.write(renderSceneSheet(bundle)))
  process.stdout.write(`wrote ${output}\n`)
}
