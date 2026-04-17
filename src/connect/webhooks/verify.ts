/**
 * Digest algorithm used to compute the HMAC. `sha256` is the default and
 * what Hospitable uses; `sha1` is supported only for legacy compatibility.
 */
export type WebhookSignatureAlgorithm = 'sha256' | 'sha1'

/**
 * Encoding of the signature as sent in the HTTP header. Hex is the
 * Hospitable default; base64 is supported for callers who bridge from
 * other webhook providers.
 */
export type WebhookSignatureEncoding = 'hex' | 'base64'

export interface VerifyWebhookSignatureOptions {
  /**
   * The raw request body, exactly as received. Do NOT pass the parsed
   * JSON — the byte-for-byte original is required for the HMAC to match.
   * Most frameworks expose this as `req.rawBody`, `request.body` (when
   * configured for raw), or the result of a `body-parser`-style raw reader.
   *
   * Node's `Buffer` is accepted transparently since it extends
   * `Uint8Array`; the SDK itself doesn't depend on `@types/node`.
   */
  rawBody: string | Uint8Array
  /**
   * The signature header value received from Hospitable. If the header
   * contains an `algo=` prefix (e.g. `sha256=abc123…`), it is stripped
   * automatically before comparison.
   */
  signatureHeader: string
  /**
   * The shared secret configured when the webhook was registered in the
   * Hospitable Partner Portal. Store this in an env var or secret manager
   * — never hardcode it.
   */
  secret: string
  /** Defaults to `'sha256'`. */
  algorithm?: WebhookSignatureAlgorithm
  /** Defaults to `'hex'`. */
  encoding?: WebhookSignatureEncoding
  /**
   * Optional timestamp header value. When supplied, the signed payload is
   * `` `${timestamp}.${rawBody}` `` — a common anti-replay scheme. Pair
   * this with {@link toleranceSeconds} to reject stale deliveries.
   */
  timestamp?: string
  /**
   * Maximum age in seconds allowed for a timestamped payload. Signatures
   * older than this (relative to `Date.now()`) are rejected. Only consulted
   * when {@link timestamp} is provided. Defaults to 300 (5 minutes).
   */
  toleranceSeconds?: number
}

/**
 * Verify the HMAC signature on an incoming Hospitable Connect webhook.
 *
 * Hospitable signs every webhook delivery with a shared secret; verifying
 * the signature is the caller's responsibility and is mandatory for any
 * production integration — without it, an attacker who knows your webhook
 * URL can forge events and trigger arbitrary downstream behavior in your
 * tenant.
 *
 * Resolves to `true` when the signature is valid and (if supplied) the
 * timestamp is within tolerance. Resolves to `false` for any mismatch,
 * malformed input, or stale payload. Never throws for signature mismatch
 * — throwing on verification failure invites a DoS where crafted bodies
 * crash the receiver.
 *
 * Uses a constant-time comparison to prevent side-channel leaks of the
 * expected signature byte-by-byte.
 *
 * Implemented via Web Crypto (`globalThis.crypto.subtle`) so the SDK
 * stays free of `@types/node`. Works on Node 20+ (native) and in any
 * runtime that ships Web Crypto.
 *
 * @example
 * ```ts
 * // Express route handler — be sure to capture the raw body.
 * app.post('/webhooks/hospitable', express.raw({ type: 'application/json' }), async (req, res) => {
 *   const ok = await verifyWebhookSignature({
 *     rawBody: req.body,
 *     signatureHeader: req.header('X-Hospitable-Signature') ?? '',
 *     secret: process.env.HOSPITABLE_WEBHOOK_SECRET!,
 *   })
 *   if (!ok) return res.status(401).end()
 *   const payload = JSON.parse(new TextDecoder().decode(req.body))
 *   // ... handle payload ...
 *   res.status(200).end()
 * })
 * ```
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export async function verifyWebhookSignature(
  opts: VerifyWebhookSignatureOptions,
): Promise<boolean> {
  const {
    rawBody,
    signatureHeader,
    secret,
    algorithm = 'sha256',
    encoding = 'hex',
    timestamp,
    toleranceSeconds = 300,
  } = opts

  if (!signatureHeader || !secret) return false

  if (timestamp !== undefined) {
    const ts = Number(timestamp)
    if (!Number.isFinite(ts)) return false
    const ageSeconds = Math.abs(Date.now() / 1000 - ts)
    if (ageSeconds > toleranceSeconds) return false
  }

  const bodyBytes = toBytes(rawBody)
  const signedPayload =
    timestamp !== undefined ? concatBytes(toBytes(`${timestamp}.`), bodyBytes) : bodyBytes

  const encoder = new TextEncoder()
  const keyMaterial = encoder.encode(secret)
  // Cast to ArrayBuffer: TextEncoder.encode returns Uint8Array<ArrayBufferLike>
  // in newer TS lib, but Web Crypto's BufferSource requires ArrayBuffer-backed.
  // The underlying buffer is always ArrayBuffer (never SharedArrayBuffer) in
  // this code path, so the cast is runtime-safe.
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial.buffer as ArrayBuffer,
    { name: 'HMAC', hash: { name: algorithm === 'sha1' ? 'SHA-1' : 'SHA-256' } },
    false,
    ['sign'],
  )
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, signedPayload.buffer as ArrayBuffer),
  )

  const prefixMatch = signatureHeader.match(/^[A-Za-z][A-Za-z0-9]{1,15}=(.+)$/)
  const headerValue = prefixMatch ? prefixMatch[1]! : signatureHeader

  const provided = decodeSignature(headerValue, encoding)
  if (provided === null) return false
  if (provided.length !== expected.length) return false
  return constantTimeEqual(provided, expected)
}

function toBytes(body: string | Uint8Array): Uint8Array {
  if (typeof body === 'string') return new TextEncoder().encode(body)
  // Copy into a fresh, tightly-bounded Uint8Array. Node's `Buffer` is a
  // subclass of Uint8Array but shares an underlying pool across many
  // Buffer instances — `buf.buffer` can be much larger than the logical
  // bytes of `buf`, with `byteOffset` / `byteLength` carving out the
  // slice. `crypto.subtle.sign(..., buf.buffer)` would then sign the
  // entire pool, producing a wrong HMAC. The copy here normalizes any
  // input (Buffer or plain Uint8Array) to an exact-length ArrayBuffer.
  const out = new Uint8Array(body.length)
  out.set(body)
  return out
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function decodeSignature(
  value: string,
  encoding: WebhookSignatureEncoding,
): Uint8Array | null {
  if (encoding === 'hex') {
    if (value.length === 0 || value.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(value)) {
      return null
    }
    const out = new Uint8Array(value.length / 2)
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16)
    }
    return out
  }
  // base64
  try {
    const binary = atob(value)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}
