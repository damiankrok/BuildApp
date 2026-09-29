/**
 * A content-addressed byte cache on disk.
 *
 * Two jobs. It makes repeated acquisition cheap, and it makes acquisition
 * REPLAYABLE: with a populated cache and `offline: true`, the same sealed
 * package is rebuilt from the same bytes with no network at all, which is
 * what lets a benchmark run in CI and what lets a reconstruction be audited
 * later without asking a publisher to serve the same file twice.
 *
 * Bytes are stored under the hash of their URL (so a cache lookup is one
 * stat) and a sidecar records the media type — and, when a redirect moved the
 * address, a second sidecar records where the bytes were finally served from,
 * so an offline replay names the page exactly as the live run did. Nothing is ever re-encoded:
 * the cached bytes are the published bytes, so their hash is the published
 * hash.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { sha256Hex } from '@buildapp/source-common'
import type { SourceByteCache } from './acquire.js'

export const cacheKeyFor = (url: string): string => sha256Hex(url).slice(0, 32)

export function fileByteCache(dir: string): SourceByteCache {
  const pathFor = (url: string): string => join(dir, cacheKeyFor(url))
  return {
    async get(url) {
      const base = pathFor(url)
      if (!existsSync(base + '.bin') || !existsSync(base + '.type')) return null
      const [bytes, mediaType] = await Promise.all([readFile(base + '.bin'), readFile(base + '.type', 'utf8')])
      const finalUrl = existsSync(base + '.url') ? (await readFile(base + '.url', 'utf8')).trim() : undefined
      return { bytes: new Uint8Array(bytes), mediaType: mediaType.trim(), ...(finalUrl ? { url: finalUrl } : {}) }
    },
    async put(url, bytes, mediaType, finalUrl) {
      await mkdir(dir, { recursive: true })
      const base = pathFor(url)
      await Promise.all([writeFile(base + '.bin', bytes), writeFile(base + '.type', mediaType), finalUrl ? writeFile(base + '.url', finalUrl) : rm(base + '.url', { force: true })])
    },
  }
}

/** An in-memory cache, for tests and for a single process that fetches the same address twice. */
export function memoryByteCache(seed: Iterable<[string, { bytes: Uint8Array; mediaType: string; url?: string }]> = []): SourceByteCache & { size: () => number } {
  const map = new Map(seed)
  return {
    get: async (url) => map.get(url) ?? null,
    put: async (url, bytes, mediaType, finalUrl) => {
      map.set(url, finalUrl ? { bytes, mediaType, url: finalUrl } : { bytes, mediaType })
    },
    size: () => map.size,
  }
}
