export interface StorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string | string[]): Promise<void>
}

const SYNC_ITEM_SAFE_BYTES = 7500
const SYNC_BATCH_SIZE = 15
const LOCAL_ROUTE_KEY = '__elements_local_routes__'

function byteLength(value: unknown): number {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  return new TextEncoder().encode(serialized).length
}

function asRoutes(value: unknown): Set<string> {
  return new Set(
    Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [],
  )
}

export class HybridStorage {
  private writeTail: Promise<void> = Promise.resolve()

  constructor(
    private readonly sync: StorageArea,
    private readonly local: StorageArea,
  ) {}

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeTail.then(task, task)
    this.writeTail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async readArea(
    area: StorageArea,
    keys: string | string[] | null,
  ): Promise<Record<string, unknown>> {
    try {
      return await area.get(keys)
    } catch {
      return {}
    }
  }

  private async readRoutes(): Promise<Set<string>> {
    const stored = await this.readArea(this.local, LOCAL_ROUTE_KEY)
    return asRoutes(stored[LOCAL_ROUTE_KEY])
  }

  private async writeRoutes(routes: Set<string>): Promise<void> {
    if (routes.size) {
      await this.local.set({ [LOCAL_ROUTE_KEY]: [...routes].sort() })
    } else {
      await this.local.remove(LOCAL_ROUTE_KEY)
    }
  }

  private async addRoutes(keys: string[]): Promise<void> {
    if (!keys.length) return
    const routes = await this.readRoutes()
    keys.forEach((key) => routes.add(key))
    await this.writeRoutes(routes)
  }

  private async removeRoutes(keys: string[]): Promise<void> {
    if (!keys.length) return
    const routes = await this.readRoutes()
    keys.forEach((key) => routes.delete(key))
    await this.writeRoutes(routes)
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    await this.writeTail
    const routes = await this.readRoutes()
    if (routes.has(key)) {
      const fromLocal = await this.readArea(this.local, key)
      return key in fromLocal ? (fromLocal[key] as T) : fallback
    }

    const fromSync = await this.readArea(this.sync, key)
    if (key in fromSync) return fromSync[key] as T

    const fromLocal = await this.readArea(this.local, key)
    return key in fromLocal ? (fromLocal[key] as T) : fallback
  }

  set(key: string, value: unknown): Promise<void> {
    return this.enqueue(() => this.setManyNow([[key, value]]))
  }

  setMany(entries: Array<[string, unknown]>): Promise<void> {
    return this.enqueue(() => this.setManyNow(entries))
  }

  setLocal(key: string, value: unknown): Promise<void> {
    return this.enqueue(async () => {
      await this.local.set({ [key]: value })
      await this.addRoutes([key])
      await this.sync.remove(key).catch(() => undefined)
    })
  }

  private async setManyNow(entries: Array<[string, unknown]>): Promise<void> {
    const unique = [...new Map(entries).entries()]
    const small = unique.filter(([, value]) => byteLength(value) <= SYNC_ITEM_SAFE_BYTES)
    const large = unique.filter(([, value]) => byteLength(value) > SYNC_ITEM_SAFE_BYTES)

    for (let index = 0; index < small.length; index += SYNC_BATCH_SIZE) {
      const chunkEntries = small.slice(index, index + SYNC_BATCH_SIZE)
      const chunk = Object.fromEntries(chunkEntries)
      const keys = chunkEntries.map(([key]) => key)
      try {
        await this.sync.set(chunk)
        await this.local.remove(keys)
        await this.removeRoutes(keys)
      } catch {
        await this.local.set(chunk)
        await this.addRoutes(keys)
        await this.sync.remove(keys).catch(() => undefined)
      }
    }

    if (large.length) {
      const keys = large.map(([key]) => key)
      await this.local.set(Object.fromEntries(large))
      await this.addRoutes(keys)
      await this.sync.remove(keys).catch(() => undefined)
    }
  }

  remove(keyOrKeys: string | string[]): Promise<void> {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]
    return this.enqueue(async () => {
      if (!keys.length) return

      await this.local.remove(keys)
      // Keep a local tombstone until the sync copy is confirmed removed. This
      // prevents an unavailable sync area from resurrecting deleted data.
      await this.addRoutes(keys)
      try {
        await this.sync.remove(keys)
        await this.removeRoutes(keys)
      } catch {
        // The route marker remains authoritative until a later successful write.
      }
    })
  }

  async entries(): Promise<Array<[string, unknown]>> {
    await this.writeTail
    const [fromLocal, fromSync, routes] = await Promise.all([
      this.readArea(this.local, null),
      this.readArea(this.sync, null),
      this.readRoutes(),
    ])

    const localEntries = { ...fromLocal }
    delete localEntries[LOCAL_ROUTE_KEY]
    const merged: Record<string, unknown> = { ...localEntries, ...fromSync }
    for (const key of routes) {
      if (key in localEntries) merged[key] = localEntries[key]
      else delete merged[key]
    }
    return Object.entries(merged)
  }
}
