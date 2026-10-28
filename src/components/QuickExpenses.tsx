import { useState, type FormEvent } from 'react'
import { fetchRate } from '../api/frankfurter'
import { getStoredExpenses, saveStoredExpenses } from '../services/storage'
import type { Expense, Trip } from '../types/trip'
import { formatMoney, formatRate } from '../utils/formatters'

export function QuickExpenses({ trip }: { trip: Trip }) {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    return getStoredExpenses(trip.id).data
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
        category: 'general',
        date: quote.date,
        createdAt: new Date().toISOString(),
      }

      const updated = [expense, ...expenses]
      const saveResult = saveStoredExpenses(trip.id, updated)
      if (!saveResult.success) {
        setError(saveResult.error ?? 'Could not save this expense.')
        return
      }
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
    saveStoredExpenses(trip.id, updated)
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
