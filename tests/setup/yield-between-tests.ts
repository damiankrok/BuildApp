/**
 * A macrotask yield between tests, in every worker.
 *
 * The fixture and mutation suites run the whole pipeline synchronously for
 * seconds at a time, test after test. Vitest's worker reports each finished
 * test to the runner over an RPC and waits, with a sixty-second deadline,
 * for the acknowledgement — which arrives as a message the worker can only
 * receive when its event loop turns. A file whose tests together block for
 * more than a minute never turns it, the deadline passes, and a run in which
 * every test passed is reported as a failure with an "unhandled error".
 *
 * One zero-millisecond timer before each test lets the loop turn, the
 * acknowledgements land, and the deadline never has a chance to fire. It
 * costs nothing measurable across a thousand tests.
 */
import { beforeEach } from 'vitest'

beforeEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
})
