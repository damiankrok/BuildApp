/**
 * The emscripten glue of libwebp's decoder (`@jsquash/webp`). Its own declaration needs the DOM library and the
 * package's global emscripten types; the factory is used here only to fill a module object synchronously.
 */
declare module '@jsquash/webp/codec/dec/webp_dec.js' {
  const factory: (module: Record<string, unknown>) => Promise<unknown>
  export default factory
}
