import type { Expense, ExpenseCategory, ItineraryActivity, JournalEntry, Trip } from '../types/trip'

export const STORAGE_KEYS = {
  TRIPS: 'aurelia-trips',
  expenses: (tripId: string) => `aurelia-expenses-${tripId}`,
  itinerary: (tripId: string) => `aurelia-itinerary-${tripId}`,
  journal: (tripId: string) => `aurelia-journal-${tripId}`,
} as const

const VALID_CATEGORIES: ExpenseCategory[] = [
  'food',
  'transport',
  'accommodation',
  'activities',
  'shopping',
  'general',
]

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
  itineraries?: Record<string, ItineraryActivity[]>
  journals?: Record<string, JournalEntry[]>
}

export type BackupPreview = {
  backup: AureliaBackup
  tripCount: number
  expenseCount: number
  itineraryCount: number
  journalCount: number
}

export type StorageOperationResult = {
  success: boolean
  error: string | null
  rollbackFailed?: boolean
  warning?: string
}

type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>

const RECOVERY_PREFIX = 'aurelia-recovery-'
const APP_DATA_PREFIXES = ['aurelia-trips', 'aurelia-expenses-', 'aurelia-itinerary-', 'aurelia-journal-']

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
    startDate: typeof t.startDate === 'string' && t.startDate ? t.startDate : undefined,
    endDate: typeof t.endDate === 'string' && t.endDate ? t.endDate : undefined,
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
  const createdAt = typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString()
  const rateDate = typeof e.rateDate === 'string' ? e.rateDate : createdAt.slice(0, 10)

  const rawCat = typeof e.category === 'string' ? e.category.toLowerCase() : 'general'
  const category: ExpenseCategory = VALID_CATEGORIES.includes(rawCat as ExpenseCategory)
    ? (rawCat as ExpenseCategory)
    : 'general'

  const date = typeof e.date === 'string' && e.date.trim() ? e.date.trim() : rateDate

  return {
    id: e.id,
    tripId: e.tripId,
    description: e.description,
    amount,
    currency: typeof e.currency === 'string' ? e.currency : 'USD',
    homeCurrency: typeof e.homeCurrency === 'string' ? e.homeCurrency : 'INR',
    homeAmount: Number.isFinite(homeAmount) ? homeAmount : amount,
    rate: Number.isFinite(rate) ? rate : 1,
    rateDate,
    category,
    date,
    notes: typeof e.notes === 'string' && e.notes.trim() ? e.notes.trim() : undefined,
    activityId:
      typeof e.activityId === 'string' && e.activityId.trim() ? e.activityId.trim() : undefined,
    createdAt,
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
    if (window.localStorage.getItem(STORAGE_KEYS.TRIPS) !== JSON.stringify(trips)) {
      throw new Error('Trip save could not be verified.')
    }
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
    if (window.localStorage.getItem(key) !== JSON.stringify(expenses)) {
      throw new Error('Expense save could not be verified.')
    }
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
    if (window.localStorage.getItem(key) !== null) throw new Error('Expense deletion could not be verified.')
    return { success: true, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not remove expenses from localStorage'
    return { success: false, error: message }
  }
}

function sanitizeItineraryActivity(item: unknown): ItineraryActivity | null {
  if (!item || typeof item !== 'object') return null
  const a = item as Record<string, unknown>
  if (typeof a.id !== 'string' || !a.id) return null
  if (typeof a.tripId !== 'string' || !a.tripId) return null
  if (typeof a.date !== 'string' || !a.date) return null
  if (typeof a.title !== 'string' || !a.title) return null

  return {
    id: a.id,
    tripId: a.tripId,
    date: a.date,
    title: a.title,
    startTime: typeof a.startTime === 'string' && a.startTime ? a.startTime : undefined,
    endTime: typeof a.endTime === 'string' && a.endTime ? a.endTime : undefined,
    locationName: typeof a.locationName === 'string' && a.locationName ? a.locationName : undefined,
    locationAddress:
      typeof a.locationAddress === 'string' && a.locationAddress ? a.locationAddress : undefined,
    notes: typeof a.notes === 'string' && a.notes ? a.notes : undefined,
    completed: Boolean(a.completed),
    createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
  }
}

