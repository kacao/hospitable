import { createHmac, timingSafeEqual } from 'node:crypto'

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
   */
  rawBody: string | Buffer | Uint8Array
  /**
   * The signature header value received from Hospitable. If the header
   * contains a `algo=` prefix (e.g. `sha256=abc123…`), it is stripped
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
 * Returns `true` when the signature is valid and (if supplied) the
 * timestamp is within tolerance. Returns `false` for any mismatch, malformed
 * input, or stale payload. Never throws for signature mismatch — throwing
 * on verification failure invites a DoS where crafted bodies crash the
 * receiver.
 *
 * Uses `crypto.timingSafeEqual` for the comparison to prevent side-channel
 * leaks of the expected signature byte-by-byte.
 *
 * @example
 * ```ts
 * // Express route handler — be sure to capture the raw body.
 * app.post('/webhooks/hospitable', express.raw({ type: 'application/json' }), (req, res) => {
 *   const ok = verifyWebhookSignature({
 *     rawBody: req.body,
 *     signatureHeader: req.header('X-Hospitable-Signature') ?? '',
 *     secret: process.env.HOSPITABLE_WEBHOOK_SECRET!,
 *   })
 *   if (!ok) return res.status(401).end()
 *   const payload = JSON.parse(req.body.toString('utf8'))
 *   // ... handle payload ...
 *   res.status(200).end()
 * })
 * ```
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export function verifyWebhookSignature(opts: VerifyWebhookSignatureOptions): boolean {
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

  const bodyBytes = coerceToBuffer(rawBody)
  const signedPayload =
    timestamp !== undefined
      ? Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), bodyBytes])
      : bodyBytes

  const expected = createHmac(algorithm, secret).update(signedPayload).digest()

  // Strip an algo prefix like `sha256=…` that some providers include.
  // Only strip when the leading segment is a short alphanumeric name
  // followed by `=` — otherwise a base64 header with padding (`=` chars)
  // would be incorrectly truncated.
  const prefixMatch = signatureHeader.match(/^[A-Za-z][A-Za-z0-9]{1,15}=(.+)$/)
  const headerValue = prefixMatch ? prefixMatch[1]! : signatureHeader

  let provided: Buffer
  try {
    provided = Buffer.from(headerValue, encoding)
  } catch {
    return false
  }

  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

function coerceToBuffer(body: string | Buffer | Uint8Array): Buffer {
  if (typeof body === 'string') return Buffer.from(body, 'utf8')
  if (Buffer.isBuffer(body)) return body
  return Buffer.from(body)
}
