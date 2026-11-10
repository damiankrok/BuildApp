/**
 * v3.53: a ceiling on what the host's house reader may be asked in one day.
 *
 * Every described analysis is a paid request made on the host's key, and the service is public. The rate limit bounds
 * submissions per client; this bounds paid descriptions for the whole host, across restarts and across the worker
 * threads jobs run in (the count is a small file in the service's data directory, replaced atomically). A description
 * is counted BEFORE it is asked for, so a request that fails still counts — the bound is on what may have been billed.
 * Past the ceiling the reader is unavailable and the analyzer keeps the drawings path's answer; nothing is queued.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { HouseReaderUnavailable } from '@buildapp/source-vision'
import type { StructuredVision } from '@buildapp/source-vision'

export type HouseReaderUsage = { day: string; descriptions: number }

const dayOf = (now: Date): string => now.toISOString().slice(0, 10)

export function readHouseReaderUsage(file: string, now: Date = new Date()): HouseReaderUsage {
  try {
    const u = JSON.parse(readFileSync(file, 'utf8')) as Partial<HouseReaderUsage>
    if (u.day === dayOf(now) && Number.isInteger(u.descriptions) && (u.descriptions as number) >= 0) return { day: u.day, descriptions: u.descriptions as number }
  } catch {
    // no file yet, or one that is not ours: the day starts at zero
  }
  return { day: dayOf(now), descriptions: 0 }
}

export function cappedStructuredVision(reader: StructuredVision, options: { file: string; maxDescriptionsPerDay: number; now?: () => Date }): StructuredVision {
  const now = options.now ?? ((): Date => new Date())
  const spent = (): boolean => readHouseReaderUsage(options.file, now()).descriptions >= options.maxDescriptionsPerDay
  const refuse = (): never => {
    throw new HouseReaderUnavailable('NO_PROVIDER', `this host's daily ceiling of ${options.maxDescriptionsPerDay} house descriptions is reached`)
  }
  return {
    provider: reader.provider,
    available: () => reader.available() && !spent(),
    ask: async (request) => {
      // the sorting that precedes a description is refused too once the day is spent: it would be paid for nothing
      if (spent()) refuse()
      if (request.purpose === 'HOUSE_DESCRIPTION') {
        const usage = readHouseReaderUsage(options.file, now())
        mkdirSync(dirname(options.file), { recursive: true })
        const tmp = `${options.file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
        writeFileSync(tmp, `${JSON.stringify({ day: usage.day, descriptions: usage.descriptions + 1 })}\n`)
        renameSync(tmp, options.file)
      }
      return reader.ask(request)
    },
  }
}
