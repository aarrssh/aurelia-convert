import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { fetchCurrencies, fetchRate } from './api/frankfurter'
import { CurrencySelect } from './components/CurrencySelect'
import type { Currency, ExchangeRate } from './types/currency'
import type { Expense, Trip } from './types/trip'
import { formatMoney, formatRate, parseAmount } from './utils/formatters'
import './App.css'
function QuickExpenses({ trip }: { trip: Trip }) {
  const storageKey = `aurelia-expenses-${trip.id}`

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Expense[]
    } catch {
      return []
    }
  })

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('JPY')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalHome = expenses.reduce((sum, expense) => sum + expense.homeAmount, 0)

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedAmount = Number(amount)
    if (!description.trim() || !amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a description and an amount greater than zero.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const quote = await fetchRate(currency, trip.homeCurrency)
      const expense: Expense = {
        id: crypto.randomUUID(),
        tripId: trip.id,
        description: description.trim(),
        amount: parsedAmount,
        currency,
        homeCurrency: trip.homeCurrency,
        homeAmount: parsedAmount * quote.rate,
        rate: quote.rate,
        rateDate: quote.date,
        createdAt: new Date().toISOString(),
      }

      const updated = [expense, ...expenses]
      localStorage.setItem(storageKey, JSON.stringify(updated))
      setExpenses(updated)
      setDescription('')
      setAmount('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not convert this expense.')
    } finally {
      setSaving(false)
    }
  }

  function removeExpense(id: string) {
    const updated = expenses.filter((expense) => expense.id !== id)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setExpenses(updated)
  }

  return (
    <section className="quick-expenses">
      <h4>Quick expenses</h4>

      <form className="expense-form" onSubmit={addExpense}>
        <label>
          Description
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ramen lunch"
            required
          />
        </label>

        <div className="expense-input-row">
          <label>
            Amount
            <input
              type="number"
              min="0.01"
              step="any"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1200"
              required
            />
          </label>

          <label>
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="JPY">JPY — Yen</option>
              <option value="THB">THB — Baht</option>
              <option value="USD">USD — Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Pound</option>
              <option value="INR">INR — Rupee</option>
            </select>
          </label>
        </div>

        <button className="create-trip-button" type="submit" disabled={saving}>
          {saving ? 'Converting…' : 'Add expense'}
        </button>
      </form>

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="expense-total">
        <span>Total in {trip.homeCurrency}</span>
        <strong>{formatMoney(totalHome, trip.homeCurrency)}</strong>
      </div>

      {expenses.length === 0 ? (
        <p className="empty-trips">No expenses yet. Add your first one above.</p>
      ) : (
        <div className="expense-list">
          {expenses.map((expense) => (
            <article className="expense-row" key={expense.id}>
              <div className="expense-description">
                <strong>{expense.description}</strong>
                <span>
                  {expense.currency} {expense.amount.toLocaleString()} · Rate date {expense.rateDate}
                </span>
              </div>

              <div className="expense-comparison">
                <strong>{formatMoney(expense.amount, expense.currency)}</strong>
                <span>{formatMoney(expense.homeAmount, expense.homeCurrency)}</span>
                <small>1 {expense.currency} = {formatRate(expense.rate)} {expense.homeCurrency}</small>
              </div>

              <button
                type="button"
                className="expense-remove"
                onClick={() => removeExpense(expense.id)}
                aria-label={`Remove ${expense.description}`}
              >
                Remove
              </button>
              
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function TripsDashboard() {
  const [trips, setTrips] = useState<Trip[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('aurelia-trips') ?? '[]') as Trip[]
    } catch {
      return []
    }
  })

  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [homeCurrency, setHomeCurrency] = useState('INR')
  const [budget, setBudget] = useState('')

  function saveTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedBudget = Number(budget)
    if (!name.trim() || !destination.trim() || !budget || !Number.isFinite(parsedBudget) || parsedBudget < 0) {
      return
    }

    const newTrip: Trip = {
      id: crypto.randomUUID(),
      name: name.trim(),
      destination: destination.trim(),
      homeCurrency,
      budget: parsedBudget,
      createdAt: new Date().toISOString(),
    }

    const updatedTrips = [newTrip, ...trips]
    setTrips(updatedTrips)
    localStorage.setItem('aurelia-trips', JSON.stringify(updatedTrips))

    setName('')
    setDestination('')
    setBudget('')
  }
  function deleteTrip(tripId: string) {
    const updatedTrips = trips.filter((trip) => trip.id !== tripId)
  
    setTrips(updatedTrips)
    localStorage.setItem('aurelia-trips', JSON.stringify(updatedTrips))
    localStorage.removeItem(`aurelia-expenses-${tripId}`)
  }
  return (
    <section className="trips-dashboard">
      <div className="trips-heading">
        <p className="eyebrow">Your adventures</p>
        <h2>Trips</h2>
        <p>Keep your travel memories and spending in one place.</p>
      </div>

      <form className="trip-form" onSubmit={saveTrip}>
        <h3>Create a trip</h3>

        <label>
          Trip name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Summer in Japan"
            required
          />
        </label>

        <label>
          Destination
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="Tokyo, Japan"
            required
          />
        </label>

        <div className="trip-form-row">
          <label>
            Home currency
            <select
              value={homeCurrency}
              onChange={(event) => setHomeCurrency(event.target.value)}
            >
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </label>

          <label>
            Budget
            <input
              type="number"
              min="0"
              step="any"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="50000"
              required
            />
          </label>
        </div>

        <button className="create-trip-button" type="submit">
          + Create trip
        </button>
      </form>

      <div className="trip-list">
        <h3>Your trips ({trips.length})</h3>

        {trips.length === 0 ? (
          <p className="empty-trips">
            No trips yet. Create your first trip above!
          </p>
        ) : (
          <div className="trip-grid">
            {trips.map((trip) => (
              <article className="trip-card" key={trip.id}>
                 <button
                  type="button"
                  className="delete-trip-button"
                  aria-label={`Delete ${trip.name}`}
                  title="Delete trip"
                  onClick={() => deleteTrip(trip.id)}
                >
                  ×
                </button>

                <p className="eyebrow">{trip.destination}</p>
                <h3>{trip.name}</h3>
                <p className="trip-budget">
                  Budget: {new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: trip.homeCurrency,
                    maximumFractionDigits: 2,
                  }).format(trip.budget)}
                </p>
                <QuickExpenses trip={trip} />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'converter' | 'trips'>('converter')
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
          className={activeTab === 'converter' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setActiveTab('converter')}
        >
          Converter
        </button>
        <button
          type="button"
          className={activeTab === 'trips' ? 'nav-tab active' : 'nav-tab'}
          onClick={() => setActiveTab('trips')}
        >
          Trips
        </button>
      </nav>
  

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
      {activeTab === 'trips' && <TripsDashboard />}
    </div>
  )
}
