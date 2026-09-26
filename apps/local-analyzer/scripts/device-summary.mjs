/**
 * The device test reports as a table: what each run on the emulator (or a
 * phone) took, in time and memory, and what it produced.
 *
 *   node device-summary.mjs <reports dir> [--md <file>]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dir, ...rest] = process.argv.slice(2)
const mdOut = rest[rest.indexOf('--md') + 1]
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []
const s = (ms) => (ms === undefined || ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`)
const mb = (b) => (b === undefined || b === null ? '—' : `${(b / 1048576).toFixed(0)} MiB`)
const lines = ['| test | end | total | fetch | drawings | printed numbers | solve | compile | verify | peak RSS | scene | runtime |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |']
for (const f of files) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const rep = r.report ?? {}
  const t = rep.timings ?? {}
  lines.push(
    `| ${r.test} | ${r.final}${rep.forcedStop ? ' (process ended)' : ''} | ${s(t.totalMs ?? rep.elapsedMs)} | ${s(t.acquisitionMs)} | ${s(t.observationMs)} | ${s(t.metricExtractionMs)} | ${s(t.reconstructionMs)} | ${s(t.compileMs)} | ${s(t.verificationMs)} | ${mb(rep.peakRssBytes)}${rep.peakSource ? ` (${rep.peakSource})` : ''} | ${r.sceneBytes ?? rep.sceneBytes ?? '—'} | ${rep.runtime ? `${rep.runtime.node} ${rep.runtime.arch}` : '—'} |`,
  )
}
if (files.length === 0) lines.push('| (no device reports) | | | | | | | | | | | |')
const md = `${lines.join('\n')}\n`
if (mdOut && rest.includes('--md')) writeFileSync(mdOut, md)
process.stdout.write(md)
