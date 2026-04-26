export interface CalendarDayPrice {
  amount: number
  currency: string
  formatted: string
}

export interface CalendarDayStatus {
  reason: string
  source: string | null
  sourceType: string
  available: boolean
}

export interface CalendarDay {
  date: string
  day: string
  minStay: number
  closedForCheckin: boolean
  closedForCheckout: boolean
  status: CalendarDayStatus
  price: CalendarDayPrice
}

export interface CalendarData {
  listingId: string
  provider: string
  startDate: string
  endDate: string
  days: CalendarDay[]
}

export interface CalendarUpdate {
  date: string
  price?: { amount: number }
  available?: boolean
  minStay?: number
  /** Block check-in on this date. Useful for enforcing min-stay edges. */
  closedForCheckin?: boolean
  /** Block check-out on this date. Useful for enforcing min-stay edges. */
  closedForCheckout?: boolean
  /** Per-date note. Pass `null` to clear. Max 512 chars. */
  note?: string | null
}
