export function parseAmount(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const amount = Number(trimmed.replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount < 0) return null
  return amount
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 6,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${currency}`
  }
}

export function formatRate(rate: number): string {
  return rate.toLocaleString(undefined, {
    maximumFractionDigits: rate >= 1 ? 4 : 6,
  })
}
