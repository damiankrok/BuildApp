/**
 * A job worker wired to the in-memory publisher, for the worker executor's
 * tests: the production worker body (`serveAnalysisWorker`) with test wiring.
 * The project `hangs` never answers for its drawings, so a test can prove a
 * job stuck inside its thread is still stopped by terminating the thread.
 */
import { HOLLOWAY, LARCHFIELD, syntheticPublisher } from '@buildapp/synthetic-drawings'
import { serveAnalysisWorker } from '../../src/worker-main.js'

serveAnalysisWorker(() => {
  const publisher = syntheticPublisher({
    projects: [
      { code: 'larchfield-lf01', title: 'Larchfield', house: LARCHFIELD },
      { code: 'holloway-hw02', title: 'Holloway', house: HOLLOWAY },
      { code: 'hangs', title: 'Never answers', house: LARCHFIELD },
    ],
    beforeRespond: (url) => (url.includes('/sheets/hangs/') ? new Promise<void>(() => undefined) : undefined),
  })
  return { adapters: [publisher.adapter], deps: publisher.deps }
})