export function getStoredItinerary(tripId: string): StorageResult<ItineraryActivity[]> {
  if (!isLocalStorageAvailable()) {
    return {
      data: [],
      error: 'Local storage is disabled or unavailable.',
      isCorrupted: false,
    }
  }

  const key = STORAGE_KEYS.itinerary(tripId)
  const raw = window.localStorage.getItem(key)
  if (raw === null) {
    return { data: [], error: null, isCorrupted: false }
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return {
        data: [],
        error: `Existing itinerary data for trip ${tripId} is malformed.`,
        isCorrupted: true,
      }
    }

    const activities: ItineraryActivity[] = []
    let hadInvalidItems = false
    for (const item of parsed) {
      const act = sanitizeItineraryActivity(item)
      if (act) {
        activities.push(act)
      } else {
        hadInvalidItems = true
      }
    }

    if (hadInvalidItems && activities.length === 0 && parsed.length > 0) {
      return {
        data: [],
        error: 'Saved itinerary could not be read due to unrecognized data format.',
        isCorrupted: true,
      }
    }

    return { data: activities, error: null, isCorrupted: false }
  } catch {
    return {
      data: [],
      error: 'Saved itinerary data is corrupted and could not be parsed.',
      isCorrupted: true,
    }
  }
}

export function saveStoredItinerary(
  tripId: string,
  activities: ItineraryActivity[],
): { success: boolean; error: string | null } {
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'Local storage is disabled or unavailable.' }
  }

  const key = STORAGE_KEYS.itinerary(tripId)
  try {
    const raw = window.localStorage.getItem(key)
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
          window.localStorage.setItem(`${key}-corrupted-${Date.now()}`, raw)
          console.warn(`Preserved corrupted itinerary for trip ${tripId} before saving.`)
        }
      } catch {
        window.localStorage.setItem(`${key}-corrupted-${Date.now()}`, raw)
        console.warn(`Preserved unparseable itinerary for trip ${tripId} before saving.`)
      }
    }
    window.localStorage.setItem(key, JSON.stringify(activities))
    if (window.localStorage.getItem(key) !== JSON.stringify(activities)) {
      throw new Error('Itinerary save could not be verified.')
    }
    return { success: true, error: null }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not write itinerary to localStorage'
    return { success: false, error: message }
  }
}

export function deleteStoredItinerary(tripId: string): { success: boolean; error: string | null } {
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'Local storage is disabled or unavailable.' }
  }

  const key = STORAGE_KEYS.itinerary(tripId)
  try {
    window.localStorage.removeItem(key)
    if (window.localStorage.getItem(key) !== null) throw new Error('Itinerary deletion could not be verified.')
    return { success: true, error: null }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not remove itinerary from localStorage'
    return { success: false, error: message }
  }
}

