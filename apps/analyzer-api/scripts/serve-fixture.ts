/**
 * TEST ONLY: the analyzer API wired to the in-memory publisher, for the
 * browser end-to-end run (apps/web/e2e/analyzer.spec.ts).
 *
 * The server, runner and store are the production classes; the wiring is the
 * synthetic publisher's. Nothing in the production entry points imports this
 * file (tests/architecture/analyzer-api.test.ts holds that line), and it only
 * ever listens on loopback.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { loadConfig } from '../src/config.js'
import { InProcessExecutor } from '../src/executor.js'
import { createApiServer } from '../src/http.js'
import { JobRunner } from '../src/runner.js'
import { FileJobStore } from '../src/store.js'

const port = Number(process.env.ANALYZER_FIXTURE_PORT ?? 4180)
const publisher = syntheticPublisher({ projects: [{ code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD }] })
const config = { ...loadConfig({}), dataDir: mkdtempSync(join(tmpdir(), 'analyzer-fixture-')), executor: 'inprocess' as const, log: false }
const store = new FileJobStore(config.dataDir)
await store.init()
const runner = new JobRunner(store, new InProcessExecutor(() => ({ adapters: [publisher.adapter], deps: publisher.deps })), config)
createApiServer({ config, store, runner, adapters: [publisher.adapter] }).listen(port, '127.0.0.1', () => {
  process.stdout.write(`fixture analyzer API on http://127.0.0.1:${port} — project page ${publisher.pageUrl('larchfield-lf01')}\n`)
})
