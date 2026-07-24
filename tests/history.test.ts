import { describe, expect, it } from 'vitest'
import { SnapshotHistory } from '../src/content/history'

function history() {
  return new SnapshotHistory<number[]>(
    (value) => [...value],
    (left, right) => JSON.stringify(left) === JSON.stringify(right),
  )
}

describe('SnapshotHistory', () => {
  it('undoes and redoes complete state transitions', () => {
    const value = history()
    value.record([1], [1, 2])
    value.record([1, 2], [1, 3])

    expect(value.undo()).toEqual([1, 2])
    expect(value.undo()).toEqual([1])
    expect(value.redo()).toEqual([1, 2])
    expect(value.redo()).toEqual([1, 3])
  })

  it('does not record no-op transitions and clears redo on a new branch', () => {
    const value = history()
    value.record([1], [1])
    expect(value.canUndo).toBe(false)

    value.record([1], [2])
    expect(value.undo()).toEqual([1])
    value.record([1], [3])
    expect(value.canRedo).toBe(false)
  })

  it('returns cloned snapshots so callers cannot mutate history', () => {
    const value = history()
    const after = [1, 2]
    value.record([1], after)
    after.push(3)
    expect(value.undo()).toEqual([1])
    expect(value.redo()).toEqual([1, 2])
  })
})
