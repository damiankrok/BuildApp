/**
 * `AbortSignal.any`, for a runtime that lacks it.
 *
 * The same analysis runs under Node 22 on a server and under the embedded
 * Node 18 of the Android app (nodejs-mobile 18.20.4), and `AbortSignal.any`
 * arrived in Node 20.3. Where the runtime has it, it is used as is; where it
 * does not, one controller follows every input and aborts, with that input's
 * reason, when the first of them does. Either way the result is the same
 * signal semantics — this is a platform shim, not a second behaviour.
 */
type AbortSignalWithAny = typeof AbortSignal & { any?: (signals: AbortSignal[]) => AbortSignal }

export function anySignal(signals: readonly AbortSignal[], native: boolean = typeof (AbortSignal as AbortSignalWithAny).any === 'function'): AbortSignal {
  if (signals.length === 1) return signals[0]
  if (native) return (AbortSignal as AbortSignalWithAny).any!([...signals])
  const controller = new AbortController()
  const already = signals.find((s) => s.aborted)
  if (already) {
    controller.abort(already.reason)
    return controller.signal
  }
  const listeners: Array<[AbortSignal, () => void]> = []
  const release = (): void => {
    for (const [s, l] of listeners) s.removeEventListener('abort', l)
  }
  for (const s of signals) {
    const onAbort = (): void => {
      release()
      controller.abort(s.reason)
    }
    listeners.push([s, onAbort])
    s.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}
