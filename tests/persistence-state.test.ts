import { describe, expect, it } from 'vitest'
import { RevisionedPersistence } from '../src/content/persistence-state'

describe('RevisionedPersistence', () => {
  it('tracks saving, saved, and failed attempts without letting stale responses win', () => {
    const tracker = new RevisionedPersistence<string[]>()
    const first = tracker.begin(['first'])
    const second = tracker.begin(['second'])

    expect(tracker.snapshot).toEqual({ phase: 'saving', revision: 2 })
    expect(tracker.settle(first.revision, false)).toBe(false)
    expect(tracker.snapshot).toEqual({ phase: 'saving', revision: 2 })
    expect(tracker.settle(second.revision, true)).toBe(true)
    expect(tracker.snapshot).toEqual({ phase: 'saved', revision: 2 })
  })

  it('retries the latest immutable snapshot and treats false, undefined, and rejection as failure', () => {
    const tracker = new RevisionedPersistence([{ selector: '#old' }])
    const first = tracker.begin([{ selector: '#latest' }])
    expect(tracker.settle(first.revision, false)).toBe(true)
    expect(tracker.snapshot.phase).toBe('failed')

    const retry = tracker.retry()
    expect(retry?.value).toEqual([{ selector: '#latest' }])
    retry?.value.push({ selector: '#mutated-copy' })
    expect(tracker.retry()?.value).toEqual([{ selector: '#latest' }])
  })
})
