const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '..', 'src', 'services', 'storage.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const storageModule = new Module(sourcePath, module)
storageModule.filename = sourcePath
storageModule.paths = Module._nodeModulePaths(path.dirname(sourcePath))
storageModule._compile(compiled, sourcePath)
const { createExportBackup, deleteStoredTrip, parseBackup, restoreBackup, STORAGE_KEYS } = storageModule.exports

class MemoryStorage {
  values = new Map()
  failSet = null
  failRemove = null

  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) {
    if (this.failSet?.(key, value)) throw new Error(`injected set failure: ${key}`)
    this.values.set(key, String(value))
  }
  removeItem(key) {
    if (this.failRemove?.(key)) throw new Error(`injected remove failure: ${key}`)
    this.values.delete(key)
  }
}

const trip = { id: 'trip-1', name: 'Japan', destination: 'Tokyo', homeCurrency: 'INR', budget: 5000, createdAt: '2026-01-01T00:00:00.000Z' }
const expense = {
  id: 'expense-1', tripId: 'trip-1', description: 'Train', amount: 1200, currency: 'JPY',
  homeCurrency: 'INR', homeAmount: 720, rate: 0.6, rateDate: '2026-01-02', category: 'transport',
  date: '2026-01-02', createdAt: '2026-01-02T00:00:00.000Z',
}
const activity = { id: 'act-1', tripId: 'trip-1', date: '2026-01-02', title: 'Visit museum', completed: false, createdAt: '2026-01-01T00:00:00.000Z' }
const v1 = { version: 1, exportedAt: '2026-01-03T00:00:00.000Z', app: 'Aurelia Convert', trips: [trip], expenses: { 'trip-1': [expense] } }
const keyExpenses = STORAGE_KEYS.expenses('trip-1')
const keyItinerary = STORAGE_KEYS.itinerary('trip-1')
const keyJournal = STORAGE_KEYS.journal('trip-1')
const journalEntry = {
  id: 'journal-1', tripId: 'trip-1', title: 'A slow morning', date: '2026-01-02',
  content: 'Coffee with friends, then a long walk by the water.', createdAt: '2026-01-02T12:00:00.000Z',
}

test('accepts v1 backups without optional itineraries', () => {
  const preview = parseBackup(v1)
  assert.equal(preview.tripCount, 1)
  assert.equal(preview.expenseCount, 1)
  assert.equal(preview.itineraryCount, 0)
  assert.equal(preview.journalCount, 0)
  const storage = new MemoryStorage()
  const result = restoreBackup(preview, storage)
  assert.equal(result.success, true)
  assert.deepEqual(JSON.parse(storage.getItem(keyItinerary)), [])
  assert.equal(storage.getItem(keyJournal), null)
})

test('restoring an older backup preserves existing journal entries', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([trip]))
  storage.setItem(keyJournal, JSON.stringify([journalEntry]))
  const preview = parseBackup(v1)
  assert.equal(restoreBackup(preview, storage).success, true)
  assert.deepEqual(JSON.parse(storage.getItem(keyJournal)), [journalEntry])
})

test('validates and restores journal entries associated with their trip', () => {
  const preview = parseBackup({ ...v1, journals: { 'trip-1': [journalEntry] } })
  assert.equal(preview.journalCount, 1)
  const storage = new MemoryStorage()
  assert.equal(restoreBackup(preview, storage).success, true)
  assert.deepEqual(JSON.parse(storage.getItem(keyJournal)), [journalEntry])
})

test('exports journal entries in the existing version 1 backup', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([trip]))
  storage.setItem(keyJournal, JSON.stringify([journalEntry]))
  global.window = { localStorage: storage }
  try {
    const backup = createExportBackup()
    assert.equal(backup.version, 1)
    assert.deepEqual(backup.journals['trip-1'], [journalEntry])
  } finally {
    delete global.window
  }
})

test('rejects malformed journal entries without changing stored data', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, 'keep-this')
  const before = [...storage.values]
  assert.throws(() => parseBackup({ ...v1, journals: { 'trip-1': [{ ...journalEntry, content: '  ' }] } }))
  assert.throws(() => parseBackup({ ...v1, journals: { 'other-trip': [journalEntry] } }))
  assert.deepEqual([...storage.values], before)
})

test('rejects an invalid backup before any storage writes', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, 'keep-this')
  const before = [...storage.values]
  assert.throws(() => parseBackup({ ...v1, expenses: { 'trip-1': [{ ...expense, amount: 'bad' }] } }))
  assert.deepEqual([...storage.values], before)
})

