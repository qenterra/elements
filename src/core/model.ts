export type EditAction = 'round' | 'text'

/** On disk, a missing action means hide. */
export interface PersistedEdit {
  selector: string
  permanent: boolean
  action?: EditAction
  text?: string
}

export interface RuntimeEdit extends PersistedEdit {
  /** Captured at runtime for the preview action; never persisted. */
  _original?: string
}

export interface ExtensionSettings {
  remember: boolean
}

export interface PathToken {
  label: string
  active: boolean
}

export interface OverlaySnapshot {
  minimized: boolean
  previewOriginal: boolean
  hotkey: string
  settings: ExtensionSettings
  edits: RuntimeEdit[]
  path: PathToken[]
}

export const DEFAULT_SETTINGS: ExtensionSettings = { remember: true }

export function normalizePersistedEdits(value: unknown): RuntimeEdit[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate): RuntimeEdit[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Record<string, unknown>
    if (typeof item.selector !== 'string' || !item.selector.trim()) return []
    if (item.action !== undefined && item.action !== 'round' && item.action !== 'text') return []
    if (item.text !== undefined && typeof item.text !== 'string') return []

    const action = item.action as EditAction | undefined
    const text = item.action === 'text' && item.text !== undefined ? item.text : undefined

    return [{
      selector: item.selector.trim(),
      permanent: item.permanent !== false,
      ...(action ? { action } : {}),
      ...(text !== undefined ? { text } : {}),
    }]
  })
}
