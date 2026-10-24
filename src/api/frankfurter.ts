const API_BASE = 'https://api.frankfurter.dev/v2'

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

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) return body.message
  } catch {
    // fall through to status text
  }
  return `Request failed (${response.status})`
}

export async function fetchCurrencies(signal?: AbortSignal): Promise<Currency[]> {
  const response = await fetch(`${API_BASE}/currencies`, { signal })
  if (!response.ok) throw new Error(await readError(response))

  const data = (await response.json()) as Currency[]
  return [...data].sort((a, b) => a.iso_code.localeCompare(b.iso_code))
}

export async function fetchRate(
  base: string,
  quote: string,
  signal?: AbortSignal,
): Promise<ExchangeRate> {
  if (base === quote) {
    return {
      date: new Date().toISOString().slice(0, 10),
      base,
      quote,
      rate: 1,
    }
  }

  const response = await fetch(
    `${API_BASE}/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`,
    { signal },
  )
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as ExchangeRate
}
