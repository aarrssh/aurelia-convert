import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCurrencies, fetchRate } from './api/frankfurter'
import { CurrencySelect } from './components/CurrencySelect'
import { HomeDashboard } from './components/HomeDashboard'
import { TripsDashboard } from './components/TripsDashboard'
import { TripWorkspace } from './components/TripWorkspace'
import {
  deleteStoredExpenses,
  deleteStoredItinerary,
  getStoredTrips,
  saveStoredTrips,
} from './services/storage'
import type { Currency, ExchangeRate } from './types/currency'
import type { Trip } from './types/trip'
import { formatMoney, formatRate, parseAmount } from './utils/formatters'
import './App.css'

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'trips' | 'converter'>('home')
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [trips, setTrips] = useState<Trip[]>(() => getStoredTrips().data)
  const [storageError, setStorageError] = useState<string | null>(() => getStoredTrips().error)

  function handleOpenTrip(tripId: string) {
    setSelectedTripId(tripId)
    setActiveTab('trips')
  }

  function handlePlanTrip() {
    setSelectedTripId(null)
    setActiveTab('trips')
  }

  function handleOpenConverter() {
    setSelectedTripId(null)
    setActiveTab('converter')
  }

  function handleCreateTrip(newTrip: Trip) {
    const nextTrips = [newTrip, ...trips]
    const saveResult = saveStoredTrips(nextTrips)
    if (!saveResult.success) {
      setStorageError(saveResult.error ?? 'Could not save trip.')
      return
    }
    setTrips(nextTrips)
    setStorageError(null)
  }

  function handleUpdateTrip(updatedTrip: Trip) {
    const nextTrips = trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
    const saveResult = saveStoredTrips(nextTrips)
    if (!saveResult.success) {
      setStorageError(saveResult.error ?? 'Could not update trip.')
      return
    }
    setTrips(nextTrips)
    setStorageError(null)
  }

  function handleDeleteTrip(tripId: string) {
    const nextTrips = trips.filter((t) => t.id !== tripId)
    saveStoredTrips(nextTrips)
    deleteStoredExpenses(tripId)
    deleteStoredItinerary(tripId)
    setTrips(nextTrips)
    if (selectedTripId === tripId) {
      setSelectedTripId(null)
    }
  }

  const selectedTrip = trips.find((t) => t.id === selectedTripId)

  // Currency Converter state & logic (preserved 100%)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('INR')
  const [quote, setQuote] = useState<ExchangeRate | null>(null)
  const [loadingCurrencies, setLoadingCurrencies] = useState(true)
  const [loadingRate, setLoadingRate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadCurrencies = useCallback(async (signal?: AbortSignal) => {
    setLoadingCurrencies(true)
    setError(null)

    try {
      const list = await fetchCurrencies(signal)
      setCurrencies(list)
    } catch (cause) {
      if ((cause as Error).name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Could not load currencies.')
    } finally {
      setLoadingCurrencies(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadCurrencies(controller.signal)
    return () => controller.abort()
  }, [loadCurrencies])

  useEffect(() => {
    const parsed = parseAmount(amount)
    if (parsed === null) {
      setQuote(null)
      setLoadingRate(false)
      return
    }

    setLoadingRate(true)
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setError(null)
      try {
        const result = await fetchRate(from, to, controller.signal)
        setQuote(result)
      } catch (cause) {
        if ((cause as Error).name === 'AbortError') return
        setQuote(null)
        setError(cause instanceof Error ? cause.message : 'Could not fetch the exchange rate.')
      } finally {
        setLoadingRate(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [amount, from, to, refreshKey])

  const quoteMatches = quote?.base === from && quote?.quote === to

  const converted = useMemo(() => {
    const parsed = parseAmount(amount)
    if (parsed === null || !quote || !quoteMatches) return null
    return parsed * quote.rate
  }, [amount, quote, quoteMatches])

  const amountError =
    amount.trim() !== '' && parseAmount(amount) === null
      ? 'Enter a valid non-negative number.'
      : null

  function swapCurrencies() {
    setFrom(to)
    setTo(from)
  }

  const fromMeta = currencies.find((currency) => currency.iso_code === from)
  const toMeta = currencies.find((currency) => currency.iso_code === to)
  const busy = loadingCurrencies || loadingRate

  return (
    <div className="app-shell">
      <nav className="app-navigation" aria-label="Main navigation">
        <button
          type="button"
          className={activeTab === 'home' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => {
            setActiveTab('home')
            setSelectedTripId(null)
          }}
        >
          Home
        </button>
        <button
          type="button"
          className={activeTab === 'trips' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => {
            setActiveTab('trips')
            setSelectedTripId(null)
          }}
        >
          My Trips
        </button>
        <button
          type="button"
          className={activeTab === 'converter' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => {
            setActiveTab('converter')
            setSelectedTripId(null)
          }}
        >
          Converter
        </button>
      </nav>

      {activeTab === 'home' && (
        <HomeDashboard
          trips={trips}
          onOpenTrip={handleOpenTrip}
          onPlanTrip={handlePlanTrip}
          onOpenConverter={handleOpenConverter}
        />
      )}

      {activeTab === 'trips' &&
        (selectedTrip ? (
          <TripWorkspace
            trip={selectedTrip}
            onBack={() => setSelectedTripId(null)}
            onUpdateTrip={handleUpdateTrip}
            onDeleteTrip={handleDeleteTrip}
          />
        ) : (
          <TripsDashboard
            trips={trips}
            onOpenTrip={handleOpenTrip}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            storageError={storageError}
          />
        ))}

      {activeTab === 'converter' && (
        <>
          <header className="brand">
            <span className="brand-mark" aria-hidden="true">
              FX
            </span>
            <div>
              <p className="eyebrow">Currency Converter</p>
              <h1>Currency Converter</h1>
            </div>
          </header>

          <main className="converter-card">
            <div className="card-heading">
              <h2>Live currency converter</h2>
              <p>Mid-market rates from Frankfurter, refreshed as you type.</p>
            </div>

            <label className="amount-field">
              <span className="field-label">Amount</span>
              <div className="amount-input-wrap">
                <span className="amount-prefix">{fromMeta?.symbol ?? from}</span>
                <input
                  className="amount-input"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  aria-invalid={Boolean(amountError)}
                  aria-describedby={amountError ? 'amount-error' : undefined}
                />
              </div>
              {amountError && (
                <span id="amount-error" className="field-error">
                  {amountError}
                </span>
              )}
            </label>

            <div className="pair-row">
              <CurrencySelect
                label="From"
                currencies={currencies}
                value={from}
                onChange={setFrom}
                disabled={loadingCurrencies}
              />

              <button
                type="button"
                className="swap-button"
                onClick={swapCurrencies}
                aria-label="Swap currencies"
                disabled={loadingCurrencies}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M7 7h11l-3-3M17 17H6l3 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <CurrencySelect
                label="To"
                currencies={currencies}
                value={to}
                onChange={setTo}
                disabled={loadingCurrencies}
              />
            </div>

            {error && (
              <div className="banner error" role="alert">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    void loadCurrencies()
                    setRefreshKey((key) => key + 1)
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            <section className="result" aria-live="polite">
              {busy && converted === null && (
                <p className="result-status">Fetching the latest rate…</p>
              )}
              {!busy && !error && parseAmount(amount) === null && (
                <p className="result-status">Enter an amount to convert.</p>
              )}
              {converted !== null && quoteMatches && quote && (
                <>
                  <p className="result-label">
                    {formatMoney(parseAmount(amount) ?? 0, from)} equals
                  </p>
                  <p className="result-value">
                    {loadingRate ? 'Updating…' : formatMoney(converted, to)}
                  </p>
                  <p className="result-meta">
                    1 {from} = {formatRate(quote.rate)} {to}
                    {toMeta ? ` (${toMeta.name})` : ''}
                  </p>
                </>
              )}
            </section>

            <footer className="rate-bar">
              <div>
                <span>Rate date</span>
                <strong>{quoteMatches && quote ? quote.date : '—'}</strong>
              </div>
              <div>
                <span>Source</span>
                <strong>
                  <a href="https://www.frankfurter.app/" target="_blank" rel="noreferrer">
                    Frankfurter API
                  </a>
                </strong>
              </div>
            </footer>
          </main>
        </>
      )}
    </div>
  )
}
