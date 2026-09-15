import { describe, expect, it } from 'vitest'
import { DecodeFailed, decodeImage, mediaTypeOfFormat, probeImage } from '../src/index.js'
import { gifBytes, jpegBytes, jpegComment, pngBytes, spliceAfterSoi, utf8 } from './helpers.js'

/**
 * Image identity is the anti-bug core of this package: every dimension a later
 * stage measures against comes from HERE, out of the encoded bytes, and never
 * out of a filename, a `Content-Type` or an HTML attribute. Each case below
 * therefore builds bytes whose true size is known by construction rather than
 * by assertion about a checked-in file.
 */
describe('probeImage — real dimensions, read out of the bytes', () => {
  it('reads the true size and format of a PNG, a GIF and a JPEG, none of them square so a transposed read cannot pass', () => {
    // deliberately non-square, and deliberately different per format: a probe that
    // swapped width and height, or that read the wrong container field, would agree
    // with a square image and disagree here.
    expect(probeImage(pngBytes(37, 11))).toEqual({ format: 'png', size: { width: 37, height: 11 } })
    expect(probeImage(gifBytes(23, 5))).toEqual({ format: 'gif', size: { width: 23, height: 5 } })
    expect(probeImage(jpegBytes(47, 23))).toEqual({ format: 'jpeg', size: { width: 47, height: 23 } })
    // the media type the package records for a variant is the one the BYTES imply
    expect(mediaTypeOfFormat('png')).toBe('image/png')
  })

  it('reads sizes past the 8-bit boundary, where a byte-wide read would silently wrap', () => {
    // 260 does not fit in one byte; a GIF's screen descriptor is little-endian 16-bit
    // and a PNG's IHDR is big-endian 32-bit, so a half-read of either yields 4, not 260.
    expect(probeImage(gifBytes(260, 300))?.size).toEqual({ width: 260, height: 300 })
    expect(probeImage(pngBytes(260, 300))?.size).toEqual({ width: 260, height: 300 })
    expect(probeImage(jpegBytes(260, 300))?.size).toEqual({ width: 260, height: 300 })
  })

  it('returns the FRAME size of a JPEG even when a JFIF APP0 and a COM segment precede the frame header', () => {
    // A JPEG's real size lives only in the SOF marker, which an encoder puts after its
    // APP0/JFIF header and after any comment. A probe that read a fixed offset, or that
    // stopped at the first segment it recognised, would report the JFIF density or
    // nothing at all. The comment is padded so the frame sits far from the file start.
    const plain = jpegBytes(47, 23)
    const comment = jpegComment(`drawing note ${'x'.repeat(400)}`)
    const withComment = spliceAfterSoi(plain, comment)
    expect(withComment.length).toBe(plain.length + comment.length)
    // the frame header really is buried: byte 2 is now the comment marker, not SOF
    expect([withComment[2], withComment[3]]).toEqual([0xff, 0xfe])
    expect(probeImage(withComment)).toEqual({ format: 'jpeg', size: { width: 47, height: 23 } })
    // and the bytes still decode, so the frame the probe found is the frame that was decoded
    expect(decodeImage(withComment).width).toBe(47)
  })

  it('refuses bytes that are not an image it understands, rather than guessing a size', () => {
    expect(probeImage(utf8('<!doctype html><html><body>not an image</body></html>'))).toBeNull()
    expect(probeImage(new Uint8Array([1, 2, 3]))).toBeNull()
    // a PNG signature with no IHDR chunk is not a PNG whose size can be read
    const truncated = pngBytes(8, 8).slice()
    truncated.set(utf8('IHDx'), 12)
    expect(probeImage(truncated)).toBeNull()
  })
})

describe('decodeImage — the decoder is cross-checked against the container header', () => {
  it('decodes each supported format to a raster of exactly the probed size, in RGBA', () => {
    for (const bytes of [pngBytes(9, 4), gifBytes(9, 4), jpegBytes(9, 4)]) {
      const raster = decodeImage(bytes)
      expect([raster.width, raster.height]).toEqual([9, 4])
      // RGBA, row-major: four channels per pixel and nothing else
      expect(raster.data.length).toBe(9 * 4 * 4)
    }
  })

  it('throws SIZE_MISMATCH when the container header advertises one frame size and the decoder reads another', () => {
    // Bytes whose header and pixels disagree are not trustworthy, and the layer must say
    // so rather than silently prefer one of them: preferring the header mis-scales every
    // measurement, preferring the pixels hides that the file is malformed.
    //
    // Constructed by declaring a DRI segment longer than its contents. A spec-following
    // marker walk (the probe) skips the declared length and lands on the decoy frame
    // header planted inside the following comment; jpeg-js consumes DRI's fixed six
    // bytes instead and reads the real 8x8 frame further on.
    const decoy = [
      0xff, 0xdd, 0x00, 0x08, 0x00, 0x00, // DRI declaring 8 bytes, of which the decoder reads 6
      0xff, 0xfe, 0x00, 0x0e, // COM of 14 bytes, whose payload hides the decoy
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x40, 0x00, 0x40, // decoy SOF0: "64x64"
      0x00, 0x00, 0x00,
    ]
    const bytes = spliceAfterSoi(jpegBytes(8, 8), decoy)
    expect(probeImage(bytes)?.size).toEqual({ width: 64, height: 64 })
    try {
      decodeImage(bytes)
      expect.unreachable('a header/decoder disagreement must not decode')
    } catch (e) {
      expect(e).toBeInstanceOf(DecodeFailed)
      expect((e as DecodeFailed).code).toBe('SIZE_MISMATCH')
      // the message must name BOTH readings, so an auditor can see which side is wrong
      expect((e as DecodeFailed).message).toContain('64x64')
      expect((e as DecodeFailed).message).toContain('8x8')
    }
  })

  it('throws UNSUPPORTED_FORMAT for bytes that are not an image, and for an image format it has no decoder for', () => {
    const html = utf8('<!doctype html><html><body>an error page served with a 200</body></html>')
    expect(() => decodeImage(html)).toThrow(DecodeFailed)
    try {
      decodeImage(html)
    } catch (e) {
      expect((e as DecodeFailed).code).toBe('UNSUPPORTED_FORMAT')
    }
    // a BMP is recognised by the prober (so its size is known) but has no decoder here;
    // that is an honest UNSUPPORTED_FORMAT, not a CORRUPT claim about valid bytes
    const bmp = new Uint8Array(30)
    bmp.set(utf8('BM'), 0)
    new DataView(bmp.buffer).setUint32(18, 12, true)
    new DataView(bmp.buffer).setUint32(22, 7, true)
    expect(probeImage(bmp)).toEqual({ format: 'bmp', size: { width: 12, height: 7 } })
    try {
      decodeImage(bmp)
      expect.unreachable('a BMP has no decoder in this layer')
    } catch (e) {
      expect((e as DecodeFailed).code).toBe('UNSUPPORTED_FORMAT')
    }
  })

  it('throws CORRUPT — not a size — when the bytes claim a format they do not honour', () => {
    // a truncated GIF still has a readable screen descriptor, so the probe succeeds and
    // only the decoder can tell that the pixels are gone. The distinction matters: a
    // CORRUPT asset is a fetch worth retrying, an UNSUPPORTED one is not.
    const gif = gifBytes(16, 16)
    const truncated = gif.slice(0, 40)
    expect(probeImage(truncated)?.size).toEqual({ width: 16, height: 16 })
    try {
      decodeImage(truncated)
      expect.unreachable('truncated pixel data must not decode')
    } catch (e) {
      expect((e as DecodeFailed).code).toBe('CORRUPT')
    }
  })
})
