#!/usr/bin/env node
/**
 * a1_aspect_v1.mjs — 005R addendum A1 (POST-HOC diagnostic, RESEARCH ONLY): does V1 route by image format?
 *
 *   node a1_aspect_v1.mjs <inputs.json> <v1-model.json> <out.jsonl>
 *
 * Every input is decoded, letterboxed IN MEMORY to a square canvas (right/bottom padding, white and then mid-grey 128),
 * and passed through the SAME V1 features and the SAME fitted rules. No image is written anywhere.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { decode, features } from '../v1/features.mjs'
import { predict } from '../v1/tree.mjs'

const [inputsP, modelP, outP] = process.argv.slice(2)
const model = JSON.parse(readFileSync(modelP, 'utf8'))
const letterbox = (img, v) => {
  const s = Math.max(img.width, img.height)
  const data = new Uint8Array(s * s * 4).fill(v)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  for (let y = 0; y < img.height; y++) data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), y * s * 4)
  return { width: s, height: s, data }
}
const lines = []
for (const it of JSON.parse(readFileSync(inputsP, 'utf8'))) {
  try {
    const img = decode(readFileSync(it.path))
    const row = { assetId: it.assetId }
    for (const [name, v] of [['white', 255], ['grey', 128]]) {
      const p = predict(model, features(letterbox(img, v)))
      row[name] = { label: p.label, resolved: p.resolved }
    }
    lines.push(JSON.stringify(row))
  } catch (e) {
    lines.push(JSON.stringify({ assetId: it.assetId, error: String(e.message ?? e) }))
  }
}
writeFileSync(outP, lines.join('\n') + '\n')
console.log(`a1 v1 ${lines.length}`)
