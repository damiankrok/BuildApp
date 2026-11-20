/**
 * v3.54.17 R2: the host's exclusive file lock and durable write, moved out of `house-reader-spend.ts` unchanged so that
 * every set of books on one disk (the host's, and the research ledger beside it) takes its reservations in one critical
 * section with the same mechanism — not a second design. Node built-ins only, so it can be loaded from any process.
 *
 *  - The lock is a file created with `wx` (exclusive create): exactly one process holds it.
 *  - A holder that died is detected by age; its lock is taken away by exactly one waiter (a rename succeeds once).
 *  - A write goes to a unique temporary file, is synced and renamed over the target: a reader never sees half a file.
 */
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'

const sleepCell = new Int32Array(new SharedArrayBuffer(4))
const sleepSync = (ms: number): void => void Atomics.wait(sleepCell, 0, 0, ms)

export const LOCK_WAIT_MS = 10_000
export const LOCK_STALE_MS = 30_000

export class FileLockTimeout extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileLockTimeout'
  }
}

/** Run `body` while holding the exclusive lock `lock` (a path). Throws `FileLockTimeout` after `waitMs`. */
export function withFileLock<T>(lock: string, body: () => T, options: { waitMs?: number; staleMs?: number } = {}): T {
  const waitMs = options.waitMs ?? LOCK_WAIT_MS
  const staleMs = options.staleMs ?? LOCK_STALE_MS
  mkdirSync(dirname(lock), { recursive: true })
  const deadline = Date.now() + waitMs
  for (;;) {
    try {
      const fd = openSync(lock, 'wx')
      writeFileSync(fd, `${process.pid} ${new Date().toISOString()}\n`)
      closeSync(fd)
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
      // a holder that died: its lock is taken away by exactly one of the waiters (a rename succeeds once)
      try {
        if (Date.now() - statSync(lock).mtimeMs > staleMs) {
          const aside = `${lock}.stale-${randomBytes(4).toString('hex')}`
          renameSync(lock, aside)
          unlinkSync(aside)
          continue
        }
      } catch {
        // released or taken aside by another in the meantime: try again
      }
      if (Date.now() > deadline) throw new FileLockTimeout('the books are held by another request for too long')
      sleepSync(15)
    }
  }
  try {
    return body()
  } finally {
    try {
      unlinkSync(lock)
    } catch {
      // already gone: a waiter judged this holder dead; nothing to release
    }
  }
}

/** Write `text` to `path` so that a reader sees either the old file or the whole new one. */
export function writeDurably(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  const fd = openSync(tmp, 'w')
  try {
    writeFileSync(fd, text)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, path)
}
