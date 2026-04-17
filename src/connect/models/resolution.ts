import type { Financial } from './shared'

/**
 * A resolution is an OTA-mediated dispute between guest and host —
 * typically a security-deposit claim, damage claim, or refund request.
 *
 * - `initiator*` and `responder*` identify the two parties on the OTA.
 * - `status` / `statusText` describe progress (open / closed, etc.).
 * - `amountRequested` / `amountPaid` / `amountCharged` are the three
 *   money perspectives tracked through resolution lifecycle.
 *
 * **Beta endpoint**: the Connect resolutions surface is in development;
 * field shapes may shift. `isCxInitiated` marks whether the platform's
 * support team opened the case.
 *
 * @see https://developer.hospitable.com/docs/connect-api-docs
 */
export interface Resolution {
  id: string
  platform: string
  platformId: string
  initiatorPlatformId: string
  initiatorName: string
  responderPlatformId: string
  responderName: string
  reservationPlatformId: string
  reasonName: string
  status: string
  statusText: string
  currency: string
  amountRequested: Financial
  amountPaid: Financial
  amountCharged: Financial
  date: string
  isCxInitiated: boolean
  detailLink: string
}
