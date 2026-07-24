import { describe, expect, it } from 'vitest'
import { HybridStorage, type StorageArea } from '../src/core/hybrid-storage'

class MemoryArea implements StorageArea {
  readonly values: Record<string, unknown>
  failGet = false
  failSet = false
  failRemove = false

  constructor(initial: Record<string, unknown> = {}) {
    this.values = { ...initial }
  }

  async get(keys: string | string[] | null): Promise<Record<string, unknown>> {
    if (this.failGet) throw new Error('get unavailable')
    if (keys === null) return { ...this.values }
    const selected = Array.isArray(keys) ? keys : [keys]
    return Object.fromEntries(
      selected.filter((key) => key in this.values).map((key) => [key, this.values[key]]),
    )
  }

  async set(items: Record<string, unknown>): Promise<void> {
    if (this.failSet) throw new Error('set unavailable')
    Object.assign(this.values, items)
  }

  async remove(keys: string | string[]): Promise<void> {
    if (this.failRemove) throw new Error('remove unavailable')
    for (const key of Array.isArray(keys) ? keys : [keys]) delete this.values[key]
  }
}

function setup(
  syncValues: Record<string, unknown> = {},
  localValues: Record<string, unknown> = {},
) {
  const sync = new MemoryArea(syncValues)
  const local = new MemoryArea(localValues)
  return { sync, local, storage: new HybridStorage(sync, local) }
}

describe('HybridStorage', () => {
  it('uses sync when both areas contain a key', async () => {
    const { storage } = setup({ rules: 'sync' }, { rules: 'local' })
    await expect(storage.get('rules', 'fallback')).resolves.toBe('sync')
  })

  it('falls back to local when sync reads are unavailable', async () => {
    const { storage, sync } = setup({}, { rules: 'local' })
    sync.failGet = true
    await expect(storage.get('rules', 'fallback')).resolves.toBe('local')
  })

  it('removes stale sync copies after a batched fallback', async () => {
    const { storage, sync, local } = setup({ rules: 'old' })
    sync.failSet = true

    await storage.setMany([['rules', 'new']])

    expect(sync.values.rules).toBeUndefined()
    expect(local.values.rules).toBe('new')
    await expect(storage.get('rules', 'fallback')).resolves.toBe('new')
  })

  it('keeps local data authoritative when stale sync removal is unavailable', async () => {
    const { storage, sync, local } = setup({ rules: 'old' })
    sync.failSet = true
    sync.failRemove = true

    await storage.set('rules', 'new')

    expect(sync.values.rules).toBe('old')
    expect(local.values.rules).toBe('new')
    await expect(storage.get('rules', 'fallback')).resolves.toBe('new')
    await expect(storage.entries()).resolves.toContainEqual(['rules', 'new'])
  })

  it('stores oversized values locally and hides stale sync data', async () => {
    const { storage, sync, local } = setup({ rules: 'old' })
    const large = 'x'.repeat(7600)

    await storage.set('rules', large)

    expect(sync.values.rules).toBeUndefined()
    expect(local.values.rules).toBe(large)
    await expect(storage.get('rules', 'fallback')).resolves.toBe(large)
  })

  it('uses a tombstone when sync deletion cannot complete', async () => {
    const { storage, sync } = setup({ rules: 'old' })
    sync.failRemove = true

    await storage.remove('rules')

    expect(sync.values.rules).toBe('old')
    await expect(storage.get('rules', 'fallback')).resolves.toBe('fallback')
    await expect(storage.entries()).resolves.not.toContainEqual(['rules', 'old'])
  })

  it('serializes writes so the last requested value wins', async () => {
    const { storage } = setup()
    await Promise.all([
      storage.set('settings', 'first'),
      storage.set('settings', 'second'),
      storage.set('settings', 'third'),
    ])
    await expect(storage.get('settings', '')).resolves.toBe('third')
  })
})
