export type PersistencePhase = 'saving' | 'saved' | 'failed'

export interface PersistenceSnapshot {
  phase: PersistencePhase
  revision: number
}

export interface PersistenceAttempt<T> {
  revision: number
  value: T
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

/**
 * Tracks only the newest non-blocking storage attempt. Responses may arrive in
 * any order; an old tab/storage response is never allowed to repaint newer UI.
 */
export class RevisionedPersistence<T> {
  private revision = 0
  private latest: T | undefined
  private state: PersistenceSnapshot = { phase: 'saved', revision: 0 }

  constructor(initial?: T) {
    if (initial !== undefined) this.latest = clone(initial)
  }

  get snapshot(): PersistenceSnapshot {
    return { ...this.state }
  }

  begin(value: T): PersistenceAttempt<T> {
    this.latest = clone(value)
    this.revision += 1
    this.state = { phase: 'saving', revision: this.revision }
    return { revision: this.revision, value: clone(value) }
  }

  settle(revision: number, succeeded: boolean): boolean {
    if (revision !== this.revision) return false
    this.state = { phase: succeeded ? 'saved' : 'failed', revision }
    return true
  }

  retry(): PersistenceAttempt<T> | null {
    if (this.latest === undefined) return null
    return this.begin(this.latest)
  }
}
