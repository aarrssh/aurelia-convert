import { useState } from 'react'
import type { Trip } from '../types/trip'
import { formatMoney } from '../utils/formatters'

type HomeDashboardProps = {
  trips: Trip[]
  onOpenTrip: (tripId: string) => void
  onPlanTrip: () => void
  onOpenConverter: () => void
}

function getTripDateLabel(trip: Trip): string {
  if (!trip.startDate) return 'Dates to be decided'

  const formatDate = (value: string) => {
    const date = new Date(`${value}T12:00:00`)
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return `${formatDate(trip.startDate)}${trip.endDate ? ` — ${formatDate(trip.endDate)}` : ''}`
}

function JourneyCard({
  trip,
  past = false,
  index,
  onOpen,
}: {
  trip: Trip
  past?: boolean
  index: number
  onOpen: () => void
}) {
  return (
    <article className={`journey-card${past ? ' journey-card-past' : ''}`}>
      <div className={`journey-card-art journey-art-${index % 3}`} aria-hidden="true">
        <span className="journey-art-sun" />
        <span className="journey-art-horizon" />
        <span className="journey-card-stamp">{past ? 'Remembered' : 'On the horizon'}</span>
      </div>
      <div className="journey-card-content">
        <p className="journey-destination">{trip.destination}</p>
        <h4>{trip.name}</h4>
        <p className="journey-date">{getTripDateLabel(trip)}</p>
        <div className="journey-card-footer">
          <span>Budget · {formatMoney(trip.budget, trip.homeCurrency)}</span>
          <button type="button" className="journey-open-link" onClick={onOpen}>
            Open trip <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </article>
  )
}

export function HomeDashboard({ trips, onOpenTrip, onPlanTrip, onOpenConverter }: HomeDashboardProps) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const previousTrips = trips.filter((trip) => {
    const finalDate = trip.endDate || trip.startDate
    return Boolean(finalDate && finalDate < today)
  })
  const previousTripIds = new Set(previousTrips.map((trip) => trip.id))
  const upcomingTrips = trips.filter((trip) => !previousTripIds.has(trip.id))

  return (
    <main className="home-dashboard">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="eyebrow home-eyebrow"><span aria-hidden="true">✳</span> A little more elsewhere</p>
          <h1 id="home-title">The best stories<br />begin <em>somewhere.</em></h1>
          <p className="home-microcopy">
            Make room for the long way round, late lunches, and the people you find along the way.
          </p>
          <div className="home-hero-actions">
            <button type="button" className="create-trip-button" onClick={onPlanTrip}>
              Plan a journey <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="secondary-button" onClick={onOpenConverter}>
              Convert currency
            </button>
          </div>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <div className="hero-art-sun" />
          <div className="hero-art-ring hero-art-ring-one" />
          <div className="hero-art-ring hero-art-ring-two" />
          <div className="hero-art-land hero-art-land-back" />
          <div className="hero-art-land hero-art-land-front" />
          <div className="hero-art-path" />
          <span className="hero-art-note">go where it feels like you</span>
          <span className="hero-art-caption">THE WORLD, A LITTLE CLOSER</span>
        </div>
        <div className="home-hero-footnote">
          <span>Made for the miles you share</span>
          <span className="home-hero-footnote-mark" aria-hidden="true">✳</span>
          <span>And the moments you keep</span>
        </div>
      </section>

      <section className="home-section journeys-section" aria-labelledby="upcoming-title">
        <div className="home-section-header">
          <div>
            <p className="eyebrow">Your little atlas</p>
            <h2 id="upcoming-title">Journeys on the horizon</h2>
          </div>
          <button type="button" className="text-action-button" onClick={onPlanTrip}>
            All trips <span aria-hidden="true">↗</span>
          </button>
        </div>

        {upcomingTrips.length > 0 ? (
          <div className="journey-grid">
            {upcomingTrips.map((trip, index) => (
              <JourneyCard
                key={trip.id}
                trip={trip}
                index={index}
                onOpen={() => onOpenTrip(trip.id)}
              />
            ))}
            <button type="button" className="journey-add-card" onClick={onPlanTrip}>
              <span className="journey-add-mark" aria-hidden="true">＋</span>
              <span>There’s always room<br />for one more story.</span>
              <span className="journey-add-link">Plan another journey ↗</span>
            </button>
          </div>
        ) : (
          <div className="home-empty-card">
            <div className="empty-state-orbit" aria-hidden="true"><span>✳</span></div>
            <div className="home-empty-content">
              <p className="eyebrow">{previousTrips.length ? 'The next page is yours' : 'Your first page is waiting'}</p>
              <h3>{previousTrips.length ? 'Ready for somewhere new?' : 'Where shall we go?'}</h3>
              <p>
                {previousTrips.length
                  ? 'You know how lovely the going can be. Start with a place, a date, or simply a feeling.'
                  : 'Start with a place, a date, or simply a feeling. Your plans, little details, and shared memories can live here.'}
              </p>
              <div className="home-empty-actions">
                <button type="button" className="create-trip-button" onClick={onPlanTrip}>
                  {previousTrips.length ? 'Plan another journey' : 'Plan your first journey'} <span aria-hidden="true">↗</span>
                </button>
                <button type="button" className="text-action-button" onClick={onOpenConverter}>Or start with a currency conversion</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {previousTrips.length > 0 && (
        <section className="home-section previous-section" aria-labelledby="previous-title">
          <div className="home-section-header">
            <div>
              <p className="eyebrow">The good kind of looking back</p>
              <h2 id="previous-title">Journeys you’ve taken</h2>
            </div>
          </div>
          <div className="journey-grid journey-grid-previous">
            {previousTrips.map((trip, index) => (
              <JourneyCard
                key={trip.id}
                trip={trip}
                past
                index={index}
                onOpen={() => onOpenTrip(trip.id)}
              />
            ))}
          </div>
        </section>
      )}

      <footer className="home-footer-note">
        <span className="home-footer-mark" aria-hidden="true">a</span>
        <p>A place for the plans, the spending, and the stories that make a trip yours.</p>
      </footer>
    </main>
  )
}
