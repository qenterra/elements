import { browser } from 'wxt/browser'

const SYNC_ITEM_SAFE_BYTES = 7500
const SYNC_BATCH_SIZE = 15

function byteLength(value: unknown): number {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  return new TextEncoder().encode(serialized).length
}

async function get<T>(key: string, fallback: T): Promise<T> {
  const fromSync = await browser.storage.sync.get(key)
  if (key in fromSync) return fromSync[key] as T

  const fromLocal = await browser.storage.local.get(key)
  if (key in fromLocal) return fromLocal[key] as T

  return fallback
}

async function set(key: string, value: unknown): Promise<void> {
  if (byteLength(value) <= SYNC_ITEM_SAFE_BYTES) {
    try {
      await browser.storage.sync.set({ [key]: value })
      await browser.storage.local.remove(key)
      return
    } catch {
      // Sync quota is a preference, not a reason to lose a user's rule.
    }
  }

  await browser.storage.local.set({ [key]: value })
  await browser.storage.sync.remove(key).catch(() => undefined)
}

async function setMany(entries: Array<[string, unknown]>): Promise<void> {
  const small = entries.filter(([, value]) => byteLength(value) <= SYNC_ITEM_SAFE_BYTES)
  const large = entries.filter(([, value]) => byteLength(value) > SYNC_ITEM_SAFE_BYTES)

  for (let index = 0; index < small.length; index += SYNC_BATCH_SIZE) {
    const chunk = Object.fromEntries(small.slice(index, index + SYNC_BATCH_SIZE))
    try {
      await browser.storage.sync.set(chunk)
      await browser.storage.local.remove(Object.keys(chunk))
    } catch {
      await browser.storage.local.set(chunk)
    }
  }

  if (large.length) await browser.storage.local.set(Object.fromEntries(large))
}

async function remove(keyOrKeys: string | string[]): Promise<void> {
  await Promise.all([
    browser.storage.sync.remove(keyOrKeys),
    browser.storage.local.remove(keyOrKeys),
  ])
}

async function entries(): Promise<Array<[string, unknown]>> {
  const [fromLocal, fromSync] = await Promise.all([
    browser.storage.local.get(null),
    browser.storage.sync.get(null),
  ])

  // Sync wins on collision. A stale local value can exist briefly during a
  // migration, while the sync copy is the user's intended source of truth.
  return Object.entries({ ...fromLocal, ...fromSync })
}

export const hybridStorage = { get, set, setMany, remove, entries }
