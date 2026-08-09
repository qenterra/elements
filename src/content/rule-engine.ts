import { editDeclarations, type PersistedEdit } from '../core/model'
import { TextRuleManager } from './text-rules'

const STYLE_ID = 'elements-extension-rules-v2'
const ROOT_SELECTOR = '#elements-extension-root-v2'

export interface RuleEngineState {
  rules: PersistedEdit[]
  paused: boolean
  showOriginal: boolean
  previewSelector: string | null
  defaultRadius: number
}

function validSelector(selector: string): string | null {
  const trimmed = selector.trim()
  if (!trimmed || /[{}]/.test(trimmed)) return null
  try {
    document.querySelector(trimmed)
    return trimmed
  } catch {
    return null
  }
}

export class RuleEngine {
  private readonly textRules = new TextRuleManager()
  private style: HTMLStyleElement | null = null

  apply(state: RuleEngineState): void {
    const cssLines: string[] = []
    if (!state.showOriginal && !state.paused) {
      for (const edit of state.rules) {
        const selector = validSelector(edit.selector)
        if (!selector) continue
        if (selector === state.previewSelector) {
          cssLines.push(
            `${selector} { outline: solid calc(var(--qds-stroke-default) + var(--qds-stroke-focus)) rgba(34,211,238,.6) !important; outline-offset: calc(-1 * (var(--qds-stroke-default) + var(--qds-stroke-focus))) !important; }`,
          )
          continue
        }
        if (!edit.action && (selector === 'body' || selector === 'html')) {
          cssLines.push(`${selector} { background: transparent !important; }`)
          continue
        }
        const declarations = editDeclarations(edit, state.defaultRadius)
        if (declarations) cssLines.push(`${selector} { ${declarations} }`)
      }
    }

    if (!state.showOriginal && !state.paused && state.rules.length) {
      cssLines.push(`html, html body, html body > ${ROOT_SELECTOR} { display: block !important; }`)
      cssLines.push(
        `html body > ${ROOT_SELECTOR} { position: fixed !important; visibility: visible !important; opacity: 1 !important; filter: none !important; transform: none !important; isolation: isolate !important; }`,
      )
    }

    const style = this.ensureStyle()
    style.textContent = cssLines.join('\n')
    if (state.paused || state.showOriginal) this.textRules.restoreAll()
    else this.textRules.apply(state.rules)
  }

  textFor(element: HTMLElement): string {
    return this.textRules.textFor(element)
  }

  restoreText(rule?: PersistedEdit): void {
    if (rule) this.textRules.restore(rule)
    else this.textRules.restoreAll()
  }

  destroy(): void {
    this.textRules.restoreAll()
    this.style?.remove()
    this.style = null
  }

  private ensureStyle(): HTMLStyleElement {
    if (this.style?.isConnected) return this.style
    const existing = document.getElementById(STYLE_ID)
    if (existing instanceof HTMLStyleElement) {
      this.style = existing
      return existing
    }
    const style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
    this.style = style
    return style
  }
}
