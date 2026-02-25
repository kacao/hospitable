export interface PriceAmount {
  amount: number
  currency: string
}

export interface CalendarDay {
  date: string
  available: boolean
  price: PriceAmount
  minStay: number
  maxStay: number | null
  notes: string | null
  blockedReason: string | null
}

export interface CalendarUpdate {
  date: string
  price?: { amount: number }
  available?: boolean
  minStay?: number
  maxStay?: number | null
  notes?: string | null
}

export interface CalendarGetParams {
  startDate: string
  endDate: string
}
