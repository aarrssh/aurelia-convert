import { useMemo, useState, type FormEvent } from 'react'
import { getStoredJournal, saveStoredJournal } from '../services/storage'
import type { JournalEntry, Trip } from '../types/trip'

function getTodayDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function formatEntryDate(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? dateValue
    : date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function Journal({ trip }: { trip: Trip }) {
  const [entries, setEntries] = useState<JournalEntry[]>(() => getStoredJournal(trip.id).data)
  const [storageError, setStorageError] = useState<string | null>(() => getStoredJournal(trip.id).error)
  const [formError, setFormError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(getTodayDate)
  const [content, setContent] = useState('')

  const chronologicalEntries = useMemo(
    () => [...entries].sort((first, second) => first.date.localeCompare(second.date) || first.createdAt.localeCompare(second.createdAt)),
    [entries],
  )

  function resetForm() {
    setTitle('')
    setDate(getTodayDate())
    setContent('')
    setFormError(null)
    setEditingId(null)
    setIsFormOpen(false)
  }

  function openEditForm(entry: JournalEntry) {
    setTitle(entry.title)
    setDate(entry.date)
    setContent(entry.content)
    setEditingId(entry.id)
    setFormError(null)
    setIsFormOpen(true)
  }

  function handleSaveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !date || !content.trim()) {
      setFormError('Add a title, date, and a few words for your entry.')
      return
    }

    const nextEntries = editingId
      ? entries.map((entry) => entry.id === editingId
          ? { ...entry, title: title.trim(), date, content }
          : entry)
      : [{
          id: crypto.randomUUID(),
          tripId: trip.id,
          title: title.trim(),
          date,
          content,
          createdAt: new Date().toISOString(),
        }, ...entries]

    const result = saveStoredJournal(trip.id, nextEntries)
    if (!result.success) {
      setStorageError(result.error ?? 'Could not save this journal entry.')
      return
    }

    setEntries(nextEntries)
    setStorageError(null)
    resetForm()
  }

  function handleDeleteEntry(entry: JournalEntry) {
    if (!window.confirm(`Delete “${entry.title}” from your journal?`)) return
    const nextEntries = entries.filter((item) => item.id !== entry.id)
    const result = saveStoredJournal(trip.id, nextEntries)
    if (!result.success) {
      setStorageError(result.error ?? 'Could not delete this journal entry.')
      return
    }
    setEntries(nextEntries)
    setStorageError(null)
    if (editingId === entry.id) resetForm()
  }

  return (
    <section className="workspace-section journal-section" aria-labelledby="journal-title">
      <div className="journal-section-heading">
        <div className="section-intro">
          <p className="eyebrow">Notes from {trip.destination}</p>
          <h3 id="journal-title">Your travel journal</h3>
          <p>Keep the little moments and details you’ll want to remember.</p>
        </div>
        {!isFormOpen && (
          <button type="button" className="create-trip-button" onClick={() => setIsFormOpen(true)}>
            + Write an entry
          </button>
        )}
      </div>

      {(storageError || formError) && (
        <div className="banner error" role="alert"><p>{storageError || formError}</p></div>
      )}

      {isFormOpen && (
        <form className="journal-editor-card" onSubmit={handleSaveEntry}>
          <div className="form-card-header">
            <h4>{editingId ? 'Edit your entry' : 'A moment worth keeping'}</h4>
            <p>Write it the way you want to remember it.</p>
          </div>
          <div className="journal-form-grid">
            <label>
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required autoFocus />
            </label>
            <label>
              Date
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
            <label className="journal-content-field">
              Your entry
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={7}
                maxLength={12000}
                placeholder="The train was late, but we found the best little café while we waited…"
                required
              />
            </label>
          </div>
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <div className="form-actions-row">
            <button type="submit" className="create-trip-button">{editingId ? 'Save changes' : 'Save entry'}</button>
            <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      )}

      {chronologicalEntries.length === 0 ? (
        <div className="journal-empty-state">
          <span className="journal-empty-mark" aria-hidden="true">✳</span>
          <h4>No entries yet</h4>
          <p>Save a small detail, a funny moment, or the feeling of being somewhere new.</p>
          {!isFormOpen && (
            <button type="button" className="secondary-button" onClick={() => setIsFormOpen(true)}>
              Write your first entry
            </button>
          )}
        </div>
      ) : (
        <div className="journal-entry-list">
          {chronologicalEntries.map((entry) => (
            <article className="journal-entry-card" key={entry.id}>
              <div className="journal-entry-topline">
                <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
                <div className="journal-entry-actions">
                  <button type="button" className="activity-action-btn" onClick={() => openEditForm(entry)}>Edit</button>
                  <button type="button" className="activity-action-btn delete-btn" onClick={() => handleDeleteEntry(entry)}>Delete</button>
                </div>
              </div>
              <h4>{entry.title}</h4>
              <p>{entry.content}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
