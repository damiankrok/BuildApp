/**
 * Run the local analyzer bundle on this machine exactly as the phone runs it:
 * the same launcher, the same arguments, events on file descriptor 3 and the
 * control pipe on 4. Used by the parity tests and by CI to run the SAME bytes
 * under Node 18.20.4 (the runtime in the APK) and under Node 22.
 *
 *   node run-host.mjs --dir <bundle dir> --url <url> [--fixture] [--node <node binary>]
 *                     [--work <dir>] [--out <dir>] [--cancel-after-ms <n>] [--events <file>]
 *
 * Prints the terminal event as one JSON line on stdout and exits with the
 * program's exit code.
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export function runHost({ dir, url, fixture = false, node = process.execPath, work, out, cancelAfterMs, jobId = randomBytes(16).toString('hex'), onEvent }) {
  const scratch = mkdtempSync(join(tmpdir(), 'local-analyzer-'))
  const workDir = resolve(work ?? join(scratch, 'work'))
  const outDir = resolve(out ?? join(scratch, 'out'))
  const entry = join(resolve(dir), fixture ? 'fixture-main.mjs' : 'main.mjs')
  const args = [entry, '--job', jobId, '--url', url, '--work', workDir, '--out', outDir, '--events-fd', '3', '--control-fd', '4']
  const child = spawn(node, args, { stdio: ['ignore', 'inherit', 'inherit', 'pipe', 'pipe'] })
  const events = []
  let buffer = ''
  child.stdio[3].setEncoding('utf8')
  child.stdio[3].on('data', (chunk) => {
    buffer += chunk
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      if (!line.trim()) continue
      const event = JSON.parse(line)
      events.push(event)
      onEvent?.(event, child)
    }
  })
  let timer
  if (cancelAfterMs !== undefined) timer = setTimeout(() => child.stdio[4].write('cancel\n'), cancelAfterMs)
  const cancel = () => child.stdio[4].write('cancel\n')
  const closeControl = () => child.stdio[4].end()
  const done = new Promise((resolveDone) => {
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      resolveDone({ code, signal, events, workDir, outDir, jobId, terminal: events.find((e) => e.type === 'done' || e.type === 'failed' || e.type === 'cancelled') ?? null })
    })
  })
  return { child, done, cancel, closeControl, workDir, outDir, jobId }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
if (isMain) {
  const argv = process.argv.slice(2)
  const value = (name) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const eventsFile = value('events')
  const run = runHost({
    dir: value('dir'),
    url: value('url'),
    fixture: argv.includes('--fixture'),
    node: value('node') ?? process.execPath,
    work: value('work'),
    out: value('out'),
    cancelAfterMs: value('cancel-after-ms') === undefined ? undefined : Number(value('cancel-after-ms')),
    onEvent: (event) => {
      if (event.type === 'progress') process.stderr.write(`[${(event.elapsedMs / 1000).toFixed(1)} s] ${event.event.stage} ${Math.round(event.event.progress * 100)}% ${event.event.detail ?? ''}\n`)
      else if (event.type === 'hello') process.stderr.write(`runtime ${event.runtime.node} ${event.runtime.platform}/${event.runtime.arch} icu ${event.runtime.icu} collator ${event.runtime.collatorLocale}\n`)
    },
  })
  const result = await run.done
  if (eventsFile) writeFileSync(eventsFile, result.events.map((e) => JSON.stringify(e)).join('\n') + '\n')
  process.stdout.write(`${JSON.stringify({ exit: result.code, outDir: result.outDir, workDir: result.workDir, terminal: result.terminal })}\n`)
  process.exitCode = result.code ?? 1
}
