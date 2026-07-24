export interface HistoryEntry<T> {
  before: T
  after: T
}

export class SnapshotHistory<T> {
  private undoEntries: Array<HistoryEntry<T>> = []
  private redoEntries: Array<HistoryEntry<T>> = []

  constructor(
    private readonly clone: (value: T) => T,
    private readonly equal: (left: T, right: T) => boolean,
  ) {}

  get canUndo(): boolean {
    return this.undoEntries.length > 0
  }

  get canRedo(): boolean {
    return this.redoEntries.length > 0
  }

  record(before: T, after: T): void {
    if (this.equal(before, after)) return
    this.undoEntries.push({
      before: this.clone(before),
      after: this.clone(after),
    })
    this.redoEntries = []
  }

  undo(): T | null {
    const entry = this.undoEntries.pop()
    if (!entry) return null
    this.redoEntries.push(entry)
    return this.clone(entry.before)
  }

  redo(): T | null {
    const entry = this.redoEntries.pop()
    if (!entry) return null
    this.undoEntries.push(entry)
    return this.clone(entry.after)
  }

  clear(): void {
    this.undoEntries = []
    this.redoEntries = []
  }
}
