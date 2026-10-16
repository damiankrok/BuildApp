#!/usr/bin/env node
/*
 * validate-labels.mjs — check an exported labels file against its pack with the page's own rules (RESEARCH ONLY).
 *
 *   node research/analyzer-005r-exterior-owner-review/tool/validate-labels.mjs <labels.json> [real|synthetic]
 *
 * Prints the recomputed counts or every refusal; exit 1 on refusal. Reads local files only.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const core = require('./review-core.js')
const HERE = dirname(fileURLToPath(import.meta.url))

export function loadPack(kind = 'real') {
  const dir = kind === 'synthetic' ? join(HERE, '..', 'examples', 'synthetic') : join(HERE, '..', 'pack')
  const text = readFileSync(join(dir, 'queue.js'), 'utf8')
  const window = {}
  new Function('window', text)(window) // the same wrapper the page loads; it only assigns two globals
  return { queue: window.OWNER_REVIEW_QUEUE, queueSha: window.OWNER_REVIEW_QUEUE_SHA256 }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [file, kind] = process.argv.slice(2)
  if (!file) {
    console.error('usage: validate-labels.mjs <labels.json> [real|synthetic]')
    process.exit(2)
  }
  const { queue, queueSha } = loadPack(kind || 'real')
  const q = await core.checkQueue(queue, queueSha)
  if (!q.ok) {
    console.error('QUEUE REFUSED', q.errors)
    process.exit(1)
  }
  const r = await core.importLabels(readFileSync(file, 'utf8'), queue, queueSha)
  if (!r.ok) {
    console.error('REFUSED\n' + r.errors.join('\n'))
    process.exit(1)
  }
  console.log('OK', JSON.stringify(core.counts(r.state, queue)), 'sealed:', Boolean(r.state.phase1Seal))
}
