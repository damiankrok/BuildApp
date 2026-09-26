/**
 * A fixed-window counter per client.
 *
 * Abuse control for a public preview that holds no secret: a client may
 * submit so many analyses per window, and read so many times. The key is the
 * client's address (behind a trusted proxy, the last `X-Forwarded-For` entry — the one the proxy appended).
 * It is not identity and is not meant to be; it bounds what one address can
 * cost the service, which is the point.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Count one request; `ok: false` with the seconds until the window resets when over the limit. */
  take(key: string, now: number = Date.now()): { ok: true } | { ok: false; retryAfterS: number } {
    if (this.windows.size > 50_000) this.sweep(now)
    let w = this.windows.get(key)
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + this.windowMs }
      this.windows.set(key, w)
    }
    if (w.count >= this.max) return { ok: false, retryAfterS: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) }
    w.count += 1
    return { ok: true }
  }

  sweep(now: number = Date.now()): void {
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k)
  }
}
