import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Currency } from '../api/frankfurter'

const POPULAR = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD']

type CurrencySelectProps = {
  label: string
  currencies: Currency[]
  value: string
  onChange: (code: string) => void
  disabled?: boolean
}

export function CurrencySelect({
  label,
  currencies,
  value,
  onChange,
  disabled,
}: CurrencySelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = currencies.find((currency) => currency.iso_code === value)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? currencies.filter(
          (currency) =>
            currency.iso_code.toLowerCase().includes(needle) ||
            currency.name.toLowerCase().includes(needle),
        )
      : currencies

    const popular = matches.filter((currency) => POPULAR.includes(currency.iso_code))
    const rest = matches.filter((currency) => !POPULAR.includes(currency.iso_code))
    return needle ? matches : [...popular, ...rest]
  }, [currencies, query])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  return (
    <div className="currency-field" ref={rootRef}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="currency-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="currency-code">{value}</span>
        <span className="currency-name">{selected?.name ?? 'Select currency'}</span>
        <span className="chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="currency-menu" role="presentation">
          <input
            ref={searchRef}
            className="currency-search"
            type="search"
            placeholder="Search code or name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={`Search ${label.toLowerCase()}`}
          />
          <ul id={listId} className="currency-list" role="listbox">
            {filtered.length === 0 && (
              <li className="currency-empty">No currencies match “{query}”.</li>
            )}
            {filtered.map((currency) => (
              <li key={currency.iso_code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={currency.iso_code === value}
                  className={
                    currency.iso_code === value ? 'currency-option selected' : 'currency-option'
                  }
                  onClick={() => {
                    onChange(currency.iso_code)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="currency-code">{currency.iso_code}</span>
                  <span className="currency-name">{currency.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
