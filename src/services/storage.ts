import type { Expense, Trip } from '../types/trip'

export const STORAGE_KEYS = {
  TRIPS: 'aurelia-trips',
  expenses: (tripId: string) => `aurelia-expenses-${tripId}`,
} as const

export type StorageResult<T> = {
  data: T
  error: string | null
  isCorrupted: boolean
}

export type AureliaBackup = {
  version: 1
  exportedAt: string
  app: 'Aurelia Convert'
  trips: Trip[]
  expenses: Record<string, Expense[]>
}

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__aurelia_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

function sanitizeTrip(item: unknown): Trip | null {
  if (!item || typeof item !== 'object') return null
  const t = item as Record<string, unknown>
  if (typeof t.id !== 'string' || !t.id) return null
  if (typeof t.name !== 'string') return null
  if (typeof t.destination !== 'string') return null

  const budget = Number(t.budget)
  if (!Number.isFinite(budget)) return null

  return {
    id: t.id,
    name: t.name,
    destination: t.destination,
    homeCurrency: typeof t.homeCurrency === 'string' ? t.homeCurrency : 'INR',
    budget,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
  }
}

function sanitizeExpense(item: unknown): Expense | null {
  if (!item || typeof item !== 'object') return null
  const e = item as Record<string, unknown>
  if (typeof e.id !== 'string' || !e.id) return null
  if (typeof e.tripId !== 'string') return null
  if (typeof e.description !== 'string') return null

  const amount = Number(e.amount)
  if (!Number.isFinite(amount)) return null

  const homeAmount = Number(e.homeAmount)
  const rate = Number(e.rate)

  return {
    id: e.id,
    tripId: e.tripId,
    description: e.description,
    amount,
    currency: typeof e.currency === 'string' ? e.currency : 'USD',
    homeCurrency: typeof e.homeCurrency === 'string' ? e.homeCurrency : 'INR',
    homeAmount: Number.isFinite(homeAmount) ? homeAmount : amount,
    rate: Number.isFinite(rate) ? rate : 1,
    rateDate: typeof e.rateDate === 'string' ? e.rateDate : new Date().toISOString().slice(0, 10),
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
  }
}

export function getStoredTrips(): StorageResult<Trip[]> {
  if (!isLocalStorageAvailable()) {
    return {
      data: [],
      error: 'Local storage is disabled or unavailable.',
      isCorrupted: false,
    }
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.TRIPS)
  if (raw === null) {
    return { data: [], error: null, isCorrupted: false }
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return {
        data: [],
        error: 'Existing trip data in storage is malformed (expected an array).',
        isCorrupted: true,
      }
    }

    const trips: Trip[] = []
    let hadInvalidItems = false
    for (const item of parsed) {
      const trip = sanitizeTrip(item)
      if (trip) {
        trips.push(trip)
      } else {
        hadInvalidItems = true
      }
    }

    if (hadInvalidItems && trips.length === 0 && parsed.length > 0) {
      return {
        data: [],
        error: 'Saved trips could not be read due to unrecognized data format.',
        isCorrupted: true,
      }
    }

    return { data: trips, error: null, isCorrupted: false }
  } catch {
    return {
      data: [],
      error: 'Saved trips data is corrupted and could not be parsed.',
      isCorrupted: true,
    }
  }
}

export function saveStoredTrips(trips: Trip[]): { success: boolean; error: string | null } {
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'Local storage is disabled or unavailable.' }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.TRIPS)
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
          window.localStorage.setItem(`${STORAGE_KEYS.TRIPS}-corrupted-${Date.now()}`, raw)
          console.warn('Preserved corrupted trips data in backup key before saving.')
        }
      } catch {
        window.localStorage.setItem(`${STORAGE_KEYS.TRIPS}-corrupted-${Date.now()}`, raw)
        console.warn('Preserved unparseable trips data in backup key before saving.')
      }
    }
    window.localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips))
    return { success: true, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not write trips to localStorage'
    return { success: false, error: message }
  }
}

export function getStoredExpenses(tripId: string): StorageResult<Expense[]> {
  if (!isLocalStorageAvailable()) {
    return {
      data: [],
      error: 'Local storage is disabled or unavailable.',
      isCorrupted: false,
    }
  }

  const key = STORAGE_KEYS.expenses(tripId)
  const raw = window.localStorage.getItem(key)
  if (raw === null) {
    return { data: [], error: null, isCorrupted: false }
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return {
        data: [],
        error: `Existing expense data for trip ${tripId} is malformed.`,
        isCorrupted: true,
      }
    }

    const expenses: Expense[] = []
    let hadInvalidItems = false
    for (const item of parsed) {
      const expense = sanitizeExpense(item)
      if (expense) {
        expenses.push(expense)
      } else {
        hadInvalidItems = true
      }
    }

    if (hadInvalidItems && expenses.length === 0 && parsed.length > 0) {
      return {
        data: [],
        error: 'Saved expenses could not be read due to unrecognized data format.',
        isCorrupted: true,
      }
    }

    return { data: expenses, error: null, isCorrupted: false }
  } catch {
    return {
      data: [],
      error: 'Saved expenses data is corrupted and could not be parsed.',
      isCorrupted: true,
    }
  }
}

export function saveStoredExpenses(
  tripId: string,
  expenses: Expense[],
): { success: boolean; error: string | null } {
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'Local storage is disabled or unavailable.' }
  }

  const key = STORAGE_KEYS.expenses(tripId)
  try {
    const raw = window.localStorage.getItem(key)
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
          window.localStorage.setItem(`${key}-corrupted-${Date.now()}`, raw)
          console.warn(`Preserved corrupted expenses for trip ${tripId} before saving.`)
        }
      } catch {
        window.localStorage.setItem(`${key}-corrupted-${Date.now()}`, raw)
        console.warn(`Preserved unparseable expenses for trip ${tripId} before saving.`)
      }
    }
    window.localStorage.setItem(key, JSON.stringify(expenses))
    return { success: true, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not write expenses to localStorage'
    return { success: false, error: message }
  }
}

export function deleteStoredExpenses(tripId: string): { success: boolean; error: string | null } {
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'Local storage is disabled or unavailable.' }
  }

  const key = STORAGE_KEYS.expenses(tripId)
  try {
    window.localStorage.removeItem(key)
    return { success: true, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not remove expenses from localStorage'
    return { success: false, error: message }
  }
}

export function createExportBackup(): AureliaBackup {
  const tripsResult = getStoredTrips()
  const expensesMap: Record<string, Expense[]> = {}

  for (const trip of tripsResult.data) {
    const expResult = getStoredExpenses(trip.id)
    expensesMap[trip.id] = expResult.data
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'Aurelia Convert',
    trips: tripsResult.data,
    expenses: expensesMap,
  }
}

export function downloadBackupFile(): boolean {
  try {
    const backup = createExportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `aurelia-backup-${dateStr}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error('Failed to export backup file:', error)
    return false
  }
}
