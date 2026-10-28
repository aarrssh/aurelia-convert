import { useState, type FormEvent } from 'react'
import type { Trip } from '../types/trip'
import { formatMoney } from '../utils/formatters'
import { ExpenseTracker } from './ExpenseTracker'
import { ItineraryPlanner } from './ItineraryPlanner'
import { Journal } from './Journal'

type TripWorkspaceProps = {
  trip: Trip
  onBack: () => void
  onUpdateTrip: (updatedTrip: Trip) => boolean
  onDeleteTrip: (tripId: string) => boolean
  storageError: string | null
}

export function TripWorkspace({
  trip,
  onBack,
  onUpdateTrip,
  onDeleteTrip,
  storageError,
}: TripWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'planner' | 'spending' | 'journal'>('planner')
  const [isEditing, setIsEditing] = useState(false)

  const [editName, setEditName] = useState(trip.name)
  const [editDestination, setEditDestination] = useState(trip.destination)
  const [editHomeCurrency, setEditHomeCurrency] = useState(trip.homeCurrency)
  const [editBudget, setEditBudget] = useState(String(trip.budget))
  const [editStartDate, setEditStartDate] = useState(trip.startDate || '')
  const [editEndDate, setEditEndDate] = useState(trip.endDate || '')
  const [editError, setEditError] = useState<string | null>(null)

  function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedBudget = Number(editBudget)
    if (
      !editName.trim() ||
      !editDestination.trim() ||
      !editBudget ||
      !Number.isFinite(parsedBudget) ||
      parsedBudget < 0
    ) {
      setEditError('Please enter a valid trip name, destination, and non-negative budget.')
      return
    }

    if (editStartDate && editEndDate && editEndDate < editStartDate) {
      setEditError('End date cannot be earlier than start date.')
      return
    }

    const updated: Trip = {
      ...trip,
      name: editName.trim(),
      destination: editDestination.trim(),
      homeCurrency: editHomeCurrency,
      budget: parsedBudget,
      startDate: editStartDate || undefined,
      endDate: editEndDate || undefined,
    }

    if (onUpdateTrip(updated)) {
      setEditError(null)
      setIsEditing(false)
    }
  }

  function handleCancelSettings() {
    setEditName(trip.name)
    setEditDestination(trip.destination)
    setEditHomeCurrency(trip.homeCurrency)
    setEditBudget(String(trip.budget))
    setEditStartDate(trip.startDate || '')
    setEditEndDate(trip.endDate || '')
    setEditError(null)
    setIsEditing(false)
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${trip.name}" and all of its logged expenses and itinerary activities? This action cannot be undone.`,
    )
    if (confirmed) {
      onDeleteTrip(trip.id)
    }
  }

  const createdDate = new Date(trip.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <section className="trip-workspace">
      <header className="workspace-header">
        {storageError && <div className="banner error" role="alert"><p>{storageError}</p></div>}
        <div className="workspace-top-bar">
          <button type="button" className="back-link" onClick={onBack}>
            ← Back to My Trips
          </button>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => setIsEditing((prev) => !prev)}
          >
            {isEditing ? 'Close Settings' : 'Trip Settings'}
          </button>
        </div>

        <div className="workspace-hero">
          <p className="eyebrow">{trip.destination}</p>
          <h2>{trip.name}</h2>
          <div className="workspace-meta-pills">
            {trip.startDate && (
              <span className="meta-pill date-meta-pill">
                Dates:{' '}
                <strong>
                  {trip.startDate}
                  {trip.endDate ? ` – ${trip.endDate}` : ''}
                </strong>
              </span>
            )}
            <span className="meta-pill">
              Budget: <strong>{formatMoney(trip.budget, trip.homeCurrency)}</strong>
            </span>
            <span className="meta-pill">
              Currency: <strong>{trip.homeCurrency}</strong>
            </span>
            <span className="meta-pill">
              Created: <strong>{createdDate}</strong>
            </span>
          </div>
        </div>

        {isEditing && (
          <form className="workspace-settings-card" onSubmit={handleSaveSettings}>
            <div className="settings-header">
              <h3>Trip Settings</h3>
              <p>Update your journey details, dates, or delete this trip.</p>
            </div>

            {editError && <p className="field-error" role="alert">{editError}</p>}

            <div className="settings-form-grid">
              <label>
                Trip name
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  required
                />
              </label>

              <label>
                Destination
                <input
                  value={editDestination}
                  onChange={(event) => setEditDestination(event.target.value)}
                  required
                />
              </label>

              <div className="trip-form-row">
                <label>
                  Start date
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(event) => setEditStartDate(event.target.value)}
                  />
                </label>

                <label>
                  End date
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(event) => setEditEndDate(event.target.value)}
                  />
                </label>
              </div>

              <div className="trip-form-row">
                <label>
                  Home currency
                  <select
                    value={editHomeCurrency}
                    onChange={(event) => setEditHomeCurrency(event.target.value)}
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
                    value={editBudget}
                    onChange={(event) => setEditBudget(event.target.value)}
                    required
                  />
                </label>
              </div>
            </div>

            <div className="settings-actions-row">
              <div className="settings-primary-actions">
                <button type="submit" className="create-trip-button">
                  Save changes
                </button>
                <button type="button" className="secondary-button" onClick={handleCancelSettings}>
                  Cancel
                </button>
              </div>
              <button type="button" className="danger-button" onClick={handleDelete}>
                Delete trip
              </button>
            </div>
          </form>
        )}

        <nav className="workspace-subnav" aria-label="Trip workspace navigation">
          <button
            type="button"
            className={activeTab === 'planner' ? 'workspace-tab active' : 'workspace-tab'}
            onClick={() => setActiveTab('planner')}
          >
            Planner
          </button>
          <button
            type="button"
            className={activeTab === 'spending' ? 'workspace-tab active' : 'workspace-tab'}
            onClick={() => setActiveTab('spending')}
          >
            Spending
          </button>
          <button
            type="button"
            className={activeTab === 'journal' ? 'workspace-tab active' : 'workspace-tab'}
            onClick={() => setActiveTab('journal')}
          >
            Journal
          </button>
        </nav>
      </header>

      <main className="workspace-content">
        {activeTab === 'planner' && (
          <ItineraryPlanner trip={trip} onOpenSettings={() => setIsEditing(true)} />
        )}

        {activeTab === 'spending' && (
          <div className="workspace-section spending-section">
            <ExpenseTracker trip={trip} />
          </div>
        )}

        {activeTab === 'journal' && <Journal trip={trip} />}
      </main>
    </section>
  )
}
