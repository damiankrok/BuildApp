/** Minimal declarations for `omggif`, which ships no types. Only the first-frame decode this layer uses is declared. */
declare module 'omggif' {
  export class GifReader {
    constructor(bytes: Uint8Array)
    readonly width: number
    readonly height: number
    numFrames(): number
    decodeAndBlitFrameRGBA(index: number, pixels: Uint8Array): void
  }
}
