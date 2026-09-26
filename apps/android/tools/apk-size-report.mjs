/**
 * What the embedded local analyzer costs in the APK, measured from the files.
 *
 *   node apk-size-report.mjs --local <apk> --without <apk> [--prestage <apk>]
 *                            [--runtime-json <third_party/nodejs-mobile/runtime.json>]
 *                            [--meta <local-analyzer meta.json>] [--out <file.json>] [--md <file.md>]
 *
 *   --local      the APK with the embedded analyzer (the default build)
 *   --without    the same commit built with -PlocalAnalyzer=false
 *   --prestage   optionally, the APK of the commit before this stage
 *
 * Every number is read from the APKs' own zip directories (sizes stored and
 * compressed, per entry) or from the files named; nothing is estimated. The
 * APKs must come from CLEAN builds: AGP's incremental packager leaves the
 * space of removed entries inside an APK, so an APK rebuilt in place without
 * something can still weigh what it weighed with it.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The entries of a zip file from its central directory: name, stored (uncompressed) and compressed size. */
export function zipEntries(path) {
  const buf = readFileSync(path)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error(`${path}: not a zip file`)
  const count = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const entries = []
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error(`${path}: bad central directory`)
    const method = buf.readUInt16LE(at + 10)
    const compressed = buf.readUInt32LE(at + 20)
    const uncompressed = buf.readUInt32LE(at + 24)
    const nameLength = buf.readUInt16LE(at + 28)
    const extraLength = buf.readUInt16LE(at + 30)
    const commentLength = buf.readUInt16LE(at + 32)
    const name = buf.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    entries.push({ name, method: method === 0 ? 'stored' : 'deflated', compressed, uncompressed })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

const MiB = (bytes) => Math.round((bytes / (1024 * 1024)) * 100) / 100
const MB = (bytes) => Math.round((bytes / 1e6) * 100) / 100

/** The entries the local analyzer adds: its native libraries and its assets. */
const LOCAL_ENTRY = /^lib\/[^/]+\/(libnode\.so|libbuildapp_node_bridge\.so|libc\+\+_shared\.so)$|^assets\/local-analyzer\//

export function sizeReport({ local, without, prestage, runtimeJson, meta }) {
  const localBytes = statSync(local).size
  const withoutBytes = statSync(without).size
  const entries = zipEntries(local)
  const added = entries.filter((e) => LOCAL_ENTRY.test(e.name))
  const pick = (re) => added.filter((e) => re.test(e.name))
  const sum = (list, key) => list.reduce((a, e) => a + e[key], 0)
  const runtime = pick(/libnode\.so$/)
  const js = pick(/^assets\/local-analyzer\/.*\.mjs$/)
  const others = added.filter((e) => !runtime.includes(e) && !js.includes(e))
  const report = {
    schema: 'buildapp.local-analyzer-size-report',
    apks: {
      local: { file: basename(local), bytes: localBytes, MiB: MiB(localBytes) },
      withoutLocalAnalyzer: { file: basename(without), bytes: withoutBytes, MiB: MiB(withoutBytes) },
      ...(prestage ? { prestage: { file: basename(prestage), bytes: statSync(prestage).size, MiB: MiB(statSync(prestage).size) } } : {}),
    },
    delta: {
      bytes: localBytes - withoutBytes,
      MiB: MiB(localBytes - withoutBytes),
      MB: MB(localBytes - withoutBytes),
      ...(prestage ? { versusPrestageBytes: localBytes - statSync(prestage).size, versusPrestageMiB: MiB(localBytes - statSync(prestage).size) } : {}),
    },
    runtime: {
      entries: runtime,
      inApkCompressedBytes: sum(runtime, 'compressed'),
      strippedBytes: sum(runtime, 'uncompressed'),
      ...(runtimeJson ? { fetchedUnstrippedBytes: Object.fromEntries(Object.entries(JSON.parse(readFileSync(runtimeJson, 'utf8')).libraries).map(([abi, l]) => [abi, l.bytes])) } : {}),
    },
    analyzerJs: { entries: js, bytes: sum(js, 'uncompressed'), inApkCompressedBytes: sum(js, 'compressed') },
    otherNew: { entries: others, bytes: sum(others, 'uncompressed'), inApkCompressedBytes: sum(others, 'compressed') },
    addedEntriesCompressedTotal: sum(added, 'compressed'),
  }
  if (meta) {
    const m = JSON.parse(readFileSync(meta, 'utf8'))
    const out = Object.values(m.outputs)[0]
    const byPackage = {}
    for (const [p, v] of Object.entries(out.inputs)) {
      const key = p.replace(/^(\.\.\/)+/, '').replace(/^local-analyzer\//, 'apps/local-analyzer/').replace(/^(node_modules\/@[^/]+\/[^/]+|node_modules\/[^/]+|packages\/[^/]+|apps\/[^/]+).*/, '$1')
      byPackage[key] = (byPackage[key] ?? 0) + v.bytesInOutput
    }
    report.analyzerJs.byPackage = Object.fromEntries(Object.entries(byPackage).sort((a, b) => b[1] - a[1]))
  }
  return report
}

export function markdown(report) {
  const row = (label, bytes) => `| ${label} | ${bytes.toLocaleString('en-US')} | ${MiB(bytes)} |`
  const lines = [
    '| | bytes | MiB |',
    '| --- | ---: | ---: |',
    ...(report.apks.prestage ? [row(`APK before this stage (${report.apks.prestage.file})`, report.apks.prestage.bytes)] : []),
    row(`APK without the local analyzer (${report.apks.withoutLocalAnalyzer.file}, -PlocalAnalyzer=false)`, report.apks.withoutLocalAnalyzer.bytes),
    row(`APK with the local analyzer (${report.apks.local.file})`, report.apks.local.bytes),
    row('**delta** (with − without)', report.delta.bytes),
    row('runtime libnode.so, compressed in the APK', report.runtime.inApkCompressedBytes),
    row('runtime libnode.so, stripped (installed size)', report.runtime.strippedBytes),
    row('analyzer JS (analyzer.mjs + main.mjs)', report.analyzerJs.bytes),
    row('analyzer JS, compressed in the APK', report.analyzerJs.inApkCompressedBytes),
    row('other new entries (bridge, libc++_shared, manifest), compressed', report.otherNew.inApkCompressedBytes),
  ]
  return `${lines.join('\n')}\n`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  const value = (name) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const report = sizeReport({ local: value('local'), without: value('without'), prestage: value('prestage'), runtimeJson: value('runtime-json'), meta: value('meta') })
  const json = `${JSON.stringify(report, null, 2)}\n`
  if (value('out')) writeFileSync(value('out'), json)
  const md = markdown(report)
  if (value('md')) writeFileSync(value('md'), md)
  process.stdout.write(md)
}
