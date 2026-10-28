export type Currency = {
  iso_code: string
  name: string
  symbol: string | null
}

export type ExchangeRate = {
  date: string
  base: string
  quote: string
  rate: number
}
