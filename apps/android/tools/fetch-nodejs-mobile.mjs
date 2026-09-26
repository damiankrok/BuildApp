/**
 * Fetch the embedded Node runtime the local analyzer runs on.
 *
 *   node apps/android/tools/fetch-nodejs-mobile.mjs [--out <dir>] [--abi arm64-v8a,x86_64]
 *
 * The runtime is nodejs-mobile 18.20.4 (https://github.com/nodejs-mobile/nodejs-mobile),
 * the prebuilt `libnode.so` its maintainers publish. It is taken from the npm
 * package that carries it (`nodejs-mobile-react-native@18.20.4` — only its
 * `android/libnode/bin/<abi>/libnode.so` files and its LICENSE are used, none
 * of its React Native code), because the npm registry is the one public
 * source every build machine of this project can reach.
 *
 * Nothing is trusted on arrival: the tarball must match the sha512 the
 * registry published for that version, and each extracted library must match
 * the sha256 pinned below. A mismatch deletes the output and fails.
 *
 * Output (gitignored; 60+ MB per ABI is not committed):
 *
 *   <out>/<abi>/libnode.so   unstripped, as published; Gradle strips it when packaging
 *   <out>/LICENSE            nodejs-mobile's license (MIT, with Node.js's bundled notices)
 *   <out>/runtime.json       what was fetched, from where, and its hashes
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))

export const NODEJS_MOBILE = {
  runtime: 'nodejs-mobile',
  nodeVersion: '18.20.4',
  npmPackage: 'nodejs-mobile-react-native',
  npmVersion: '18.20.4',
  tarball: 'https://registry.npmjs.org/nodejs-mobile-react-native/-/nodejs-mobile-react-native-18.20.4.tgz',
  // `npm view nodejs-mobile-react-native@18.20.4 dist.integrity`
  integrity: 'sha512-Lba5nYNwEbw+K9WQnxcyY/9Beagw+NIVbyrCU6burCJZ1p1iKxSXTp5rctgvRxzQb4ARY0r9Uy1k7Dseb1FhVw==',
  libraries: {
    'arm64-v8a': { path: 'package/android/libnode/bin/arm64-v8a/libnode.so', sha256: '7c907316beb6e78e34495926c9ac1befe079369b14650d508ea812929258250c', bytes: 62475584 },
    'armeabi-v7a': { path: 'package/android/libnode/bin/armeabi-v7a/libnode.so', sha256: 'd60451f64718354b1a3d4857d20fbe56cc3a3dbe2c319c2911342aea2bbef92d', bytes: 58720948 },
    x86_64: { path: 'package/android/libnode/bin/x86_64/libnode.so', sha256: '9acba7e26a1e864f13b78f1b7121773643f3f33a4c6a2fe7d4f63eb06d4d3af1', bytes: 65361944 },
  },
  license: 'package/LICENSE',
}

/** arm64-v8a is the phone; x86_64 is the emulator the CI smoke test runs on. */
export const DEFAULT_ABIS = ['arm64-v8a', 'x86_64']

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** The regular files of a tar archive, by name. Enough of ustar/pax for an npm tarball. */
function* tarEntries(tar) {
  let at = 0
  let longName = null
  while (at + 512 <= tar.length) {
    const header = tar.subarray(at, at + 512)
    if (header.every((b) => b === 0)) break
    const field = (offset, length) => header.subarray(offset, offset + length).toString('latin1').replace(/\0.*$/s, '')
    const size = parseInt(field(124, 12).trim() || '0', 8)
    const type = field(156, 1) || '0'
    const prefix = field(345, 155)
    let name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100))
    longName = null
    const body = tar.subarray(at + 512, at + 512 + size)
    at += 512 + Math.ceil(size / 512) * 512
    if (type === 'x') {
      // pax extended header: a `path=` record replaces the next entry's name
      const m = /\d+ path=([^\n]*)\n/.exec(body.toString('utf8'))
      if (m) longName = m[1]
      continue
    }
    if (type === 'L') {
      longName = body.toString('utf8').replace(/\0.*$/s, '')
      continue
    }
    if (type === '0' || type === '\0') yield { name, body }
  }
}

export async function fetchNodejsMobile({ out = join(here, '..', 'third_party', 'nodejs-mobile'), abis = DEFAULT_ABIS, tarballPath } = {}) {
  out = resolve(out)
  const wanted = abis.map((abi) => {
    const lib = NODEJS_MOBILE.libraries[abi]
    if (!lib) throw new Error(`no nodejs-mobile library for ABI ${abi}`)
    return [abi, lib]
  })
  const manifestPath = join(out, 'runtime.json')
  if (existsSync(manifestPath)) {
    const have = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const complete = wanted.every(([abi, lib]) => have.libraries?.[abi]?.sha256 === lib.sha256 && existsSync(join(out, abi, 'libnode.so')))
    if (complete && wanted.every(([abi, lib]) => sha256(readFileSync(join(out, abi, 'libnode.so'))) === lib.sha256)) return { out, fetched: false }
  }

  let tgz
  if (tarballPath) tgz = readFileSync(tarballPath)
  else {
    const response = await fetch(NODEJS_MOBILE.tarball)
    if (!response.ok) throw new Error(`${NODEJS_MOBILE.tarball}: HTTP ${response.status}`)
    tgz = Buffer.from(await response.arrayBuffer())
  }
  const integrity = `sha512-${createHash('sha512').update(tgz).digest('base64')}`
  if (integrity !== NODEJS_MOBILE.integrity) throw new Error(`the ${NODEJS_MOBILE.npmPackage}@${NODEJS_MOBILE.npmVersion} tarball does not match its published integrity (${integrity})`)

  const byName = new Map()
  const needed = new Set([...wanted.map(([, lib]) => lib.path), NODEJS_MOBILE.license])
  for (const entry of tarEntries(gunzipSync(tgz))) if (needed.has(entry.name)) byName.set(entry.name, entry.body)

  const staging = `${out}.partial`
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  const libraries = {}
  for (const [abi, lib] of wanted) {
    const body = byName.get(lib.path)
    if (!body) throw new Error(`${lib.path} is not in the tarball`)
    const digest = sha256(body)
    if (digest !== lib.sha256 || body.length !== lib.bytes) throw new Error(`${abi} libnode.so is not the pinned file (sha256 ${digest}, ${body.length} bytes)`)
    mkdirSync(join(staging, abi), { recursive: true })
    writeFileSync(join(staging, abi, 'libnode.so'), body)
    libraries[abi] = { sha256: digest, bytes: body.length }
  }
  const license = byName.get(NODEJS_MOBILE.license)
  if (!license) throw new Error('the tarball carries no LICENSE')
  writeFileSync(join(staging, 'LICENSE'), license)
  const manifest = { runtime: NODEJS_MOBILE.runtime, nodeVersion: NODEJS_MOBILE.nodeVersion, source: NODEJS_MOBILE.tarball, integrity: NODEJS_MOBILE.integrity, libraries }
  writeFileSync(join(staging, 'runtime.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  rmSync(out, { recursive: true, force: true })
  renameSync(staging, out)
  return { out, fetched: true }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  const value = (name) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const { out, fetched } = await fetchNodejsMobile({
    out: value('out'),
    abis: value('abi') ? value('abi').split(',') : DEFAULT_ABIS,
    tarballPath: value('tarball'),
  })
  process.stdout.write(`${fetched ? 'fetched' : 'already present'}: nodejs-mobile ${NODEJS_MOBILE.nodeVersion} in ${out}\n`)
}
