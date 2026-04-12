/**
 * A single enrichment field on a reservation — key/value metadata that
 * agents or integrations attach to a booking for downstream workflows
 * (e.g. guest verification status, arrival time, parking instructions).
 *
 * @see GET https://public.api.hospitable.com/v2/reservations/{id}/enrichment
 */
export interface EnrichmentField {
  key: string
  value: string | null
  description: string
  example: string
}
