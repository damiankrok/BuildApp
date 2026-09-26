/**
 * The production worker entry, bundled to `dist/worker.mjs`: one thread, one
 * job, with the publishers the service registers.
 */
import { serveAnalysisWorker } from './worker-main.js'
import { productionWiring } from './wiring.js'

serveAnalysisWorker(() => productionWiring())
