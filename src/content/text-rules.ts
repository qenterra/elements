import type { PersistedEdit } from '../core/model'

const ORIGINAL_ATTRIBUTE = 'data-elements-text-original'
const REPLACEMENT_ATTRIBUTE = 'data-elements-text-replacement'
const INTERNAL_SELECTOR = `[${ORIGINAL_ATTRIBUTE}], [${REPLACEMENT_ATTRIBUTE}]`
const EXTENSION_ROOT_SELECTOR = '[data-elements-extension-root]'

interface AppliedTextRule {
  key: string
  element: HTMLElement
  original: HTMLSpanElement
  replacement: HTMLSpanElement
}

function ruleKey(rule: PersistedEdit): string {
  return rule.id ?? `text:${rule.selector}`
}

function isTextTarget(element: Element): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    !element.matches('input, textarea, select, option, iframe, img, svg, video, audio, canvas') &&
    !element.closest(INTERNAL_SELECTOR) &&
    !element.closest(EXTENSION_ROOT_SELECTOR)
  )
}

export class TextRuleManager {
  private readonly applied = new Map<string, AppliedTextRule>()

  private findTarget(selector: string): HTMLElement | null {
    try {
      return Array.from(document.querySelectorAll(selector)).find(isTextTarget) ?? null
    } catch {
      return null
    }
  }

  apply(rules: PersistedEdit[]): void {
    const desired = new Map<string, { rule: PersistedEdit; element: HTMLElement }>()
    const claimedElements = new Set<HTMLElement>()

    // The last matching text rule wins, mirroring stylesheet cascade order.
    for (let index = rules.length - 1; index >= 0; index -= 1) {
      const rule = rules[index]
      if (rule.action !== 'text' || rule.text === undefined) continue
      const element = this.findTarget(rule.selector)
      if (!element || claimedElements.has(element)) continue
      claimedElements.add(element)
      desired.set(ruleKey(rule), { rule, element })
    }

    for (const [key, entry] of this.applied) {
      const next = desired.get(key)
      if (!next || next.element !== entry.element || !entry.element.isConnected) {
        this.restoreEntry(entry)
        this.applied.delete(key)
      }
    }

    for (const [key, { rule, element }] of desired) {
      const existing = this.applied.get(key)
      if (existing) {
        if (existing.replacement.textContent !== rule.text)
          existing.replacement.textContent = rule.text ?? ''
        continue
      }
      this.applied.set(key, this.applyRule(key, element, rule.text ?? ''))
    }
  }

  private applyRule(key: string, element: HTMLElement, text: string): AppliedTextRule {
    const original = document.createElement('span')
    original.setAttribute(ORIGINAL_ATTRIBUTE, key)
    original.setAttribute('aria-hidden', 'true')
    original.style.setProperty('display', 'none', 'important')

    const replacement = document.createElement('span')
    replacement.setAttribute(REPLACEMENT_ATTRIBUTE, key)
    replacement.style.setProperty('display', 'contents', 'important')
    replacement.style.setProperty('pointer-events', 'none', 'important')
    replacement.textContent = text

    while (element.firstChild) original.appendChild(element.firstChild)
    element.append(original, replacement)
    return { key, element, original, replacement }
  }

  textFor(element: HTMLElement): string {
    for (const entry of this.applied.values()) {
      if (entry.element === element || entry.replacement.contains(element)) {
        return entry.replacement.textContent ?? ''
      }
    }
    return element.textContent ?? ''
  }

  restore(rule: PersistedEdit): void {
    const key = ruleKey(rule)
    const entry = this.applied.get(key)
    if (!entry) return
    this.restoreEntry(entry)
    this.applied.delete(key)
  }

  restoreAll(): void {
    for (const entry of this.applied.values()) this.restoreEntry(entry)
    this.applied.clear()
  }

  private restoreEntry(entry: AppliedTextRule): void {
    const { element, original, replacement } = entry
    if (original.parentNode === element) {
      while (original.firstChild) element.insertBefore(original.firstChild, original)
    }
    replacement.remove()
    original.remove()
  }
}
