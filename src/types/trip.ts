export type Trip = {
  id: string
  name: string
  destination: string
  homeCurrency: string
  budget: number
  startDate?: string
  endDate?: string
  createdAt: string
}

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'activities'
  | 'shopping'
  | 'general'

export type Expense = {
  id: string
  tripId: string
  description: string
  amount: number
  currency: string
  homeCurrency: string
  homeAmount: number
  rate: number
  rateDate: string
  category?: ExpenseCategory
  date?: string
  notes?: string
  activityId?: string
  createdAt: string
}

export type ItineraryActivity = {
  id: string
  tripId: string
  date: string
  title: string
  startTime?: string
  endTime?: string
  locationName?: string
  locationAddress?: string
  notes?: string
  completed?: boolean
  createdAt: string
}
