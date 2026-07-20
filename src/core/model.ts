export type EditAction = 'round' | 'text' | 'blur' | 'dim' | 'gray' | 'css'

/** On disk, a missing action means hide. */
export interface PersistedEdit {
  selector: string
  permanent: boolean
  action?: EditAction
  text?: string
  /** Extra payload: corner radius in px for `round`, declarations for `css`. */
  value?: string
}

export interface RuntimeEdit extends PersistedEdit {
  /** Captured at runtime for the preview action; never persisted. */
  _original?: string
}

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export interface ExtensionSettings {
  remember: boolean
  theme: ThemePreference
  radius: number
  advanced: boolean
  coachmarkSeen: boolean
}

export interface PathToken {
  label: string
  active: boolean
}

export interface StatusNotice {
  id: number
  message: string
  undoable: boolean
}

export interface MarkedInfo {
  rect: { x: number; y: number; width: number; height: number }
  label: string
}

export interface OverlaySnapshot {
  minimized: boolean
  previewOriginal: boolean
  paused: boolean
  hotkey: string
  settings: ExtensionSettings
  edits: RuntimeEdit[]
  path: PathToken[]
  status: StatusNotice | null
  marked: MarkedInfo | null
  textEditRect: MarkedInfo['rect'] | null
  resolvedTheme: ResolvedTheme
  showCoachmark: boolean
  canUndo: boolean
  canRedo: boolean
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  remember: true,
  theme: 'system',
  radius: 12,
  advanced: false,
  coachmarkSeen: false,
}

export const MIN_RADIUS = 2
export const MAX_RADIUS = 32

export function normalizeSettings(value: unknown): ExtensionSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const theme = raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system'
  const radius = typeof raw.radius === 'number' && Number.isFinite(raw.radius)
    ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(raw.radius)))
    : DEFAULT_SETTINGS.radius
  return {
    remember: raw.remember !== false,
    theme,
    radius,
    advanced: raw.advanced === true,
    coachmarkSeen: raw.coachmarkSeen === true,
  }
}

const KNOWN_ACTIONS: ReadonlySet<string> = new Set(['round', 'text', 'blur', 'dim', 'gray', 'css'])

export function normalizePersistedEdits(value: unknown): RuntimeEdit[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate): RuntimeEdit[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Record<string, unknown>
    if (typeof item.selector !== 'string' || !item.selector.trim()) return []
    if (item.action !== undefined && (typeof item.action !== 'string' || !KNOWN_ACTIONS.has(item.action))) return []
    if (item.text !== undefined && typeof item.text !== 'string') return []

    const action = item.action as EditAction | undefined
    const text = action === 'text' && item.text !== undefined ? item.text : undefined

    let payload: string | undefined
    if (action === 'round' && typeof item.value === 'string' && /^\d{1,3}$/.test(item.value)) payload = item.value
    if (action === 'css' && typeof item.value === 'string') {
      const sanitized = sanitizeCssDeclarations(item.value)
      if (!sanitized) return []
      payload = item.value
    }

    return [{
      selector: item.selector.trim(),
      permanent: item.permanent !== false,
      ...(action ? { action } : {}),
      ...(text !== undefined ? { text } : {}),
      ...(payload !== undefined ? { value: payload } : {}),
    }]
  })
}

/**
 * Validate a user-supplied list of CSS declarations for the custom-CSS
 * action. Returns the normalized declaration list with `!important` applied,
 * or null when the input cannot be trusted.
 */
export function sanitizeCssDeclarations(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 500) return null
  if (/[{}<>\\]/.test(trimmed)) return null
  if (/@|url\s*\(|expression\s*\(|javascript:|behavior\s*:|\/\*|\*\//i.test(trimmed)) return null

  const declarations = trimmed.split(';').map((part) => part.trim()).filter(Boolean)
  if (!declarations.length) return null

  const normalized: string[] = []
  for (const declaration of declarations) {
    const match = /^(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^:;]+?)\s*(!important)?$/.exec(declaration)
    if (!match) return null
    normalized.push(`${match[1].toLowerCase()}: ${match[2]} !important`)
  }
  return `${normalized.join('; ')};`
}

/**
 * CSS declarations that implement an edit, or null when the edit is applied
 * to the DOM instead of a stylesheet (text edits).
 */
export function editDeclarations(edit: PersistedEdit, defaultRadius: number): string | null {
  switch (edit.action) {
    case 'text':
      return null
    case 'round': {
      const radius = edit.value !== undefined ? Number(edit.value) : defaultRadius
      return `border-radius: ${radius}px !important;`
    }
    case 'blur':
      return 'filter: blur(8px) !important;'
    case 'dim':
      return 'opacity: 0.35 !important;'
    case 'gray':
      return 'filter: grayscale(1) !important;'
    case 'css':
      return edit.value !== undefined ? sanitizeCssDeclarations(edit.value) : null
    default:
      return 'display: none !important;'
  }
}
