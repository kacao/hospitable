import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhookSignature } from '../../connect/webhooks/verify'

const SECRET = 'test-secret-do-not-use-in-prod'
const BODY = JSON.stringify({ id: '01HW', action: 'reservation.created', data: {} })

function sign(body: string, secret: string, algo: 'sha256' | 'sha1' = 'sha256'): string {
  return createHmac(algo, secret).update(body).digest('hex')
}

describe('verifyWebhookSignature', () => {
  it('returns true for a correctly-signed body', () => {
    const signature = sign(BODY, SECRET)
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: signature,
        secret: SECRET,
      }),
    ).toBe(true)
  })

  it('returns false when the signature is tampered by a single byte', () => {
    const signature = sign(BODY, SECRET)
    const tampered = signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0')
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: tampered,
        secret: SECRET,
      }),
    ).toBe(false)
  })

  it('returns false when the body is tampered', () => {
    const signature = sign(BODY, SECRET)
    expect(
      verifyWebhookSignature({
        rawBody: BODY + ' ',
        signatureHeader: signature,
        secret: SECRET,
      }),
    ).toBe(false)
  })

  it('returns false when the secret is wrong', () => {
    const signature = sign(BODY, SECRET)
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: signature,
        secret: 'wrong-secret',
      }),
    ).toBe(false)
  })

  it('returns false on empty signatureHeader', () => {
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: '',
        secret: SECRET,
      }),
    ).toBe(false)
  })

  it('returns false on empty secret', () => {
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: sign(BODY, SECRET),
        secret: '',
      }),
    ).toBe(false)
  })

  it('strips an algo= prefix from the header (e.g. "sha256=abc…")', () => {
    const signature = sign(BODY, SECRET)
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: `sha256=${signature}`,
        secret: SECRET,
      }),
    ).toBe(true)
  })

  it('supports Buffer rawBody', () => {
    const buf = Buffer.from(BODY, 'utf8')
    expect(
      verifyWebhookSignature({
        rawBody: buf,
        signatureHeader: sign(BODY, SECRET),
        secret: SECRET,
      }),
    ).toBe(true)
  })

  it('supports Uint8Array rawBody', () => {
    const arr = new TextEncoder().encode(BODY)
    expect(
      verifyWebhookSignature({
        rawBody: arr,
        signatureHeader: sign(BODY, SECRET),
        secret: SECRET,
      }),
    ).toBe(true)
  })

  it('supports base64-encoded headers when encoding: "base64"', () => {
    const b64 = createHmac('sha256', SECRET).update(BODY).digest('base64')
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: b64,
        secret: SECRET,
        encoding: 'base64',
      }),
    ).toBe(true)
  })

  it('supports sha1 for legacy providers', () => {
    const sig = sign(BODY, SECRET, 'sha1')
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: sig,
        secret: SECRET,
        algorithm: 'sha1',
      }),
    ).toBe(true)
  })

  it('returns false when sha256 header is validated against sha1', () => {
    const sig = sign(BODY, SECRET, 'sha256')
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: sig,
        secret: SECRET,
        algorithm: 'sha1',
      }),
    ).toBe(false)
  })

  it('returns false on malformed hex (length-mismatch rejection path)', () => {
    expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: 'not-hex',
        secret: SECRET,
      }),
    ).toBe(false)
  })

  describe('timestamped signing (anti-replay)', () => {
    const NOW_SECONDS = 1_700_000_000

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW_SECONDS * 1000)
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('accepts a payload signed as `${timestamp}.${body}` within tolerance', () => {
      const timestamp = String(NOW_SECONDS)
      const signedPayload = `${timestamp}.${BODY}`
      const signature = sign(signedPayload, SECRET)
      expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: signature,
          secret: SECRET,
          timestamp,
        }),
      ).toBe(true)
    })

    it('rejects a payload older than toleranceSeconds', () => {
      const timestamp = String(NOW_SECONDS - 600)
      const signedPayload = `${timestamp}.${BODY}`
      const signature = sign(signedPayload, SECRET)
      expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: signature,
          secret: SECRET,
          timestamp,
          toleranceSeconds: 300,
        }),
      ).toBe(false)
    })

    it('rejects a non-numeric timestamp', () => {
      expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: sign(BODY, SECRET),
          secret: SECRET,
          timestamp: 'not-a-number',
        }),
      ).toBe(false)
    })

    it('uses default toleranceSeconds of 300 when unspecified', () => {
      // 299 seconds old — inside default window
      const tsInside = String(NOW_SECONDS - 299)
      const sigInside = sign(`${tsInside}.${BODY}`, SECRET)
      expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: sigInside,
          secret: SECRET,
          timestamp: tsInside,
        }),
      ).toBe(true)

      // 301 seconds old — outside default window
      const tsOutside = String(NOW_SECONDS - 301)
      const sigOutside = sign(`${tsOutside}.${BODY}`, SECRET)
      expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: sigOutside,
          secret: SECRET,
          timestamp: tsOutside,
        }),
      ).toBe(false)
    })
  })

  it('never throws on mismatched input (DoS guard)', () => {
    // A hostile sender could craft a body or header designed to crash the
    // handler. Verify that verify() contains all failure modes and returns
    // a clean boolean rather than bubbling an exception.
    expect(() =>
      verifyWebhookSignature({
        rawBody: '',
        signatureHeader: '!!@@@',
        secret: SECRET,
      }),
    ).not.toThrow()
  })
})
