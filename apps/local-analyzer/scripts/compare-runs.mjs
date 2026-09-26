/**
 * Compare an analysis made on a device with one made on the desktop.
 *
 *   node compare-runs.mjs --device <device report .json> --desktop <run-host terminal .json> [--md <file>]
 *
 * The device report is what LocalAnalyzerDeviceTest writes (summary hashes,
 * and the run report with the hashes of the sources it read); the desktop one
 * is `run-host.mjs`'s output line for the same URL. A publisher's page may
 * differ between two fetches (BUILDAPP-03Y1 measured it), so the comparison is
 * layered: which drawings each run read (by byte hash), whether the page was
 * the same, and then every result hash. Equal drawings must give an equal
 * building (model, scene); an equal page too must give an equal candidate.
 * Exits non-zero when a hash differs that the inputs say must be equal.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const value = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const device = JSON.parse(readFileSync(value('device'), 'utf8'))
const desktopLine = JSON.parse(readFileSync(value('desktop'), 'utf8').trim().split('\n').pop())
const desktop = desktopLine.terminal
if (!desktop || desktop.type !== 'done') {
  process.stdout.write(`desktop run did not complete: ${JSON.stringify(desktop)}\n`)
  process.exit(2)
}
const deviceSources = device.report?.sources ?? null
const desktopSources = desktop.sources
const assetKey = (s) => (s?.assets ?? []).map((a) => `${a.id}:${a.byteHash}`).sort().join('\n')
const sameDrawings = deviceSources !== null && assetKey(deviceSources) === assetKey(desktopSources)
const samePage = deviceSources !== null && deviceSources.pageHash === desktopSources.pageHash
const keys = ['sourcePackageHash', 'observationGraphHash', 'metricEvidenceHash', 'candidateHash', 'modelHash', 'sceneContentHash', 'sceneSha256']
const rows = keys.map((k) => ({ key: k, device: device[k] ?? null, desktop: desktop.summary[k], equal: device[k] === desktop.summary[k] }))
const mustEqual = new Set(sameDrawings ? ['modelHash', 'sceneContentHash', 'sceneSha256'] : [])
if (sameDrawings && samePage) for (const k of keys) mustEqual.add(k)
const violations = rows.filter((r) => mustEqual.has(r.key) && !r.equal)

const lines = [
  `| | device | desktop | equal |`,
  `| --- | --- | --- | --- |`,
  `| drawings read (asset byte hashes) | ${(deviceSources?.assets ?? []).length} | ${(desktopSources?.assets ?? []).length} | ${sameDrawings ? 'identical' : 'DIFFERENT'} |`,
  `| page hash | \`${(deviceSources?.pageHash ?? '—').slice(0, 16)}…\` | \`${desktopSources.pageHash.slice(0, 16)}…\` | ${samePage ? 'yes' : 'no'} |`,
  ...rows.map((r) => `| ${r.key} | \`${(r.device ?? '—').slice(0, 16)}…\` | \`${r.desktop.slice(0, 16)}…\` | ${r.equal ? 'yes' : mustEqual.has(r.key) ? '**NO — must be equal**' : 'no (inputs differ)'} |`),
]
const md = `${lines.join('\n')}\n`
if (value('md')) writeFileSync(value('md'), md)
process.stdout.write(md)
process.exit(violations.length > 0 ? 1 : 0)
