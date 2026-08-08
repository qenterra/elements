import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/core/model'
import { SettingsWriteQueue } from '../src/core/settings-write-queue'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('SettingsWriteQueue', () => {
  it('rolls back a failed latest write to the last confirmed value without stale responses replacing newer UI', async () => {
    const first = deferred<typeof DEFAULT_SETTINGS>()
    const second = deferred<typeof DEFAULT_SETTINGS>()
    const writes = [first, second]
    const states: string[] = []
    const queue = new SettingsWriteQueue(
      DEFAULT_SETTINGS,
      async () => writes.shift()!.promise,
      (settings) => states.push(settings.theme),
      () => states.push('failed'),
    )

    queue.update({ theme: 'dark' })
    queue.update({ theme: 'light' })
    first.resolve({ ...DEFAULT_SETTINGS, theme: 'dark' })
    await Promise.resolve()
    await Promise.resolve()
    second.reject(new Error('write failed'))
    await queue.flush()

    expect(states).toEqual(['dark', 'light', 'failed', 'dark'])
    expect(queue.current.theme).toBe('dark')
  })
})
