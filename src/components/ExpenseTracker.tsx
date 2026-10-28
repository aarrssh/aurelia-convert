import { useMemo, useState, type FormEvent } from 'react'
import { fetchRate } from '../api/frankfurter'
import {
  getStoredExpenses,
  getStoredItinerary,
  saveStoredExpenses,
} from '../services/storage'
import type { Expense, ExpenseCategory, Trip } from '../types/trip'
import { formatMoney, formatRate } from '../utils/formatters'

type ExpenseTrackerProps = {
  trip: Trip
}

const CATEGORY_INFO: Record<
  ExpenseCategory,
  { label: string; icon: string }
> = {
  food: { label: 'Food & Dining', icon: '🍜' },
  transport: { label: 'Transport', icon: '🚆' },
  accommodation: { label: 'Accommodation', icon: '🏨' },
  activities: { label: 'Activities', icon: '🎟️' },
  shopping: { label: 'Shopping', icon: '🛍️' },
  general: { label: 'General', icon: '🏷️' },
}

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function getNowIsoStr(): string {
  return new Date().toISOString()
}

const POPULAR_CURRENCIES = [
  'JPY',
  'USD',
  'EUR',
  'GBP',
  'INR',
  'THB',
  'AUD',
  'CAD',
  'CHF',
  'SGD',
  'KRW',
  'MYR',
  'NZD',
  'IDR',
  'VND',
  'PHP',
  'HKD',
  'TRY',
  'MXN',
  'BRL',
  'SEK',
  'NOK',
  'DKK',
]

