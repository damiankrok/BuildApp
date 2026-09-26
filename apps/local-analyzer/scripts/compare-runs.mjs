/**
 * Compare an analysis made on a device with one made on the desktop.
 *
 *   node compare-runs.mjs --device <run> --desktop <run> [--md <file>]
 *
 * Each run is either a device report (what LocalAnalyzerDeviceTest writes:
 * summary hashes, and the run report with the hashes of the sources it read)
 * or `run-host.mjs`'s output line for the same URL. A publisher's page may
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
const keys = ['sourcePackageHash', 'observationGraphHash', 'metricEvidenceHash', 'candidateHash', 'modelHash', 'sceneContentHash', 'sceneSha256']

/** { hashes, sources } from a device report or a run-host line; exits when the run did not complete. */
function load(file, name) {
  const text = readFileSync(file, 'utf8').trim()
  // a device report is one pretty-printed object; run-host prints one line (after any others)
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = JSON.parse(text.split('\n').pop())
  }
  if ('terminal' in json) {
    const t = json.terminal
    if (!t || t.type !== 'done') {
      process.stdout.write(`${name} run did not complete: ${JSON.stringify(t)}\n`)
      process.exit(2)
    }
    return { hashes: Object.fromEntries(keys.map((k) => [k, t.summary[k]])), sources: t.sources }
  }
  if (json.final !== 'Completed') {
    process.stdout.write(`${name} run did not complete: ${json.final} ${json.failure ?? ''}\n`)
    process.exit(2)
  }
  return { hashes: Object.fromEntries(keys.map((k) => [k, json[k] ?? null])), sources: json.report?.sources ?? null }
}

const deviceRun = load(value('device'), 'device')
const desktopRun = load(value('desktop'), 'desktop')
const deviceSources = deviceRun.sources
const desktopSources = desktopRun.sources
const assetKey = (s) => (s?.assets ?? []).map((a) => `${a.id}:${a.byteHash}`).sort().join('\n')
const sameDrawings = deviceSources !== null && desktopSources !== null && assetKey(deviceSources) === assetKey(desktopSources)
const samePage = deviceSources !== null && desktopSources !== null && deviceSources.pageHash === desktopSources.pageHash
const rows = keys.map((k) => ({ key: k, device: deviceRun.hashes[k], desktop: desktopRun.hashes[k], equal: deviceRun.hashes[k] === desktopRun.hashes[k] }))
const mustEqual = new Set(sameDrawings ? ['modelHash', 'sceneContentHash', 'sceneSha256'] : [])
if (sameDrawings && samePage) for (const k of keys) mustEqual.add(k)
const violations = rows.filter((r) => mustEqual.has(r.key) && !r.equal)

const lines = [
  `| | device | desktop | equal |`,
  `| --- | --- | --- | --- |`,
  `| drawings read (asset byte hashes) | ${(deviceSources?.assets ?? []).length} | ${(desktopSources?.assets ?? []).length} | ${sameDrawings ? 'identical' : 'DIFFERENT'} |`,
  `| page hash | \`${(deviceSources?.pageHash ?? '—').slice(0, 16)}…\` | \`${(desktopSources?.pageHash ?? '—').slice(0, 16)}…\` | ${samePage ? 'yes' : 'no'} |`,
  ...rows.map((r) => `| ${r.key} | \`${(r.device ?? '—').slice(0, 16)}…\` | \`${(r.desktop ?? '—').slice(0, 16)}…\` | ${r.equal ? 'yes' : mustEqual.has(r.key) ? '**NO — must be equal**' : 'no (inputs differ)'} |`),
]
const md = `${lines.join('\n')}\n`
if (value('md')) writeFileSync(value('md'), md)
process.stdout.write(md)
process.exit(violations.length > 0 ? 1 : 0)
