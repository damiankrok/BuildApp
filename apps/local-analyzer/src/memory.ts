/**
 * How much memory the analyzer's process holds, as the kernel counts it.
 *
 * On a phone the resident set is the number that decides whether the system
 * lets an analysis finish, so it is read from the kernel rather than
 * estimated: `VmRSS` and `VmHWM` (the high-water mark, i.e. the peak) from
 * `/proc/self/status` when the platform exposes it — Linux and Android both
 * do for a process reading its own entry — and `getrusage`'s `maxRSS`
 * otherwise. The V8 heap and the ArrayBuffer total are reported beside them
 * because the analyzer's large allocations are typed arrays, which live
 * outside the V8 heap.
 */
import { readFileSync } from 'node:fs'

export type MemorySample = {
  /** Resident set now, bytes. */
  rssBytes: number
  /** Peak resident set of this process so far, bytes. */
  peakRssBytes: number
  /** Where the peak came from: the kernel's high-water mark, or getrusage. */
  peakSource: 'VmHWM' | 'getrusage'
  heapUsedBytes: number
  arrayBuffersBytes: number
}

const KIB = 1024

/** `VmRSS` / `VmHWM` from a `/proc/<pid>/status` text, in bytes; null when absent. */
export function parseProcStatus(text: string): { rssBytes: number | null; peakRssBytes: number | null } {
  const field = (name: string): number | null => {
    const m = new RegExp(`^${name}:\\s+(\\d+)\\s+kB`, 'm').exec(text)
    return m ? Number(m[1]) * KIB : null
  }
  return { rssBytes: field('VmRSS'), peakRssBytes: field('VmHWM') }
}

export function memorySample(readStatus: () => string | null = () => readFileSync('/proc/self/status', 'utf8')): MemorySample {
  const usage = process.memoryUsage()
  let status: string | null = null
  try {
    status = readStatus()
  } catch {
    status = null
  }
  const proc = status ? parseProcStatus(status) : { rssBytes: null, peakRssBytes: null }
  const rusagePeak = process.resourceUsage().maxRSS * KIB
  return {
    rssBytes: proc.rssBytes ?? usage.rss,
    peakRssBytes: proc.peakRssBytes ?? rusagePeak,
    peakSource: proc.peakRssBytes !== null ? 'VmHWM' : 'getrusage',
    heapUsedBytes: usage.heapUsed,
    arrayBuffersBytes: usage.arrayBuffers,
  }
}