function formatDateHeader(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`)
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function ExpenseTracker({ trip }: ExpenseTrackerProps) {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    return getStoredExpenses(trip.id).data
  })
  const [storageError, setStorageError] = useState<string | null>(() => {
    return getStoredExpenses(trip.id).error
  })

  // Grouping & filtering
  const [viewMode, setViewMode] = useState<'date' | 'category' | 'all'>('date')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formCurrency, setFormCurrency] = useState(
    trip.homeCurrency === 'JPY' ? 'USD' : 'JPY',
  )
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('food')
  const [formDate, setFormDate] = useState(() => getTodayDateStr())
  const [formNotes, setFormNotes] = useState('')
  const [formActivityId, setFormActivityId] = useState('')
  const [converting, setConverting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Associated itinerary activities
  const itineraryActivities = useMemo(() => {
    return getStoredItinerary(trip.id).data
  }, [trip.id])

  // Currency options (ensure trip home currency is included)
  const currencyOptions = useMemo(() => {
    const set = new Set([trip.homeCurrency, ...POPULAR_CURRENCIES])
    return Array.from(set)
  }, [trip.homeCurrency])

  // Budget calculations
  const totalSpentHome = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.homeAmount, 0)
  }, [expenses])

  const remainingBudget = trip.budget - totalSpentHome
  const isOverBudget = remainingBudget < 0
  const budgetPercentage =
    trip.budget > 0 ? (totalSpentHome / trip.budget) * 100 : 0

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (categoryFilter === 'all') return expenses
    return expenses.filter((e) => (e.category || 'general') === categoryFilter)
  }, [expenses, categoryFilter])

  // Grouping by Date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Expense[]> = {}
    for (const exp of filteredExpenses) {
      const d = exp.date || exp.rateDate || exp.createdAt.slice(0, 10)
      if (!groups[d]) groups[d] = []
      groups[d].push(exp)
    }
    const datesSorted = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    return datesSorted.map((date) => ({
      date,
      items: groups[date],
      total: groups[date].reduce((sum, item) => sum + item.homeAmount, 0),
    }))
  }, [filteredExpenses])

  // Grouping by Category
  const groupedByCategory = useMemo(() => {
    const groups: Record<ExpenseCategory, Expense[]> = {
      food: [],
      transport: [],
      accommodation: [],
      activities: [],
      shopping: [],
      general: [],
    }
    for (const exp of filteredExpenses) {
      const cat = exp.category || 'general'
      groups[cat].push(exp)
    }
    const categoriesWithItems = (
      Object.keys(groups) as ExpenseCategory[]
    ).filter((cat) => groups[cat].length > 0)

    return categoriesWithItems.map((category) => ({
      category,
      items: groups[category],
      total: groups[category].reduce((sum, item) => sum + item.homeAmount, 0),
    }))
  }, [filteredExpenses])

  function resetForm() {
    setFormDescription('')
    setFormAmount('')
    setFormCurrency(trip.homeCurrency === 'JPY' ? 'USD' : 'JPY')
    setFormCategory('food')
    setFormDate(getTodayDateStr())
    setFormNotes('')
    setFormActivityId('')
    setFormError(null)
    setEditingId(null)
    setIsFormOpen(false)
  }

  function handleOpenAddForm() {
    resetForm()
    setIsFormOpen(true)
  }

  function handleOpenEditForm(expense: Expense) {
    setEditingId(expense.id)
    setFormDescription(expense.description)
    setFormAmount(String(expense.amount))
    setFormCurrency(expense.currency)
    setFormCategory(expense.category || 'general')
    setFormDate(expense.date || expense.rateDate || expense.createdAt.slice(0, 10))
    setFormNotes(expense.notes || '')
    setFormActivityId(expense.activityId || '')
    setFormError(null)
    setIsFormOpen(true)
  }

  async function handleSaveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedAmount = Number(formAmount)
    if (
      !formDescription.trim() ||
      !formAmount.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setFormError('Enter a description and an amount greater than zero.')
      return
    }

    setConverting(true)
    setFormError(null)

    try {
      let nextExpenses: Expense[]

      if (editingId) {
        const existing = expenses.find((e) => e.id === editingId)
        if (!existing) {
          setFormError('Expense record not found.')
          return
        }

        let rate = existing.rate
        let rateDate = existing.rateDate
        let homeAmount = parsedAmount * rate

        // If currency changed, re-fetch rate; if currency stayed the same, preserve historical rate!
        if (formCurrency !== existing.currency) {
          const quote = await fetchRate(formCurrency, trip.homeCurrency)
          rate = quote.rate
          rateDate = quote.date
          homeAmount = parsedAmount * rate
        } else if (parsedAmount !== existing.amount) {
          homeAmount = parsedAmount * rate
        }

        const updatedExpense: Expense = {
          ...existing,
          description: formDescription.trim(),
          amount: parsedAmount,
          currency: formCurrency,
          homeCurrency: trip.homeCurrency,
          homeAmount,
          rate,
          rateDate,
          category: formCategory,
          date: formDate,
          notes: formNotes.trim() || undefined,
          activityId: formActivityId || undefined,
        }

        nextExpenses = expenses.map((e) =>
          e.id === editingId ? updatedExpense : e,
        )
      } else {
        const quote = await fetchRate(formCurrency, trip.homeCurrency)
        const newExpense: Expense = {
          id: crypto.randomUUID(),
          tripId: trip.id,
          description: formDescription.trim(),
          amount: parsedAmount,
          currency: formCurrency,
          homeCurrency: trip.homeCurrency,
          homeAmount: parsedAmount * quote.rate,
          rate: quote.rate,
          rateDate: quote.date,
          category: formCategory,
          date: formDate,
          notes: formNotes.trim() || undefined,
          activityId: formActivityId || undefined,
          createdAt: getNowIsoStr(),
        }

        nextExpenses = [newExpense, ...expenses]
      }

      const saveResult = saveStoredExpenses(trip.id, nextExpenses)
      if (!saveResult.success) {
        setFormError(saveResult.error ?? 'Could not save expense.')
        return
      }

      setExpenses(nextExpenses)
      setStorageError(null)
      resetForm()
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : 'Could not convert currency. Check your connection.',
      )
    } finally {
      setConverting(false)
    }
  }

  function handleDeleteExpense(id: string, description: string) {
    const confirmed = window.confirm(`Delete expense "${description}"?`)
    if (!confirmed) return

    const nextExpenses = expenses.filter((e) => e.id !== id)
    const saveResult = saveStoredExpenses(trip.id, nextExpenses)
    if (!saveResult.success) {
      setStorageError(saveResult.error ?? 'Could not delete expense.')
      return
    }

    setExpenses(nextExpenses)
    if (editingId === id) {
      resetForm()
    }
  }

  return (
    <div className="expense-tracker">
      {/* Budget Summary Card */}
      <section className="budget-summary-card">
        <div className="budget-summary-header">
          <div>
            <span className="stat-label">Trip Budget Status</span>
            <div className="budget-headline">
              <h3>{formatMoney(totalSpentHome, trip.homeCurrency)}</h3>
              <span className="budget-target">
                of {formatMoney(trip.budget, trip.homeCurrency)} budget
              </span>
            </div>
          </div>

          <div className="budget-status-badge">
            {isOverBudget ? (
              <span className="badge-overbudget">
                ⚠️ Over budget by{' '}
                {formatMoney(Math.abs(remainingBudget), trip.homeCurrency)}
              </span>
            ) : (
              <span className="badge-remaining">
                ✓ {formatMoney(remainingBudget, trip.homeCurrency)} remaining
              </span>
            )}
          </div>
        </div>

        {/* Visual Budget Progress Bar */}
        <div
          className="budget-bar-track"
          role="progressbar"
          aria-valuenow={Math.round(budgetPercentage)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`budget-bar-fill ${
              isOverBudget
                ? 'over'
                : budgetPercentage > 85
                  ? 'warning'
                  : 'ok'
            }`}
            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
          />
        </div>

        <div className="budget-summary-footer">
          <span>{expenses.length} expenses recorded</span>
          <span>{Math.round(budgetPercentage)}% of budget used</span>
        </div>
      </section>

      {/* Top Controls Bar */}
      <div className="expense-top-bar">
        <div className="expense-view-toggles">
          <button
            type="button"
            className={viewMode === 'date' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => setViewMode('date')}
          >
            By Date
          </button>
          <button
            type="button"
            className={
              viewMode === 'category' ? 'toggle-btn active' : 'toggle-btn'
            }
            onClick={() => setViewMode('category')}
          >
            By Category
          </button>
          <button
            type="button"
            className={viewMode === 'all' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => setViewMode('all')}
          >
            Recent
          </button>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            className="create-trip-button compact-button"
            onClick={handleOpenAddForm}
          >
            + Add expense
          </button>
        )}
      </div>

      {storageError && (
        <div className="banner error" role="alert">
          <p>{storageError}</p>
        </div>
      )}

      {/* Fast Add/Edit Expense Form */}
      {isFormOpen && (
        <form className="expense-editor-card" onSubmit={handleSaveExpense}>
          <div className="form-card-header">
            <h4>{editingId ? 'Edit expense' : 'Record new expense'}</h4>
            <p>
              Amounts are instantly converted to {trip.homeCurrency} using live
              Frankfurter exchange rates.
            </p>
          </div>

          {formError && <p className="field-error" role="alert">{formError}</p>}

          <div className="expense-form-grid">
            <label className="span-full">
              Description
              <input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g. Shinkansen ticket to Kyoto"
                required
                autoFocus
              />
            </label>

            <label>
              Amount (in spent currency)
              <input
                type="number"
                min="0.01"
                step="any"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="14000"
                required
              />
            </label>

            <label>
              Currency
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
              >
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code} {code === trip.homeCurrency ? '(Home)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Category
              <select
                value={formCategory}
                onChange={(e) =>
                  setFormCategory(e.target.value as ExpenseCategory)
                }
              >
                <option value="food">🍜 Food & Dining</option>
                <option value="transport">🚆 Transport & Transit</option>
                <option value="accommodation">🏨 Accommodation & Stay</option>
                <option value="activities">🎟️ Activities & Tickets</option>
                <option value="shopping">🛍️ Shopping & Souvenirs</option>
                <option value="general">🏷️ General & Miscellaneous</option>
              </select>
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

            {itineraryActivities.length > 0 && (
              <label className="span-full">
                Link to itinerary activity (optional)
                <select
                  value={formActivityId}
                  onChange={(e) => setFormActivityId(e.target.value)}
                >
                  <option value="">None (General trip expense)</option>
                  {itineraryActivities.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.title} ({act.date})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="span-full">
              Notes (optional)
              <input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Split with Alex, paid with credit card"
              />
            </label>
          </div>

          <div className="form-actions-row">
            <button
              type="submit"
              className="create-trip-button"
              disabled={converting}
            >
              {converting
                ? 'Converting…'
                : editingId
                  ? 'Save changes'
                  : 'Add expense'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
              disabled={converting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Pills (when expenses exist) */}
      {expenses.length > 0 && (
        <div className="category-filter-bar">
          <button
            type="button"
            className={categoryFilter === 'all' ? 'cat-pill active' : 'cat-pill'}
            onClick={() => setCategoryFilter('all')}
          >
            All Categories ({expenses.length})
          </button>
          {(Object.keys(CATEGORY_INFO) as ExpenseCategory[]).map((cat) => {
            const count = expenses.filter(
              (e) => (e.category || 'general') === cat,
            ).length
            if (count === 0) return null
            return (
              <button
                type="button"
                key={cat}
                className={categoryFilter === cat ? 'cat-pill active' : 'cat-pill'}
                onClick={() => setCategoryFilter(cat)}
              >
                {CATEGORY_INFO[cat].icon} {CATEGORY_INFO[cat].label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Expenses Output */}
      {filteredExpenses.length === 0 ? (
        <div className="expense-empty-card">
          <p className="eyebrow">Track your travel spending</p>
          <h4>No expenses recorded yet</h4>
          <p>
            Log foreign currency payments, restaurant meals, and transit tickets.
            Aurelia locks in the mid-market rate so your budget is always accurate.
          </p>
          {!isFormOpen && (
            <button
              type="button"
              className="create-trip-button"
              onClick={handleOpenAddForm}
            >
              + Record first expense
            </button>
          )}
        </div>
      ) : (
        <div className="expense-groups-container">
          {/* VIEW: BY DATE */}
          {viewMode === 'date' &&
            groupedByDate.map(({ date, items, total }) => (
              <section className="expense-group-section" key={date}>
                <div className="group-header">
                  <h4>{formatDateHeader(date)}</h4>
                  <span className="group-total">
                    Day Total: <strong>{formatMoney(total, trip.homeCurrency)}</strong>
                  </span>
                </div>
                <div className="expense-items-list">
                  {items.map((expense) => (
                    <ExpenseItem
                      key={expense.id}
                      expense={expense}
                      trip={trip}
                      itineraryActivities={itineraryActivities}
                      onEdit={() => handleOpenEditForm(expense)}
                      onDelete={() =>
                        handleDeleteExpense(expense.id, expense.description)
                      }
                    />
                  ))}
                </div>
              </section>
            ))}

          {/* VIEW: BY CATEGORY */}
          {viewMode === 'category' &&
            groupedByCategory.map(({ category, items, total }) => (
              <section className="expense-group-section" key={category}>
                <div className="group-header">
                  <h4>
                    {CATEGORY_INFO[category].icon} {CATEGORY_INFO[category].label}
                  </h4>
                  <span className="group-total">
                    Category Total:{' '}
                    <strong>{formatMoney(total, trip.homeCurrency)}</strong>
                  </span>
                </div>
                <div className="expense-items-list">
                  {items.map((expense) => (
                    <ExpenseItem
                      key={expense.id}
                      expense={expense}
                      trip={trip}
                      itineraryActivities={itineraryActivities}
                      onEdit={() => handleOpenEditForm(expense)}
                      onDelete={() =>
                        handleDeleteExpense(expense.id, expense.description)
                      }
                    />
                  ))}
                </div>
              </section>
            ))}

          {/* VIEW: ALL FLAT */}
          {viewMode === 'all' && (
            <div className="expense-items-list">
              {filteredExpenses.map((expense) => (
                <ExpenseItem
                  key={expense.id}
                  expense={expense}
                  trip={trip}
                  itineraryActivities={itineraryActivities}
                  onEdit={() => handleOpenEditForm(expense)}
                  onDelete={() =>
                    handleDeleteExpense(expense.id, expense.description)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExpenseItem({
  expense,
  trip,
  itineraryActivities,
  onEdit,
  onDelete,
}: {
  expense: Expense
  trip: Trip
  itineraryActivities: Array<{ id: string; title: string }>
  onEdit: () => void
  onDelete: () => void
}) {
  const cat = expense.category || 'general'
  const linkedActivity = expense.activityId
    ? itineraryActivities.find((a) => a.id === expense.activityId)
    : null

  return (
    <article className="expense-item-card">
      <div className="expense-item-main">
        <div className="expense-cat-badge" title={CATEGORY_INFO[cat].label}>
          <span>{CATEGORY_INFO[cat].icon}</span>
        </div>

        <div className="expense-item-info">
          <div className="expense-title-line">
            <strong>{expense.description}</strong>
            <span className="expense-cat-tag">{CATEGORY_INFO[cat].label}</span>
          </div>

          <div className="expense-item-meta">
            <span>{expense.date || expense.rateDate}</span>
            {linkedActivity && (
              <span className="expense-activity-tag">
                Linked: {linkedActivity.title}
              </span>
            )}
            {expense.notes && (
              <span className="expense-notes-snippet">“{expense.notes}”</span>
            )}
          </div>
        </div>
      </div>

      <div className="expense-item-financials">
        <div className="expense-amounts">
          <strong className="expense-home-amount">
            {formatMoney(expense.homeAmount, trip.homeCurrency)}
          </strong>
          <span className="expense-foreign-amount">
            {formatMoney(expense.amount, expense.currency)}
          </span>
          <small className="expense-rate-detail">
            1 {expense.currency} = {formatRate(expense.rate)} {trip.homeCurrency} ·{' '}
            {expense.rateDate}
          </small>
        </div>

        <div className="expense-actions">
          <button
            type="button"
            className="activity-action-btn"
            onClick={onEdit}
            aria-label={`Edit ${expense.description}`}
          >
            Edit
          </button>
          <button
            type="button"
            className="activity-action-btn delete-btn"
            onClick={onDelete}
            aria-label={`Delete ${expense.description}`}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}
