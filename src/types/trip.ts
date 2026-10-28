export type Trip = {
  id: string
  name: string
  destination: string
  homeCurrency: string
  budget: number
  createdAt: string
}

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
  createdAt: string
}
