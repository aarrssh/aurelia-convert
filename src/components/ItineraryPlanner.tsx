import { useMemo, useState, type FormEvent } from 'react'
import { getStoredItinerary, saveStoredItinerary } from '../services/storage'
import type { ItineraryActivity, Trip } from '../types/trip'
import { getAppleMapsUrl, getGoogleMapsUrl } from '../utils/maps'

type ItineraryPlannerProps = {
  trip: Trip
  onOpenSettings: () => void
}

function formatDateHeader(dateStr: string): string {
  try {
    const date = new Date(`${dateStr}T00:00:00`)
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getTripDateRange(startDate?: string, endDate?: string): string[] {
  if (!startDate) return []
  if (!endDate || endDate < startDate) return [startDate]

  const dates: string[] = []
  const current = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  let safety = 0
  while (current <= end && safety < 120) {
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    const day = String(current.getDate()).padStart(2, '0')
    dates.push(`${year}-${month}-${day}`)
    current.setDate(current.getDate() + 1)
    safety++
  }

  return dates
}

export function ItineraryPlanner({ trip, onOpenSettings }: ItineraryPlannerProps) {
  const [activities, setActivities] = useState<ItineraryActivity[]>(() => {
    return getStoredItinerary(trip.id).data
  })
  const [storageError, setStorageError] = useState<string | null>(() => {
    return getStoredItinerary(trip.id).error
  })

  const [filterDate, setFilterDate] = useState<string | 'all'>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(() => trip.startDate || new Date().toISOString().slice(0, 10))
  const [formStartTime, setFormStartTime] = useState('')
  const [formEndTime, setFormEndTime] = useState('')
  const [formLocationName, setFormLocationName] = useState('')
  const [formLocationAddress, setFormLocationAddress] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Unique chronological dates
  const allDates = useMemo(() => {
    const rangeDates = getTripDateRange(trip.startDate, trip.endDate)
    const activityDates = activities.map((a) => a.date)
    const combined = Array.from(new Set([...rangeDates, ...activityDates])).sort()
    return combined
  }, [trip.startDate, trip.endDate, activities])

  // Group and sort activities per date
  const groupedActivities = useMemo(() => {
    const map: Record<string, ItineraryActivity[]> = {}
    for (const d of allDates) {
      map[d] = []
    }
    for (const act of activities) {
      if (!map[act.date]) {
        map[act.date] = []
      }
      map[act.date].push(act)
    }

    // Sort within each day: timed first (ascending), then untimed
    for (const d of Object.keys(map)) {
      map[d].sort((a, b) => {
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime)
        }
        if (a.startTime && !b.startTime) return -1
        if (!a.startTime && b.startTime) return 1
        return a.createdAt.localeCompare(b.createdAt)
      })
    }

    return map
  }, [allDates, activities])

  function resetForm() {
    setFormTitle('')
    setFormDate(trip.startDate || new Date().toISOString().slice(0, 10))
    setFormStartTime('')
    setFormEndTime('')
    setFormLocationName('')
    setFormLocationAddress('')
    setFormNotes('')
    setFormError(null)
    setEditingId(null)
    setIsFormOpen(false)
  }

  function handleOpenAddForm(initialDate?: string) {
    resetForm()
    if (initialDate) {
      setFormDate(initialDate)
    }
    setIsFormOpen(true)
  }

  function handleOpenEditForm(activity: ItineraryActivity) {
    setEditingId(activity.id)
    setFormTitle(activity.title)
    setFormDate(activity.date)
    setFormStartTime(activity.startTime || '')
    setFormEndTime(activity.endTime || '')
    setFormLocationName(activity.locationName || '')
    setFormLocationAddress(activity.locationAddress || '')
    setFormNotes(activity.notes || '')
    setFormError(null)
    setIsFormOpen(true)
  }

  function handleSaveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!formTitle.trim()) {
      setFormError('Please enter an activity title.')
      return
    }
    if (!formDate) {
      setFormError('Please select a date.')
      return
    }
    if (formStartTime && formEndTime && formEndTime < formStartTime) {
      setFormError('End time cannot be earlier than start time.')
      return
    }

    let nextActivities: ItineraryActivity[]

    if (editingId) {
      nextActivities = activities.map((act) => {
        if (act.id !== editingId) return act
        return {
          ...act,
          title: formTitle.trim(),
          date: formDate,
          startTime: formStartTime || undefined,
          endTime: formEndTime || undefined,
          locationName: formLocationName.trim() || undefined,
          locationAddress: formLocationAddress.trim() || undefined,
          notes: formNotes.trim() || undefined,
        }
      })
    } else {
      const newActivity: ItineraryActivity = {
        id: crypto.randomUUID(),
        tripId: trip.id,
        title: formTitle.trim(),
        date: formDate,
        startTime: formStartTime || undefined,
        endTime: formEndTime || undefined,
        locationName: formLocationName.trim() || undefined,
        locationAddress: formLocationAddress.trim() || undefined,
        notes: formNotes.trim() || undefined,
        completed: false,
        createdAt: new Date().toISOString(),
      }
      nextActivities = [...activities, newActivity]
    }

    const saveResult = saveStoredItinerary(trip.id, nextActivities)
    if (!saveResult.success) {
      setStorageError(saveResult.error ?? 'Could not save activity.')
      return
    }

    setActivities(nextActivities)
    setStorageError(null)
    resetForm()
  }

  function handleDeleteActivity(id: string, title: string) {
    const confirmed = window.confirm(`Delete "${title}" from your itinerary?`)
    if (!confirmed) return

    const nextActivities = activities.filter((act) => act.id !== id)
    const saveResult = saveStoredItinerary(trip.id, nextActivities)
    if (!saveResult.success) {
      setStorageError(saveResult.error ?? 'Could not delete activity.')
      return
    }

    setActivities(nextActivities)
    if (editingId === id) {
      resetForm()
    }
  }

  function handleToggleCompleted(id: string) {
    const nextActivities = activities.map((act) => {
      if (act.id !== id) return act
      return { ...act, completed: !act.completed }
    })

    const saveResult = saveStoredItinerary(trip.id, nextActivities)
    if (!saveResult.success) {
      setStorageError(saveResult.error ?? 'Could not update completion status.')
      return
    }

    setActivities(nextActivities)
  }

  const completedCount = activities.filter((a) => a.completed).length
  const datesToDisplay = filterDate === 'all' ? allDates : [filterDate]

  return (
    <div className="itinerary-planner">
      <div className="itinerary-top-bar">
        <div className="itinerary-summary">
          <h3>Day-by-Day Planner</h3>
          <p>
            {activities.length === 0
              ? 'Organize daily activities, schedules and map directions.'
              : `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'} planned · ${completedCount} completed`}
          </p>
        </div>

        <div className="itinerary-actions">
          {!isFormOpen && (
            <button
              type="button"
              className="create-trip-button compact-button"
              onClick={() => handleOpenAddForm(filterDate !== 'all' ? filterDate : undefined)}
            >
              + Add activity
            </button>
          )}
          {!trip.startDate && (
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={onOpenSettings}
              title="Set start and end dates for your trip"
            >
              Set trip dates
            </button>
          )}
        </div>
      </div>

      {storageError && (
        <div className="banner error" role="alert">
          <p>{storageError}</p>
        </div>
      )}

      {/* Activity Add/Edit Form */}
      {isFormOpen && (
        <form className="itinerary-form-card" onSubmit={handleSaveActivity}>
          <div className="form-card-header">
            <h4>{editingId ? 'Edit activity' : 'Add new activity'}</h4>
            <p>Schedule your stop and attach location directions.</p>
          </div>

          {formError && <p className="field-error" role="alert">{formError}</p>}

          <div className="itinerary-form-grid">
            <label className="span-full">
              Activity title
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Visit Meiji Shrine & Yoyogi Park"
                required
                autoFocus
              />
            </label>

            <label>
              Date
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </label>

            <div className="time-input-row">
              <label>
                Start time
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
              </label>

              <label>
                End time
                <input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                />
              </label>
            </div>

            <label>
              Location name
              <input
                value={formLocationName}
                onChange={(e) => setFormLocationName(e.target.value)}
                placeholder="e.g. Meiji Jingu"
              />
            </label>

            <label>
              Address or area
              <input
                value={formLocationAddress}
                onChange={(e) => setFormLocationAddress(e.target.value)}
                placeholder="e.g. 1-1 Yoyogikamizonocho, Shibuya City"
              />
            </label>

            <label className="span-full">
              Notes & recommendations
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Bring coins for wooden ema plaque, best visited early morning before crowds."
                rows={3}
              />
            </label>
          </div>

          <div className="form-actions-row">
            <button type="submit" className="create-trip-button">
              {editingId ? 'Save changes' : 'Add to itinerary'}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Date Filter Pills */}
      {allDates.length > 1 && (
        <div className="date-filter-bar" aria-label="Filter by day">
          <button
            type="button"
            className={filterDate === 'all' ? 'date-pill active' : 'date-pill'}
            onClick={() => setFilterDate('all')}
          >
            All days ({activities.length})
          </button>
          {allDates.map((dateStr, index) => {
            const count = (groupedActivities[dateStr] || []).length
            return (
              <button
                type="button"
                key={dateStr}
                className={filterDate === dateStr ? 'date-pill active' : 'date-pill'}
                onClick={() => setFilterDate(dateStr)}
              >
                Day {index + 1} · {formatDateHeader(dateStr)}
                {count > 0 && <span className="pill-badge">{count}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Itinerary Days List */}
      {allDates.length === 0 ? (
        <div className="itinerary-empty-card">
          <p className="eyebrow">Start your journey</p>
          <h4>Your itinerary is empty</h4>
          <p>
            Add activities for your days in {trip.destination}. Set start and end dates in Trip Settings or add your first stop directly.
          </p>
          <div className="itinerary-empty-actions">
            <button
              type="button"
              className="create-trip-button"
              onClick={() => handleOpenAddForm()}
            >
              + Add first activity
            </button>
            {!trip.startDate && (
              <button
                type="button"
                className="secondary-button"
                onClick={onOpenSettings}
              >
                Set trip dates
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="itinerary-days-container">
          {datesToDisplay.map((dateStr) => {
            const dayIndex = allDates.indexOf(dateStr)
            const dayActivities = groupedActivities[dateStr] || []

            return (
              <section className="itinerary-day-section" key={dateStr}>
                <div className="day-header">
                  <div className="day-title-wrap">
                    <span className="day-index-badge">Day {dayIndex + 1}</span>
                    <h4 className="day-title">{formatDateHeader(dateStr)}</h4>
                  </div>
                  <button
                    type="button"
                    className="add-to-day-button"
                    onClick={() => handleOpenAddForm(dateStr)}
                    title={`Add activity to ${formatDateHeader(dateStr)}`}
                  >
                    + Add to day
                  </button>
                </div>

                {dayActivities.length === 0 ? (
                  <p className="day-empty-hint">
                    No activities scheduled for this day yet.{' '}
                    <button
                      type="button"
                      className="inline-link"
                      onClick={() => handleOpenAddForm(dateStr)}
                    >
                      Add one now
                    </button>
                  </p>
                ) : (
                  <div className="activity-list">
                    {dayActivities.map((activity) => {
                      const hasLocation = Boolean(
                        activity.locationName || activity.locationAddress,
                      )
                      const googleMapsUrl = hasLocation
                        ? getGoogleMapsUrl(
                            activity.locationName,
                            activity.locationAddress,
                            trip.destination,
                          )
                        : null
                      const appleMapsUrl = hasLocation
                        ? getAppleMapsUrl(
                            activity.locationName,
                            activity.locationAddress,
                            trip.destination,
                          )
                        : null

                      return (
                        <article
                          className={
                            activity.completed
                              ? 'activity-card completed'
                              : 'activity-card'
                          }
                          key={activity.id}
                        >
                          <div className="activity-main">
                            <button
                              type="button"
                              className={
                                activity.completed
                                  ? 'activity-checkbox checked'
                                  : 'activity-checkbox'
                              }
                              onClick={() => handleToggleCompleted(activity.id)}
                              aria-label={
                                activity.completed
                                  ? `Mark ${activity.title} as incomplete`
                                  : `Mark ${activity.title} as completed`
                              }
                              title={activity.completed ? 'Completed' : 'Mark as done'}
                            >
                              {activity.completed ? '✓' : ''}
                            </button>

                            <div className="activity-body">
                              <div className="activity-header-line">
                                <div className="activity-time-pill">
                                  {activity.startTime ? (
                                    <span>
                                      {activity.startTime}
                                      {activity.endTime ? ` – ${activity.endTime}` : ''}
                                    </span>
                                  ) : (
                                    <span className="time-anytime">Anytime</span>
                                  )}
                                </div>
                                <h5 className="activity-title">{activity.title}</h5>
                              </div>

                              {hasLocation && (
                                <div className="activity-location-block">
                                  <span className="location-pin" aria-hidden="true">📍</span>
                                  <span className="location-text">
                                    {activity.locationName && (
                                      <strong>{activity.locationName}</strong>
                                    )}
                                    {activity.locationName && activity.locationAddress && ' · '}
                                    {activity.locationAddress && (
                                      <span>{activity.locationAddress}</span>
                                    )}
                                  </span>

                                  <div className="map-links">
                                    {googleMapsUrl && (
                                      <a
                                        href={googleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="map-action-link"
                                        title="Open in Google Maps"
                                      >
                                        Google Maps ↗
                                      </a>
                                    )}
                                    {appleMapsUrl && (
                                      <a
                                        href={appleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="map-action-link"
                                        title="Open in Apple Maps"
                                      >
                                        Apple Maps ↗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}

                              {activity.notes && (
                                <p className="activity-notes">{activity.notes}</p>
                              )}
                            </div>
                          </div>

                          <div className="activity-card-actions">
                            <button
                              type="button"
                              className="activity-action-btn"
                              onClick={() => handleOpenEditForm(activity)}
                              aria-label={`Edit ${activity.title}`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="activity-action-btn delete-btn"
                              onClick={() =>
                                handleDeleteActivity(activity.id, activity.title)
                              }
                              aria-label={`Delete ${activity.title}`}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
