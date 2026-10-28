import { useState, type FormEvent } from 'react'
import { downloadBackupFile } from '../services/storage'
import type { Trip } from '../types/trip'
import { formatMoney } from '../utils/formatters'
import { QuickExpenses } from './QuickExpenses'

type TripsDashboardProps = {
  trips: Trip[]
  onOpenTrip: (tripId: string) => void
  onCreateTrip: (newTrip: Trip) => void
  onDeleteTrip: (tripId: string) => void
  storageError: string | null
}

export function TripsDashboard({
  trips,
  onOpenTrip,
  onCreateTrip,
  onDeleteTrip,
  storageError,
}: TripsDashboardProps) {
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [homeCurrency, setHomeCurrency] = useState('INR')
  const [budget, setBudget] = useState('')
  const [expandedExpensesTripId, setExpandedExpensesTripId] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  function saveTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedBudget = Number(budget)
    if (
      !name.trim() ||
      !destination.trim() ||
      !budget ||
      !Number.isFinite(parsedBudget) ||
      parsedBudget < 0
    ) {
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

    onCreateTrip(newTrip)
    setName('')
    setDestination('')
    setBudget('')
  }

  function handleExportBackup() {
    const ok = downloadBackupFile()
    if (!ok) {
      setExportError('Could not export backup file.')
    } else {
      setExportError(null)
    }
  }

  function toggleExpensesInline(tripId: string) {
    setExpandedExpensesTripId((current) => (current === tripId ? null : tripId))
  }

  return (
    <section className="trips-dashboard">
      <div className="trips-heading">
        <p className="eyebrow">Your adventures</p>
        <h2>My Trips</h2>
        <p>Keep your travel memories and spending in one place.</p>
      </div>

      {(storageError || exportError) && (
        <div className="banner error" role="alert">
          <p>{storageError || exportError}</p>
        </div>
      )}

      <form className="trip-form" onSubmit={saveTrip}>
        <h3>Plan a new journey</h3>

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
        <div className="trip-list-header">
          <h3>Your trips ({trips.length})</h3>
          {trips.length > 0 && (
            <button
              type="button"
              className="export-backup-button"
              onClick={handleExportBackup}
              title="Download a JSON backup of your trips and expenses"
            >
              Export backup (JSON)
            </button>
          )}
        </div>

        {trips.length === 0 ? (
          <p className="empty-trips">
            No trips yet. Create your first trip above!
          </p>
        ) : (
          <div className="trip-grid">
            {trips.map((trip) => {
              const isExpensesExpanded = expandedExpensesTripId === trip.id

              return (
                <article className="trip-card" key={trip.id}>
                  <button
                    type="button"
                    className="delete-trip-button"
                    aria-label={`Delete ${trip.name}`}
                    title="Delete trip"
                    onClick={() => onDeleteTrip(trip.id)}
                  >
                    ×
                  </button>

                  <p className="eyebrow">{trip.destination}</p>
                  <h3>{trip.name}</h3>
                  <p className="trip-budget">
                    Budget: {formatMoney(trip.budget, trip.homeCurrency)}
                  </p>

                  <div className="trip-card-actions">
                    <button
                      type="button"
                      className="workspace-open-button"
                      onClick={() => onOpenTrip(trip.id)}
                    >
                      Open trip workspace →
                    </button>

                    <button
                      type="button"
                      className="toggle-expenses-button"
                      onClick={() => toggleExpensesInline(trip.id)}
                      aria-expanded={isExpensesExpanded}
                    >
                      {isExpensesExpanded ? 'Hide quick expenses ▴' : 'Quick expenses ▾'}
                    </button>
                  </div>

                  {isExpensesExpanded && <QuickExpenses trip={trip} />}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
