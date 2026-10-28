import type { Trip } from '../types/trip'
import { formatMoney } from '../utils/formatters'

type HomeDashboardProps = {
  trips: Trip[]
  onOpenTrip: (tripId: string) => void
  onPlanTrip: () => void
  onOpenConverter: () => void
}

export function HomeDashboard({
  trips,
  onOpenTrip,
  onPlanTrip,
  onOpenConverter,
}: HomeDashboardProps) {
  const totalBudgetAcrossTrips = trips.reduce((sum, trip) => sum + trip.budget, 0)
  const primaryCurrency = trips[0]?.homeCurrency ?? 'USD'
  const isSingleCurrency = trips.every((t) => t.homeCurrency === primaryCurrency)

  return (
    <section className="home-dashboard">
      <header className="home-hero">
        <div className="home-hero-text">
          <p className="eyebrow">Personal Travel Companion</p>
          <h2>Aurelia</h2>
          <p className="home-microcopy">
            A quiet space for planning thoughtful journeys, converting currencies, and staying on budget.
          </p>
        </div>

        <div className="home-hero-actions">
          <button type="button" className="create-trip-button" onClick={onPlanTrip}>
            + Plan a new journey
          </button>
          <button type="button" className="secondary-button" onClick={onOpenConverter}>
            Currency converter →
          </button>
        </div>
      </header>

      {trips.length > 0 ? (
        <>
          <div className="home-stats-grid">
            <div className="home-stat-card">
              <span className="stat-label">Planned Journeys</span>
              <strong className="stat-value">{trips.length}</strong>
              <span className="stat-detail">
                {trips.length === 1 ? '1 active adventure' : `${trips.length} adventures recorded`}
              </span>
            </div>

            <div className="home-stat-card">
              <span className="stat-label">Total Travel Budget</span>
              <strong className="stat-value">
                {isSingleCurrency
                  ? formatMoney(totalBudgetAcrossTrips, primaryCurrency)
                  : `${trips.length} currencies`}
              </strong>
              <span className="stat-detail">
                {isSingleCurrency
                  ? `Across all planned trips`
                  : `Multiple home currencies specified`}
              </span>
            </div>

            <div className="home-stat-card">
              <span className="stat-label">Next Destination</span>
              <strong className="stat-value stat-truncate">{trips[0].destination}</strong>
              <span className="stat-detail">{trips[0].name}</span>
            </div>
          </div>

          <div className="home-section">
            <div className="home-section-header">
              <div>
                <p className="eyebrow">Your Adventures</p>
                <h3>Recent Journeys</h3>
              </div>
              <button type="button" className="text-action-button" onClick={onPlanTrip}>
                View all trips →
              </button>
            </div>

            <div className="trip-grid">
              {trips.map((trip) => (
                <article className="trip-card home-trip-card" key={trip.id}>
                  <p className="eyebrow">{trip.destination}</p>
                  <h3>{trip.name}</h3>
                  <p className="trip-budget">
                    Budget: {formatMoney(trip.budget, trip.homeCurrency)}
                  </p>
                  <button
                    type="button"
                    className="workspace-open-button"
                    onClick={() => onOpenTrip(trip.id)}
                  >
                    Open trip workspace →
                  </button>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="home-empty-card">
          <div className="home-empty-content">
            <p className="eyebrow">Ready for adventure?</p>
            <h3>No journeys planned yet</h3>
            <p>
              Create your first trip to organize your day-by-day itinerary, track daily expenses, and keep your travel memories in one place.
            </p>
            <div className="home-empty-actions">
              <button type="button" className="create-trip-button" onClick={onPlanTrip}>
                + Plan your first trip
              </button>
              <button type="button" className="secondary-button" onClick={onOpenConverter}>
                Try currency converter
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
