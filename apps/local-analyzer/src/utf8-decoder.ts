/**
 * A strict UTF-8 `TextDecoder` for a runtime without ICU — a platform adapter, like `text.ts`.
 *
 * nodejs-mobile builds Node 18.20.4 for Android with `--with-intl=none`. Its `TextDecoder` is Node's JavaScript
 * decoder (`makeTextDecoderJS` in lib/internal/encoding.js), which refuses the `fatal` option outright: making
 * `new TextDecoder('utf-8', { fatal: true })` throws ERR_NO_ICU. resvg's wasm-bindgen glue makes exactly that decoder
 * when its module is evaluated, so on a phone the analyzer bundle failed while it was being imported — before the
 * program said `hello` — and Node, treating the failed import as fatal, ended the whole `:analyzer` process
 * (APK 1324..1328 reported RUNTIME_STOPPED at once; desktop Node has ICU and never saw it).
 *
 * Where — and only where — the runtime refuses a strict UTF-8 decoder, `TextDecoder` is replaced by a subclass that
 * gives `fatal: true` its meaning for UTF-8: the bytes are checked against the WHATWG UTF-8 decoder's rules (shortest
 * form, no surrogates, nothing above U+10FFFF; an incomplete sequence is allowed only at the end of a streamed chunk)
 * and invalid input is a TypeError, as on a runtime with ICU. Decoding itself stays the runtime's own. Every other
 * request — another encoding with `fatal`, an unsupported label — is passed through and refused as before.
 *
 * This module installs the adapter when it is evaluated, so it must be the analyzer bundle's FIRST import
 * (`analyzer.ts`): ESM evaluates imports in order, and the glue that needs it is evaluated later.
 */

type DecoderOptions = { fatal?: boolean; ignoreBOM?: boolean }
type DecodeOptions = { stream?: boolean }
type Input = ArrayBuffer | SharedArrayBuffer | ArrayBufferView | undefined | null

export type Utf8DecoderSupport = 'native' | 'adapter'

const EMPTY = new Uint8Array(0)

/**
 * The length of a valid UTF-8 prefix that may be left incomplete at the end: -1 when `bytes` is invalid; otherwise
 * the number of trailing bytes that begin a sequence not yet complete (0 when the input ends on a boundary). With
 * `stream` false any incomplete tail is invalid.
 */
export function utf8Validity(bytes: Uint8Array, stream: boolean): number {
  let i = 0
  const n = bytes.length
  while (i < n) {
    const b = bytes[i]
    if (b < 0x80) {
      i += 1
      continue
    }
    let need: number
    let lo = 0x80
    let hi = 0xbf
    if (b >= 0xc2 && b <= 0xdf) need = 1
    else if (b >= 0xe0 && b <= 0xef) {
      need = 2
      if (b === 0xe0) lo = 0xa0
      else if (b === 0xed) hi = 0x9f
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3
      if (b === 0xf0) lo = 0x90
      else if (b === 0xf4) hi = 0x8f
    } else return -1
    for (let k = 1; k <= need; k++) {
      if (i + k >= n) return stream ? n - i : -1
      const c = bytes[i + k]
      if (c < (k === 1 ? lo : 0x80) || c > (k === 1 ? hi : 0xbf)) return -1
    }
    i += need + 1
  }
  return 0
}

const bytesOf = (input: Input): Uint8Array => {
  if (input === undefined || input === null) return EMPTY
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  return new Uint8Array(input)
}

const invalid = (): TypeError => Object.assign(new TypeError('The encoded data was not valid for encoding utf-8'), { code: 'ERR_ENCODING_INVALID_ENCODED_DATA' })

/** Whether this runtime makes a strict UTF-8 decoder itself. Only ERR_NO_ICU means it does not. */
export function runtimeDecodesUtf8Strictly(Decoder: typeof TextDecoder = globalThis.TextDecoder): boolean {
  try {
    new Decoder('utf-8', { fatal: true })
    return true
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ERR_NO_ICU') return false
    throw error
  }
}

/** The strict decoder over `Base`, a decoder that refuses `fatal`. Exported for the tests. */
export function strictUtf8Decoder(Base: typeof TextDecoder): typeof TextDecoder {
  // `fatal` is a getter on the prototype of a decoder; the strict one answers for itself
  const fatalOf = new WeakMap<object, boolean>()
  class StrictUtf8TextDecoder extends Base {
    readonly #fatal: boolean
    #pending: Uint8Array = EMPTY

    constructor(label: string = 'utf-8', options: DecoderOptions | null = {}) {
      const resolved = new Base(`${label}`).encoding
      const fatal = Boolean(options?.fatal)
      // anything but UTF-8 with `fatal` is the runtime's to refuse, exactly as before
      super(label, fatal && resolved === 'utf-8' ? { ...options, fatal: false } : (options ?? undefined))
      this.#fatal = fatal
      fatalOf.set(this, fatal)
    }

    override decode(input?: Input, options?: DecodeOptions | null): string {
      if (this.#fatal) {
        const stream = Boolean(options?.stream)
        const chunk = bytesOf(input)
        const all = this.#pending.length === 0 ? chunk : Uint8Array.from([...this.#pending, ...chunk])
        const tail = utf8Validity(all, stream)
        if (tail < 0) {
          this.#pending = EMPTY
          // an error ends the stream: what the runtime's decoder held is dropped with it
          super.decode()
          throw invalid()
        }
        this.#pending = tail > 0 ? all.slice(all.length - tail) : EMPTY
      }
      return super.decode((input ?? undefined) as Parameters<InstanceType<typeof TextDecoder>["decode"]>[0], options ?? undefined)
    }
  }
  Object.defineProperty(StrictUtf8TextDecoder.prototype, 'fatal', { configurable: true, get(this: object) { return fatalOf.get(this) ?? false } })
  Object.defineProperty(StrictUtf8TextDecoder, 'name', { value: 'TextDecoder' })
  return StrictUtf8TextDecoder as unknown as typeof TextDecoder
}

/** Install the adapter where the runtime refuses a strict UTF-8 decoder; on a runtime with ICU nothing changes. */
export function installStrictUtf8Decoder(): Utf8DecoderSupport {
  if (typeof globalThis.TextDecoder !== 'function' || runtimeDecodesUtf8Strictly()) return 'native'
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, writable: true, value: strictUtf8Decoder(globalThis.TextDecoder) })
  return 'adapter'
}

/** What the program reports in `hello`: set once, when this module is evaluated. */
export const UTF8_DECODER: Utf8DecoderSupport = installStrictUtf8Decoder()