test('validates again during restore and preserves old data on invalid input', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, 'keep-this')
  const result = restoreBackup({ backup: { ...v1, expenses: { 'trip-1': [{ ...expense, rate: 'bad' }] } }, tripCount: 1, expenseCount: 1, itineraryCount: 0 }, storage)
  assert.equal(result.success, false)
  assert.equal(storage.getItem(STORAGE_KEYS.TRIPS), 'keep-this')
})

test('rolls back all original data after a partial restore write failure', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([trip]))
  storage.setItem(keyExpenses, JSON.stringify([expense]))
  storage.setItem(keyItinerary, JSON.stringify([activity]))
  storage.setItem(keyJournal, JSON.stringify([journalEntry]))
  const before = [...storage.values]
  const preview = parseBackup({ ...v1, trips: [{ ...trip, name: 'New name' }] })
  let failed = false
  storage.failSet = (key, value) => {
    if (!failed && key === keyItinerary && value === '[]') { failed = true; return true }
    return false
  }
  const result = restoreBackup(preview, storage)
  storage.failSet = null
  assert.equal(result.success, false)
  assert.equal(result.rollbackFailed, undefined)
  assert.match(result.error, /Original data was restored/)
  assert.deepEqual([...storage.values], before)
})

test('preserves recovery data and distinguishes rollback failure', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([trip]))
  storage.setItem(keyExpenses, JSON.stringify([expense]))
  const oldExpenseData = storage.getItem(keyExpenses)
  const preview = parseBackup({ ...v1, expenses: { 'trip-1': [{ ...expense, amount: 1300 }] } })
  let failIncoming = true
  storage.failSet = (key, value) => {
    if (key === keyExpenses && value !== oldExpenseData && value !== null && failIncoming) { failIncoming = false; return true }
    if (key === keyExpenses && value === oldExpenseData) return true
    return false
  }
  const result = restoreBackup(preview, storage)
  assert.equal(result.success, false)
  assert.equal(result.rollbackFailed, true)
  assert.match(result.error, /Rollback also failed/)
  const recoveryKey = [...storage.values.keys()].find((key) => key.startsWith('aurelia-recovery-'))
  assert.ok(recoveryKey)
  assert.match(storage.getItem(recoveryKey), /expense-1/)
})

test('deletion rolls back related records after a partial multi-key failure', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([trip]))
  storage.setItem(keyExpenses, JSON.stringify([expense]))
  storage.setItem(keyItinerary, JSON.stringify([activity]))
  storage.setItem(keyJournal, JSON.stringify([journalEntry]))
  const before = [...storage.values]
  let failed = false
  storage.failRemove = (key) => {
    if (!failed && key === keyItinerary) { failed = true; return true }
    return false
  }
  const result = deleteStoredTrip('trip-1', storage)
  storage.failRemove = null
  assert.equal(result.success, false)
  assert.match(result.error, /Original data was restored/)
  assert.deepEqual([...storage.values].sort(([a], [b]) => a.localeCompare(b)), before.sort(([a], [b]) => a.localeCompare(b)))
})

test('deleting a trip removes its journal along with its other trip data', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([trip]))
  storage.setItem(keyExpenses, JSON.stringify([expense]))
  storage.setItem(keyItinerary, JSON.stringify([activity]))
  storage.setItem(keyJournal, JSON.stringify([journalEntry]))
  assert.equal(deleteStoredTrip('trip-1', storage).success, true)
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.TRIPS)), [])
  assert.equal(storage.getItem(keyExpenses), null)
  assert.equal(storage.getItem(keyItinerary), null)
  assert.equal(storage.getItem(keyJournal), null)
})

test('restore keeps historical expense values and currency fields unchanged', () => {
  const storage = new MemoryStorage()
  const preview = parseBackup({ ...v1, itineraries: { 'trip-1': [activity] } })
  const result = restoreBackup(preview, storage)
  assert.equal(result.success, true)
  const restored = JSON.parse(storage.getItem(keyExpenses))[0]
  for (const field of ['amount', 'homeAmount', 'rate', 'currency', 'homeCurrency', 'rateDate']) {
    assert.equal(restored[field], expense[field], `${field} should remain unchanged`)
  }
  assert.deepEqual(JSON.parse(storage.getItem(keyItinerary)), [activity])
})
