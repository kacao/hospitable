import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhookSignature } from '../../connect/webhooks/verify'

const SECRET = 'test-secret-do-not-use-in-prod'
const BODY = JSON.stringify({ id: '01HW', action: 'reservation.created', data: {} })

function sign(body: string, secret: string, algo: 'sha256' | 'sha1' = 'sha256'): string {
  return createHmac(algo, secret).update(body).digest('hex')
}

describe('verifyWebhookSignature', () => {
  it('returns true for a correctly-signed body', async () => {
    const signature = sign(BODY, SECRET)
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: signature,
        secret: SECRET,
      }),
    ).resolves.toBe(true)
  })

  it('returns false when the signature is tampered by a single byte', async () => {
    const signature = sign(BODY, SECRET)
    const tampered = signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0')
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: tampered,
        secret: SECRET,
      }),
    ).resolves.toBe(false)
  })

  it('returns false when the body is tampered', async () => {
    const signature = sign(BODY, SECRET)
    await expect(
      verifyWebhookSignature({
        rawBody: BODY + ' ',
        signatureHeader: signature,
        secret: SECRET,
      }),
    ).resolves.toBe(false)
  })

  it('returns false when the secret is wrong', async () => {
    const signature = sign(BODY, SECRET)
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: signature,
        secret: 'wrong-secret',
      }),
    ).resolves.toBe(false)
  })

  it('returns false on empty signatureHeader', async () => {
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: '',
        secret: SECRET,
      }),
    ).resolves.toBe(false)
  })

  it('returns false on empty secret', async () => {
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: sign(BODY, SECRET),
        secret: '',
      }),
    ).resolves.toBe(false)
  })

  it('strips an algo= prefix from the header (e.g. "sha256=abc…")', async () => {
    const signature = sign(BODY, SECRET)
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: `sha256=${signature}`,
        secret: SECRET,
      }),
    ).resolves.toBe(true)
  })

  it('supports Uint8Array rawBody', async () => {
    const arr = new TextEncoder().encode(BODY)
    await expect(
      verifyWebhookSignature({
        rawBody: arr,
        signatureHeader: sign(BODY, SECRET),
        secret: SECRET,
      }),
    ).resolves.toBe(true)
  })

  it('supports Buffer rawBody (Buffer extends Uint8Array)', async () => {
    // Buffer is a Node subclass of Uint8Array; the SDK typechecks against
    // Uint8Array only so Node's Buffer works at runtime without forcing a
    // @types/node dependency on downstream consumers.
    const buf = Buffer.from(BODY, 'utf8')
    await expect(
      verifyWebhookSignature({
        rawBody: buf,
        signatureHeader: sign(BODY, SECRET),
        secret: SECRET,
      }),
    ).resolves.toBe(true)
  })

  it('supports base64-encoded headers when encoding: "base64"', async () => {
    const b64 = createHmac('sha256', SECRET).update(BODY).digest('base64')
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: b64,
        secret: SECRET,
        encoding: 'base64',
      }),
    ).resolves.toBe(true)
  })

  it('supports sha1 for legacy providers', async () => {
    const sig = sign(BODY, SECRET, 'sha1')
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: sig,
        secret: SECRET,
        algorithm: 'sha1',
      }),
    ).resolves.toBe(true)
  })

  it('returns false when sha256 header is validated against sha1', async () => {
    const sig = sign(BODY, SECRET, 'sha256')
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: sig,
        secret: SECRET,
        algorithm: 'sha1',
      }),
    ).resolves.toBe(false)
  })

  it('returns false on malformed hex (length-mismatch rejection path)', async () => {
    await expect(
      verifyWebhookSignature({
        rawBody: BODY,
        signatureHeader: 'not-hex',
        secret: SECRET,
      }),
    ).resolves.toBe(false)
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

    it('accepts a payload signed as `${timestamp}.${body}` within tolerance', async () => {
      const timestamp = String(NOW_SECONDS)
      const signedPayload = `${timestamp}.${BODY}`
      const signature = sign(signedPayload, SECRET)
      await expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: signature,
          secret: SECRET,
          timestamp,
        }),
      ).resolves.toBe(true)
    })

    it('rejects a payload older than toleranceSeconds', async () => {
      const timestamp = String(NOW_SECONDS - 600)
      const signedPayload = `${timestamp}.${BODY}`
      const signature = sign(signedPayload, SECRET)
      await expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: signature,
          secret: SECRET,
          timestamp,
          toleranceSeconds: 300,
        }),
      ).resolves.toBe(false)
    })

    it('rejects a non-numeric timestamp', async () => {
      await expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: sign(BODY, SECRET),
          secret: SECRET,
          timestamp: 'not-a-number',
        }),
      ).resolves.toBe(false)
    })

    it('uses default toleranceSeconds of 300 when unspecified', async () => {
      const tsInside = String(NOW_SECONDS - 299)
      const sigInside = sign(`${tsInside}.${BODY}`, SECRET)
      await expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: sigInside,
          secret: SECRET,
          timestamp: tsInside,
        }),
      ).resolves.toBe(true)

      const tsOutside = String(NOW_SECONDS - 301)
      const sigOutside = sign(`${tsOutside}.${BODY}`, SECRET)
      await expect(
        verifyWebhookSignature({
          rawBody: BODY,
          signatureHeader: sigOutside,
          secret: SECRET,
          timestamp: tsOutside,
        }),
      ).resolves.toBe(false)
    })
  })

  it('never throws on mismatched input (DoS guard)', async () => {
    await expect(
      verifyWebhookSignature({
        rawBody: '',
        signatureHeader: '!!@@@',
        secret: SECRET,
      }),
    ).resolves.toBe(false)
  })
})
