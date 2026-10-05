/**
 * The two pipes a local-analyzer program speaks over (see `program.ts`): events out, control in. Shared by the
 * analysis program and the OCR self-test (`self-test.ts`), which run in separate processes from separate bundles.
 */
import { writeSync } from 'node:fs'
import { Socket } from 'node:net'

const PAUSE = new Int32Array(new SharedArrayBuffer(4))

/**
 * Where events go: a file descriptor the app handed over, or this process's
 * stdout. The descriptor stays the app's: it is never closed here, because the
 * app closes it itself once the runtime has returned, and that close is what
 * tells its reader the program is over.
 */
export function eventSink<E = unknown>(fd: number | null): { emit: (event: E) => void; emitBestEffort: (event: E) => void } {
  if (fd === null) {
    const write = (event: E): void => void process.stdout.write(`${JSON.stringify(event)}\n`)
    return { emit: write, emitBestEffort: write }
  }
  const writeFrom = (line: Buffer, from: number): void => {
    let at = from
    while (at < line.length) {
      try {
        at += writeSync(fd, line, at, line.length - at)
      } catch (error) {
        // a non-blocking descriptor whose buffer is full: wait a moment and write the rest
        if ((error as NodeJS.ErrnoException).code !== 'EAGAIN') throw error
        Atomics.wait(PAUSE, 0, 0, 2)
      }
    }
  }
  return {
    emit: (event) => writeFrom(Buffer.from(`${JSON.stringify(event)}\n`, 'utf8'), 0),
    // A heartbeat the app is too slow to take is dropped, never waited for: a stalled reader must
    // not stall the analysis. A line once started is finished, so the app never sees half of one.
    emitBestEffort: (event) => {
      const line = Buffer.from(`${JSON.stringify(event)}\n`, 'utf8')
      let first: number
      try {
        first = writeSync(fd, line, 0, line.length)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EAGAIN') return
        throw error
      }
      if (first < line.length) writeFrom(line, first)
    },
  }
}

/** A `cancel` line, or the pipe closing, aborts the run. Returns a function that stops listening. */
export function listenForCancel(fd: number | null, controller: AbortController): () => void {
  if (fd === null) return () => undefined
  const socket = new Socket({ fd, readable: true, writable: false })
  let text = ''
  const cancel = (): void => {
    if (!controller.signal.aborted) controller.abort(new DOMException('the analysis was cancelled', 'AbortError'))
  }
  socket.on('data', (chunk: Buffer) => {
    text += chunk.toString('utf8')
    if (text.split('\n').some((line) => line.trim() === 'cancel')) cancel()
    text = text.slice(-64)
  })
  socket.on('end', cancel)
  socket.on('error', cancel)
  return () => socket.destroy()
}
