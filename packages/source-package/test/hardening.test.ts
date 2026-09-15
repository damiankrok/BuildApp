/**
 * Three defects found by reviewing this package's own test suite, and the
 * checks that keep them closed.
 *
 * The first is the one that mattered: an IPv6 address carrying a private IPv4
 * address inside it was only recognised in its dotted spelling, and
 * `dns.lookup` returns the compressed hex one. A hostile AAAA record pointing
 * at loopback therefore passed the SSRF guard.
 */
import { describe, expect, it } from 'vitest'
import jpeg from 'jpeg-js'
import { assertFetchable, DEFAULT_FETCH_POLICY, expandIPv6, isBlockedHostLiteral, isBlockedIPv6 } from '../src/net.js'
import { probeImage } from '../src/image.js'

describe('every spelling of an IPv4 address hidden inside an IPv6 one is blocked', () => {
  it('blocks loopback written dotted, compressed and fully expanded', () => {
    for (const form of ['::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:ffff:7f00:1', '::ffff:007f:0001']) expect(isBlockedIPv6(form), form).toBe(true)
  })

  it('blocks a private IPv4 address hidden the same way', () => {
    for (const form of ['::ffff:10.0.0.5', '::ffff:0a00:0005', '::ffff:169.254.169.254', '::ffff:a9fe:a9fe']) expect(isBlockedIPv6(form), form).toBe(true)
  })

  it('blocks the deprecated IPv4-compatible form and NAT64, which also reach an IPv4 host', () => {
    expect(isBlockedIPv6('::127.0.0.1')).toBe(true)
    expect(isBlockedIPv6('64:ff9b::7f00:1')).toBe(true)
  })

  it('still blocks the native private ranges, in any spelling', () => {
    for (const form of ['::1', '::', 'fe80::1', 'FE80:0:0:0:0:0:0:1', 'fd00::1', 'fc00::abcd', 'ff02::1', '2001:db8::1']) expect(isBlockedIPv6(form), form).toBe(true)
  })

  it('does not block a genuinely public IPv6 address', () => {
    for (const form of ['2606:4700:4700::1111', '2a00:1450:4001:80e::200e', '::ffff:93.184.216.34']) expect(isBlockedIPv6(form), form).toBe(false)
  })

  it('refuses rather than clears an address it cannot parse', () => {
    for (const form of ['::ffff:1::2', 'gggg::1', '1:2:3:4:5:6:7', 'not-an-address']) expect(isBlockedIPv6(form), form).toBe(true)
  })

  it('expands an address to eight groups, or says it cannot', () => {
    expect(expandIPv6('::ffff:127.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1])
    expect(expandIPv6('fe80::1')).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1])
    expect(expandIPv6('1:2:3:4:5:6:7:8')).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(expandIPv6('1::2::3')).toBeNull()
  })

  it('treats a bracketed literal as an address and not as a name to resolve', () => {
    // `new URL` normalises the dotted form to the compressed one, which is
    // exactly the form the old guard did not understand.
    expect(new URL('https://[::ffff:127.0.0.1]/').hostname).toBe('[::ffff:7f00:1]')
    expect(isBlockedHostLiteral('[::ffff:7f00:1]')).toBe(true)
  })

  it('refuses a public NAME whose AAAA answer is a mapped loopback address', async () => {
    for (const answer of ['::ffff:7f00:1', '::ffff:127.0.0.1', '0:0:0:0:0:ffff:7f00:1', '::ffff:0a00:0005']) {
      await expect(assertFetchable('https://sneaky.example.com/x', DEFAULT_FETCH_POLICY, async () => [answer]), answer).rejects.toThrow(/not publicly routable/)
    }
  })

  it('refuses a bracketed private literal without ever consulting the resolver', async () => {
    let asked = 0
    await expect(
      assertFetchable('https://[::ffff:127.0.0.1]/x', DEFAULT_FETCH_POLICY, async () => {
        asked += 1
        return ['93.184.216.34']
      }),
    ).rejects.toThrow(/loopback, private, link-local/)
    expect(asked).toBe(0)
  })

  it('still accepts an ordinary public host answering with both families', async () => {
    const url = await assertFetchable('https://example.com/x', DEFAULT_FETCH_POLICY, async () => ['93.184.216.34', '2606:4700:4700::1111'])
    expect(url.href).toBe('https://example.com/x')
  })
})

describe('a JPEG padded with legal fill bytes is still an image', () => {
  const encode = (w: number, h: number): Uint8Array => new Uint8Array(jpeg.encode({ data: new Uint8Array(w * h * 4).fill(200), width: w, height: h } as never, 80).data)

  it('reads the frame size past any number of 0xFF pad octets before a marker', () => {
    const plain = encode(16, 9)
    expect(probeImage(plain)?.size).toEqual({ width: 16, height: 9 })
    for (const pad of [1, 2, 5]) {
      const padded = new Uint8Array([...plain.subarray(0, 2), ...Array.from({ length: pad }, () => 0xff), ...plain.subarray(2)])
      expect(probeImage(padded)?.size, `${pad} fill bytes`).toEqual({ width: 16, height: 9 })
    }
  })
})