function sanitizeJournalEntry(item: unknown): JournalEntry | null {
  if (!isRecord(item)) return null
  if (typeof item.id !== 'string' || !item.id || typeof item.tripId !== 'string' || !item.tripId) return null
  if (typeof item.title !== 'string' || !item.title.trim()) return null
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null
  const date = new Date(`${item.date}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== item.date) return null
  if (typeof item.content !== 'string' || !item.content.trim()) return null
  if (typeof item.createdAt !== 'string' || !item.createdAt) return null
  return {
    id: item.id,
    tripId: item.tripId,
    title: item.title,
    date: item.date,
    content: item.content,
    createdAt: item.createdAt,
  }
}

export function getStoredJournal(tripId: string): StorageResult<JournalEntry[]> {
  if (!isLocalStorageAvailable()) {
    return { data: [], error: 'Local storage is disabled or unavailable.', isCorrupted: false }
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.journal(tripId))
  if (raw === null) return { data: [], error: null, isCorrupted: false }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return { data: [], error: `Existing journal data for trip ${tripId} is malformed.`, isCorrupted: true }
    }
    const entries = parsed.map(sanitizeJournalEntry)
    if (entries.some((entry) => !entry || entry.tripId !== tripId)) {
      return { data: [], error: `Saved journal for trip ${tripId} contains invalid entries.`, isCorrupted: true }
    }
    return { data: entries as JournalEntry[], error: null, isCorrupted: false }
  } catch {
    return { data: [], error: `Saved journal data for trip ${tripId} is corrupted and could not be parsed.`, isCorrupted: true }
  }
}

export function saveStoredJournal(
  tripId: string,
  entries: JournalEntry[],
): { success: boolean; error: string | null } {
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'Local storage is disabled or unavailable.' }
  }
  if (entries.some((entry) => !sanitizeJournalEntry(entry) || entry.tripId !== tripId)) {
    return { success: false, error: 'Journal entries are invalid or belong to another trip.' }
  }
  const key = STORAGE_KEYS.journal(tripId)
  try {
    const raw = window.localStorage.getItem(key)
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw)
        const validStoredEntries = Array.isArray(parsed) && parsed.every((item) => {
          const entry = sanitizeJournalEntry(item)
          return entry !== null && entry.tripId === tripId
        })
        if (!validStoredEntries) {
          window.localStorage.setItem(`${key}-corrupted-${Date.now()}`, raw)
        }
      } catch {
        window.localStorage.setItem(`${key}-corrupted-${Date.now()}`, raw)
      }
    }
    const serialized = JSON.stringify(entries)
    window.localStorage.setItem(key, serialized)
    if (window.localStorage.getItem(key) !== serialized) throw new Error('Journal save could not be verified.')
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not save journal entries.' }
  }
}

export function deleteStoredJournal(tripId: string): { success: boolean; error: string | null } {
  if (!isLocalStorageAvailable()) {
    return { success: false, error: 'Local storage is disabled or unavailable.' }
  }
  const key = STORAGE_KEYS.journal(tripId)
  try {
    window.localStorage.removeItem(key)
    if (window.localStorage.getItem(key) !== null) throw new Error('Journal deletion could not be verified.')
    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not remove journal entries.' }
  }
}

export function createExportBackup(): AureliaBackup {
  const tripsResult = getStoredTrips()
  if (tripsResult.error) throw new Error(tripsResult.error)
  const expensesMap: Record<string, Expense[]> = {}
  const itinerariesMap: Record<string, ItineraryActivity[]> = {}
  const journalsMap: Record<string, JournalEntry[]> = {}

  for (const trip of tripsResult.data) {
    const expResult = getStoredExpenses(trip.id)
    if (expResult.error) throw new Error(expResult.error)
    expensesMap[trip.id] = expResult.data

    const itinResult = getStoredItinerary(trip.id)
    if (itinResult.error) throw new Error(itinResult.error)
    itinerariesMap[trip.id] = itinResult.data

    const journalResult = getStoredJournal(trip.id)
    if (journalResult.error) throw new Error(journalResult.error)
    journalsMap[trip.id] = journalResult.data
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'Aurelia Convert',
    trips: tripsResult.data,
    expenses: expensesMap,
    itineraries: itinerariesMap,
    journals: journalsMap,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Validate the entire file before creating any storage writes. V1 backups without itineraries remain valid. */
export function parseBackup(input: unknown): BackupPreview {
  if (!isRecord(input) || input.version !== 1 || input.app !== 'Aurelia Convert') {
    throw new Error('Unsupported or invalid backup format.')
  }
  if (!Array.isArray(input.trips) || !isRecord(input.expenses)) {
    throw new Error('Backup must contain trips and expenses.')
  }
  if (input.itineraries !== undefined && !isRecord(input.itineraries)) {
    throw new Error('Backup itineraries must be an object when provided.')
  }
  if (input.journals !== undefined && !isRecord(input.journals)) {
    throw new Error('Backup journals must be an object when provided.')
  }

  const trips = input.trips.map(sanitizeTrip)
  if (trips.some((trip) => !trip)) throw new Error('Backup contains an invalid trip.')
  if (input.trips.some((item) => !isRecord(item) || typeof item.budget !== 'number' || !Number.isFinite(item.budget))) {
    throw new Error('Backup contains a trip with an invalid budget.')
  }
  const safeTrips = trips as Trip[]
  const tripIds = new Set(safeTrips.map((trip) => trip.id))
  if (tripIds.size !== safeTrips.length) throw new Error('Backup contains duplicate trip IDs.')

  const expenses: Record<string, Expense[]> = {}
  for (const [tripId, rawItems] of Object.entries(input.expenses)) {
    if (!tripIds.has(tripId) || !Array.isArray(rawItems)) {
      throw new Error(`Backup contains expenses for an unknown trip (${tripId}).`)
    }
    const entries = rawItems.map((item) => {
      if (!isRecord(item) || typeof item.currency !== 'string' || typeof item.homeCurrency !== 'string' ||
          typeof item.rateDate !== 'string' || typeof item.amount !== 'number' || !Number.isFinite(item.amount) ||
          typeof item.homeAmount !== 'number' || !Number.isFinite(item.homeAmount) ||
          typeof item.rate !== 'number' || !Number.isFinite(item.rate)) return null
      return sanitizeExpense(item)
    })
    if (entries.some((expense) => !expense || expense.tripId !== tripId)) {
      throw new Error(`Backup contains an invalid expense for trip ${tripId}.`)
    }
    expenses[tripId] = entries as Expense[]
  }

  const itineraries: Record<string, ItineraryActivity[]> = {}
  for (const [tripId, rawItems] of Object.entries(input.itineraries ?? {})) {
    if (!tripIds.has(tripId) || !Array.isArray(rawItems)) {
      throw new Error(`Backup contains itinerary data for an unknown trip (${tripId}).`)
    }
    const entries = rawItems.map(sanitizeItineraryActivity)
    if (entries.some((activity) => !activity || activity.tripId !== tripId)) {
      throw new Error(`Backup contains an invalid itinerary activity for trip ${tripId}.`)
    }
    itineraries[tripId] = entries as ItineraryActivity[]
  }

  const journals: Record<string, JournalEntry[]> = {}
  for (const [tripId, rawItems] of Object.entries(input.journals ?? {})) {
    if (!tripIds.has(tripId) || !Array.isArray(rawItems)) {
      throw new Error(`Backup contains journal data for an unknown trip (${tripId}).`)
    }
    const entries = rawItems.map(sanitizeJournalEntry)
    if (entries.some((entry) => !entry || entry.tripId !== tripId)) {
      throw new Error(`Backup contains an invalid journal entry for trip ${tripId}.`)
    }
    const validEntries = entries as JournalEntry[]
    const entryIds = new Set(validEntries.map((entry) => entry.id))
    if (entryIds.size !== validEntries.length) {
      throw new Error(`Backup contains duplicate journal entry IDs for trip ${tripId}.`)
    }
    journals[tripId] = validEntries
  }

  const backup: AureliaBackup = {
    version: 1,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : '',
    app: 'Aurelia Convert',
    trips: safeTrips,
    expenses,
    itineraries,
    journals: input.journals === undefined ? undefined : journals,
  }
  return {
    backup,
    tripCount: safeTrips.length,
    expenseCount: Object.values(expenses).reduce((sum, items) => sum + items.length, 0),
    itineraryCount: Object.values(itineraries).reduce((sum, items) => sum + items.length, 0),
    journalCount: Object.values(journals).reduce((sum, items) => sum + items.length, 0),
  }
}

function appDataKeys(storage: StorageLike): string[] {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key && APP_DATA_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix))) keys.push(key)
  }
  return keys
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function commitWithRecovery(storage: StorageLike, changes: Map<string, string | null>): StorageOperationResult {
  let originals: Record<string, string | null>
  try {
    originals = Object.fromEntries([...changes.keys()].map((key) => [key, storage.getItem(key)]))
  } catch (error) {
    return { success: false, error: `Could not capture current data: ${errorMessage(error)}` }
  }

  const recoveryKey = `${RECOVERY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`
  const snapshot = JSON.stringify({ createdAt: new Date().toISOString(), originals })
  try {
    storage.setItem(recoveryKey, snapshot)
    if (storage.getItem(recoveryKey) !== snapshot) throw new Error('Recovery snapshot could not be verified.')
  } catch (error) {
    return { success: false, error: `Could not establish recovery snapshot: ${errorMessage(error)}` }
  }

  try {
    for (const [key, value] of changes) {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
      if (storage.getItem(key) !== value) throw new Error(`Write verification failed for ${key}.`)
    }
  } catch (error) {
    const operationError = errorMessage(error)
    try {
      for (const [key, value] of Object.entries(originals)) {
        if (value === null) storage.removeItem(key)
        else storage.setItem(key, value)
        if (storage.getItem(key) !== value) throw new Error(`Rollback verification failed for ${key}.`)
      }
    } catch (rollbackError) {
      return {
        success: false,
        error: `Operation failed: ${operationError}. Rollback also failed: ${errorMessage(rollbackError)}. Recovery data is preserved under ${recoveryKey}.`,
        rollbackFailed: true,
      }
    }
    try { storage.removeItem(recoveryKey) } catch { /* stale snapshot is safe after verified rollback */ }
    return { success: false, error: `Operation failed: ${operationError}. Original data was restored.` }
  }

  let warning: string | undefined
  try { storage.removeItem(recoveryKey) } catch {
    warning = `Operation completed; recovery snapshot remains under ${recoveryKey}.`
  }
  return { success: true, error: null, warning }
}

export function restoreBackup(preview: BackupPreview, providedStorage?: StorageLike): StorageOperationResult {
  let backup: AureliaBackup
  let storage: StorageLike
  try {
    storage = providedStorage ?? window.localStorage
    backup = parseBackup(preview.backup).backup
  } catch (error) {
    return { success: false, error: `Backup validation or storage access failed: ${errorMessage(error)}` }
  }
  const changes = new Map<string, string | null>()
  let existingKeys: string[]
  try {
    existingKeys = appDataKeys(storage)
    for (const key of existingKeys) changes.set(key, null)
    if (backup.journals === undefined) {
      for (const key of existingKeys) {
        if (key.startsWith('aurelia-journal-')) changes.set(key, storage.getItem(key))
      }
    }
  } catch (error) {
    return { success: false, error: `Could not inspect current data: ${errorMessage(error)}` }
  }
  changes.set(STORAGE_KEYS.TRIPS, JSON.stringify(backup.trips))
  for (const trip of backup.trips) {
    changes.set(STORAGE_KEYS.expenses(trip.id), JSON.stringify(backup.expenses[trip.id] ?? []))
    changes.set(STORAGE_KEYS.itinerary(trip.id), JSON.stringify(backup.itineraries?.[trip.id] ?? []))
    if (backup.journals !== undefined) {
      changes.set(STORAGE_KEYS.journal(trip.id), JSON.stringify(backup.journals[trip.id] ?? []))
    }
  }
  return commitWithRecovery(storage, changes)
}

export function deleteStoredTrip(tripId: string, providedStorage?: StorageLike): StorageOperationResult {
  let storage: StorageLike
  let trips: Trip[]
  try {
    storage = providedStorage ?? window.localStorage
    const raw = storage.getItem(STORAGE_KEYS.TRIPS)
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Saved trip data is malformed; nothing was deleted.')
    trips = parsed as Trip[]
  } catch (error) {
    return { success: false, error: `Could not read trips: ${errorMessage(error)}` }
  }
  const changes = new Map<string, string | null>([
    [STORAGE_KEYS.TRIPS, JSON.stringify(trips.filter((trip) => trip.id !== tripId))],
    [STORAGE_KEYS.expenses(tripId), null],
    [STORAGE_KEYS.itinerary(tripId), null],
    [STORAGE_KEYS.journal(tripId), null],
  ])
  return commitWithRecovery(storage, changes)
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
