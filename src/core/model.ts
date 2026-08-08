export type EditAction = 'round' | 'text' | 'blur' | 'dim' | 'gray' | 'css'

/** On disk, a missing action means hide. */
export interface PersistedEdit {
  id?: string
  selector: string
  permanent: boolean
  action?: EditAction
  text?: string
  /** Extra payload: corner radius in px for `round`, declarations for `css`. */
  value?: string
  createdAt?: number
  updatedAt?: number
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
  incognito: boolean
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
  /** Previewing follows hover; Selected is the explicit locked action target. */
  selectionState: 'idle' | 'previewing' | 'selected'
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
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const theme = raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system'
  const radius =
    typeof raw.radius === 'number' && Number.isFinite(raw.radius)
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
const RULE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/
const EXTENSION_SELECTOR_PATTERN = /elements-extension|data-elements-extension/i

const SAFE_CSS_PROPERTIES: ReadonlySet<string> = new Set([
  'align-content',
  'align-items',
  'align-self',
  'backdrop-filter',
  'background',
  'background-color',
  'border',
  'border-block',
  'border-block-color',
  'border-block-end',
  'border-block-start',
  'border-bottom',
  'border-bottom-color',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-color',
  'border-inline',
  'border-inline-color',
  'border-inline-end',
  'border-inline-start',
  'border-left',
  'border-left-color',
  'border-radius',
  'border-right',
  'border-right-color',
  'border-style',
  'border-top',
  'border-top-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-width',
  'bottom',
  'box-shadow',
  'box-sizing',
  'clip-path',
  'color',
  'column-gap',
  'display',
  'filter',
  'flex',
  'flex-basis',
  'flex-direction',
  'flex-flow',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'font',
  'font-family',
  'font-feature-settings',
  'font-kerning',
  'font-size',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'gap',
  'grid',
  'grid-area',
  'grid-auto-columns',
  'grid-auto-flow',
  'grid-auto-rows',
  'grid-column',
  'grid-column-end',
  'grid-column-start',
  'grid-row',
  'grid-row-end',
  'grid-row-start',
  'grid-template',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'inset',
  'inset-block',
  'inset-block-end',
  'inset-block-start',
  'inset-inline',
  'inset-inline-end',
  'inset-inline-start',
  'isolation',
  'justify-content',
  'justify-items',
  'justify-self',
  'left',
  'letter-spacing',
  'line-height',
  'margin',
  'margin-block',
  'margin-block-end',
  'margin-block-start',
  'margin-bottom',
  'margin-inline',
  'margin-inline-end',
  'margin-inline-start',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'object-fit',
  'object-position',
  'opacity',
  'order',
  'outline',
  'outline-color',
  'outline-offset',
  'outline-style',
  'outline-width',
  'overflow',
  'overflow-wrap',
  'overflow-x',
  'overflow-y',
  'padding',
  'padding-block',
  'padding-block-end',
  'padding-block-start',
  'padding-bottom',
  'padding-inline',
  'padding-inline-end',
  'padding-inline-start',
  'padding-left',
  'padding-right',
  'padding-top',
  'pointer-events',
  'position',
  'right',
  'rotate',
  'row-gap',
  'scale',
  'text-align',
  'text-decoration',
  'text-decoration-color',
  'text-decoration-line',
  'text-decoration-style',
  'text-indent',
  'text-overflow',
  'text-shadow',
  'text-transform',
  'top',
  'transform',
  'transform-origin',
  'translate',
  'user-select',
  'vertical-align',
  'visibility',
  'white-space',
  'width',
  'word-break',
  'word-spacing',
  'z-index',
])

function optionalTimestamp(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined
}

export function isSafeSelectorText(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const selector = value.trim()
  if (!selector || selector.length > 1_000) return false
  if (
    [...selector].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 31 || codePoint === 127
    }) ||
    /[{}]/.test(selector) ||
    EXTENSION_SELECTOR_PATTERN.test(selector)
  )
    return false

  let quote = ''
  let escaped = false
  let brackets = 0
  let parentheses = 0
  for (const character of selector) {
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === '[') brackets += 1
    else if (character === ']') brackets -= 1
    else if (character === '(') parentheses += 1
    else if (character === ')') parentheses -= 1
    if (brackets < 0 || parentheses < 0) return false
  }
  return !quote && !escaped && brackets === 0 && parentheses === 0
}

export function normalizePersistedEdits(value: unknown): RuntimeEdit[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((candidate): RuntimeEdit[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Record<string, unknown>
    if (!isSafeSelectorText(item.selector)) return []
    if (
      item.action !== undefined &&
      (typeof item.action !== 'string' || !KNOWN_ACTIONS.has(item.action))
    )
      return []
    if (item.text !== undefined && typeof item.text !== 'string') return []

    const action = item.action as EditAction | undefined
    const text = action === 'text' && item.text !== undefined ? item.text : undefined
    const id = typeof item.id === 'string' && RULE_ID_PATTERN.test(item.id) ? item.id : undefined
    const createdAt = optionalTimestamp(item.createdAt)
    const updatedAt = optionalTimestamp(item.updatedAt)

    let payload: string | undefined
    if (action === 'round' && typeof item.value === 'string' && /^\d{1,3}$/.test(item.value)) {
      payload = String(Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Number(item.value))))
    }
    if (action === 'css' && typeof item.value === 'string') {
      const sanitized = sanitizeCssDeclarations(item.value)
      if (!sanitized) return []
      payload = sanitized
    }

    return [
      {
        ...(id ? { id } : {}),
        selector: item.selector.trim(),
        permanent: item.permanent !== false,
        ...(action ? { action } : {}),
        ...(text !== undefined ? { text } : {}),
        ...(payload !== undefined ? { value: payload } : {}),
        ...(createdAt !== undefined ? { createdAt } : {}),
        ...(updatedAt !== undefined ? { updatedAt } : {}),
      },
    ]
  })
}

function legacyRuleId(edit: PersistedEdit, index: number): string {
  const source = `${edit.action ?? 'hide'}:${edit.selector}:${index}`
  let hash = 2166136261
  for (let offset = 0; offset < source.length; offset += 1) {
    hash ^= source.charCodeAt(offset)
    hash = Math.imul(hash, 16777619)
  }
  return `legacy-${(hash >>> 0).toString(36)}-${index}`
}

export function createRuleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `rule_${crypto.randomUUID()}`
  }
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

export function migratePersistedEdits(value: unknown, now = Date.now()): PersistedEdit[] {
  return normalizePersistedEdits(value).map((edit, index) => ({
    ...edit,
    id: edit.id ?? legacyRuleId(edit, index),
    createdAt: edit.createdAt ?? now,
    updatedAt: edit.updatedAt ?? edit.createdAt ?? now,
  }))
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
  if (
    /@|(?:url|image-set|-webkit-image-set|paint|element|cross-fade)\s*\(|expression\s*\(|javascript:|behavior\s*:|-moz-binding\s*:|\/\*|\*\//i.test(
      trimmed,
    )
  )
    return null

  const declarations = trimmed
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!declarations.length) return null

  const normalized: string[] = []
  for (const declaration of declarations) {
    const match = /^(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^:;]+?)\s*(!important)?$/.exec(
      declaration,
    )
    if (!match) return null
    const property = match[1].toLowerCase()
    if (!SAFE_CSS_PROPERTIES.has(property)) return null
    normalized.push(`${property}: ${match[2]} !important`)
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
