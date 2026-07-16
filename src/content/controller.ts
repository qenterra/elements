import { browser } from 'wxt/browser'
import { DEFAULT_SETTINGS, type ExtensionSettings, type OverlaySnapshot, type PathToken, type RuntimeEdit, normalizePersistedEdits } from '../core/model'
import { getUniqueSelector, isValidSelector } from './selector'

export interface OverlayRenderer {
  mount(shadowRoot: ShadowRoot, controller: ElementController): { unmount: () => void }
}

type Listener = () => void

type OverlayElement = HTMLDivElement & { relatedElement?: Element }
type I18nApi = { getMessage: (name: string) => string }

function localizedMessage(key: string, fallback: string): string {
  const i18n = browser.i18n as unknown as I18nApi
  return i18n.getMessage(key) || fallback
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function siteKey(): string {
  return location.hostname.replace(/^www\./, '')
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function editKey(edit: RuntimeEdit): string {
  return `${edit.action ?? 'hide'}:${edit.selector}`
}

export class ElementController {
  private readonly listeners = new Set<Listener>()
  private readonly renderer: OverlayRenderer
  private readonly maxZIndex = 2147483647
  private readonly undoStack: string[] = []

  private host: HTMLDivElement | null = null
  private overlayUi: { unmount: () => void } | null = null
  private highlighter: HTMLDivElement | null = null
  private mutationObserver: MutationObserver | null = null
  private isDestroyed = false
  private textEditEl: HTMLElement | null = null
  private textEditOriginal = ''
  private previewedHiddenSelector: string | null = null
  private settings: ExtensionSettings = { ...DEFAULT_SETTINGS }
  private hotkey = 'No shortcut set'
  private minimized = false
  private minimizeAnimation: Animation | null = null
  private minimizeRevision = 0
  private textEditObserverTimer = 0

  hoveredElement: Element | null = null
  markedElement: Element | null = null
  previewOriginal = false
  targetingMode = false
  transpose = 0
  hiddenElements: RuntimeEdit[] = []

  constructor(renderer: OverlayRenderer) {
    this.renderer = renderer
  }

  async init(): Promise<void> {
    // Register messaging before storage I/O so an early toolbar click is not lost.
    document.addEventListener('keydown', this.handleKeydown, true)
    document.addEventListener('keyup', this.handleKeyup, true)
    browser.runtime.onMessage.addListener(this.handleExtensionMessage)

    await Promise.all([this.loadSavedElements(), this.loadSettings(), this.loadHotkey()])

    this.mutationObserver = new MutationObserver(() => {
      if (this.targetingMode || this.textEditEl) return
      window.clearTimeout(this.textEditObserverTimer)
      this.textEditObserverTimer = window.setTimeout(() => this.applyTextEdits(), 120)
    })
    this.mutationObserver.observe(document.documentElement, { childList: true, subtree: true })
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): OverlaySnapshot {
    return {
      minimized: this.minimized,
      previewOriginal: this.previewOriginal,
      hotkey: this.hotkey,
      settings: { ...this.settings },
      edits: this.hiddenElements.map((edit) => ({ ...edit })),
      path: this.getPathTokens(),
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private async sendMessage<T>(message: Record<string, unknown>): Promise<T | undefined> {
    if (!browser.runtime?.id) {
      this.destroy()
      return undefined
    }

    try {
      return await browser.runtime.sendMessage(message) as T
    } catch {
      if (!browser.runtime?.id) this.destroy()
      return undefined
    }
  }

  private async loadSavedElements(): Promise<void> {
    const value = await this.sendMessage<string>({ action: 'get_saved_elms', website: siteKey() })
    this.hiddenElements = normalizePersistedEdits(parseJson(value, []))
    this.updateCSS()
    this.applyTextEdits()
    this.notify()
  }

  private async loadSettings(): Promise<void> {
    const value = await this.sendMessage<string>({ action: 'get_settings' })
    const parsed = parseJson<Partial<ExtensionSettings>>(value, {})
    this.settings = { remember: parsed.remember !== false }
    this.notify()
  }

  private async loadHotkey(): Promise<void> {
    this.hotkey = await this.sendMessage<string>({ action: 'get_hotkey' }) ?? localizedMessage('pickerNoShortcut', this.hotkey)
    this.notify()
  }

  private getPathTokens(): PathToken[] {
    if (!this.hoveredElement) return []

    let element: Element | null = this.hoveredElement
    if (element.classList.contains('elements_overlay')) {
      element = (element as OverlayElement).relatedElement ?? null
    }

    const path: Element[] = []
    while (element) {
      path.unshift(element)
      element = element.parentElement
    }

    return path.map((node, index) => ({
      label: this.elementLabel(node),
      active: path.length - 1 - index === this.transpose,
    }))
  }

  private elementLabel(element: Element): string {
    const id = element.getAttribute('id')
    if (id) return `#${id}`
    const classes = Array.from(element.classList).slice(0, 3)
    return `${element.tagName.toLowerCase()}${classes.map((name) => `.${name}`).join('')}`
  }

  private isChildOfWindow(element: EventTarget | null): boolean {
    let current = element as Node | null
    for (let index = 0; current && index < 10; index += 1) {
      if (current === this.host) return true
      current = current.parentNode
    }
    return false
  }

  private ensureHighlighter(): HTMLDivElement {
    if (this.highlighter) return this.highlighter

    const highlighter = document.createElement('div')
    highlighter.id = 'elements_highlighter'
    Object.assign(highlighter.style, {
      pointerEvents: 'none',
      position: 'fixed',
      background: 'rgba(34,211,238,0.14)',
      outline: 'solid 2px rgba(103,227,245,0.9)',
      outlineOffset: '-2px',
      borderRadius: '8px',
      boxShadow: '0 0 0 1px rgba(34,211,238,0.12), 0 8px 28px rgba(34,211,238,0.14)',
      transformOrigin: 'center',
      zIndex: String(this.maxZIndex - 1),
    })

    document.body.appendChild(highlighter)
    this.highlighter = highlighter
    return highlighter
  }

  private highlightElement(animateGeometry = false): void {
    if (!this.hoveredElement) return

    let marked = this.hoveredElement
    if (marked.classList.contains('elements_overlay')) {
      marked = (marked as OverlayElement).relatedElement ?? marked
    }

    let level = 0
    for (; level < this.transpose; level += 1) {
      if (marked.parentNode && marked.parentNode !== document) marked = marked.parentNode as Element
      else break
    }
    this.transpose = level

    if (marked === this.markedElement) {
      this.positionHighlighter(animateGeometry)
      return
    }

    this.markedElement = marked
    const isNew = !this.highlighter
    this.ensureHighlighter()
    this.positionHighlighter(animateGeometry)
    if (isNew && animateGeometry && !matchMedia(REDUCED_MOTION).matches) {
      this.highlighter?.animate([
        { opacity: 0, transform: 'scale(.985)' },
        { opacity: 1, transform: 'scale(1)' },
      ], {
        duration: 140,
        easing: 'cubic-bezier(.23, 1, .32, 1)',
      })
    }
    this.notify()
  }

  private unhighlightElement(): void {
    this.highlighter?.remove()
    this.highlighter = null
    this.markedElement = null
    this.hoveredElement = null
    this.transpose = 0
    this.notify()
  }

  private positionHighlighter(animateGeometry: boolean): void {
    const rect = this.markedElement?.getBoundingClientRect()
    if (!rect || !this.highlighter) return
    this.highlighter.style.transition = animateGeometry && !matchMedia(REDUCED_MOTION).matches
      ? 'left .11s cubic-bezier(.23,1,.32,1), top .11s cubic-bezier(.23,1,.32,1), width .15s cubic-bezier(.23,1,.32,1), height .15s cubic-bezier(.23,1,.32,1)'
      : 'none'
    this.highlighter.style.left = `${rect.x}px`
    this.highlighter.style.top = `${rect.y}px`
    this.highlighter.style.width = `${rect.width}px`
    this.highlighter.style.height = `${rect.height}px`
  }

  private updateHighlighterPosition = (): void => this.positionHighlighter(false)

  private handleMouseover = (event: MouseEvent): void => {
    if (!this.targetingMode || Date.now() < this.preventHighlightingUntil) return
    if (this.textEditEl) return

    if (this.isChildOfWindow(event.target)) {
      this.unhighlightElement()
      this.preventHighlightingUntil = Date.now() + 100
      return
    }

    if (!(event.target instanceof Element) || event.target === this.hoveredElement) return
    this.transpose = 0
    this.hoveredElement = event.target
    this.highlightElement(true)
    this.notify()
  }

  private preventHighlightingUntil = 0

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!this.targetingMode || this.textEditEl) return

    if (event.code === 'Escape') this.deactivate()
    else if (event.code === 'Space' && this.markedElement) this.hideTarget()
    else if (event.code === 'KeyE' && this.markedElement) this.startTextEdit(this.markedElement)
    else if (event.code === 'KeyC' && this.markedElement) this.roundTarget()
    else if (event.code === 'KeyW') {
      this.transpose = Math.max(0, this.transpose - 1)
      this.highlightElement()
    } else if (event.code === 'KeyQ') {
      this.transpose += 1
      this.highlightElement()
    } else if (event.code === 'KeyZ' && (event.ctrlKey || event.metaKey)) {
      this.undo()
    } else return

    event.stopPropagation()
    event.preventDefault()
  }

  private handleKeyup = (event: KeyboardEvent): void => {
    if (!this.targetingMode || this.textEditEl) return
    event.stopPropagation()
    event.preventDefault()
  }

  private hideTarget = (event?: MouseEvent): void => {
    if (!this.markedElement || (event && this.isChildOfWindow(event.target))) return
    if (event && event.button !== 0) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const selector = this.getSelector(this.markedElement)
    if (!selector) return
    this.unhighlightElement()
    this.previewOriginal = false
    this.hiddenElements.push({ selector, permanent: this.settings.remember })
    this.undoStack.push(`hide:${selector}`)
    this.updateCSS()
    this.persist()
    this.triggerResize()
    event?.preventDefault()
    event?.stopPropagation()
  }

  roundTarget(): void {
    if (!this.markedElement) return
    const selector = this.getSelector(this.markedElement)
    if (!selector) return

    this.previewOriginal = false
    const existing = this.hiddenElements.findIndex((edit) => edit.action === 'round' && edit.selector === selector)
    if (existing >= 0) this.hiddenElements.splice(existing, 1)
    else {
      this.hiddenElements.push({ selector, permanent: this.settings.remember, action: 'round' })
      this.undoStack.push(`round:${selector}`)
    }
    this.updateCSS()
    this.persist()
    this.notify()
  }

  startTextEdit(element: Element): void {
    if (!(element instanceof HTMLElement) || !element.isConnected) return
    if (this.isChildOfWindow(element) || element.isContentEditable) return
    if (element.matches('input, textarea, select, iframe, img, svg, video, audio, canvas')) return

    this.finishTextEdit()
    this.unhighlightElement()
    this.textEditEl = element
    this.textEditOriginal = element.textContent ?? ''
    element.setAttribute('contenteditable', 'plaintext-only')
    element.style.setProperty('cursor', 'text', 'important')
    element.focus()

    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    element.addEventListener('keydown', this.textEditKeydown, true)
    element.addEventListener('blur', this.textEditCommit, true)
  }

  private textEditKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      this.textEditCommit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      this.cancelTextEdit()
    }
    event.stopPropagation()
  }

  private textEditCommit = (): void => {
    const element = this.textEditEl
    if (!element) return
    const nextText = element.textContent ?? ''
    const original = this.textEditOriginal
    this.finishTextEdit()
    if (nextText === original || !nextText.trim()) return

    const selector = this.getSelector(element)
    if (!selector) return
    const existing = this.hiddenElements.findIndex((edit) => edit.action === 'text' && edit.selector === selector)
    const originalText = existing >= 0 ? this.hiddenElements[existing]._original ?? original : original
    const entry: RuntimeEdit = { selector, permanent: this.settings.remember, action: 'text', text: nextText, _original: originalText }
    if (existing >= 0) this.hiddenElements[existing] = entry
    else {
      this.hiddenElements.push(entry)
      this.undoStack.push(`text:${selector}`)
    }
    this.persist()
    this.notify()
  }

  private cancelTextEdit(): void {
    const element = this.textEditEl
    if (!element) return
    const original = this.textEditOriginal
    this.finishTextEdit()
    element.textContent = original
  }

  private finishTextEdit(): void {
    const element = this.textEditEl
    if (!element) return
    element.removeEventListener('keydown', this.textEditKeydown, true)
    element.removeEventListener('blur', this.textEditCommit, true)
    element.removeAttribute('contenteditable')
    element.style.removeProperty('cursor')
    if (!element.getAttribute('style')) element.removeAttribute('style')
    this.textEditEl = null
  }

  undo(): void {
    while (this.undoStack.length) {
      const key = this.undoStack.pop() as string
      const next = this.hiddenElements.filter((edit) => editKey(edit) !== key)
      if (next.length !== this.hiddenElements.length) {
        this.hiddenElements = next
        this.updateCSS()
        this.persist()
        this.notify()
        return
      }
    }
  }

  private getSelector(element: Element): string | null {
    try {
      return getUniqueSelector(element)
    } catch {
      return null
    }
  }

  private applyTextEdits(): void {
    for (const edit of this.hiddenElements) {
      if (edit.action !== 'text' || edit.text === undefined) continue
      try {
        const node = document.querySelector(edit.selector)
        if (!node || node === this.textEditEl) continue
        if (edit._original === undefined && node.textContent !== edit.text) edit._original = node.textContent ?? ''
        if (node.textContent !== edit.text) node.textContent = edit.text
      } catch {
        // A selector can become invalid when a SPA replaces its markup.
      }
    }
  }

  previewEdit(edit: RuntimeEdit, showOriginal: boolean): void {
    edit = this.findLiveEdit(edit) ?? edit
    if (edit.action === 'text') {
      if (edit._original === undefined) return
      try {
        const node = document.querySelector(edit.selector)
        if (node) node.textContent = showOriginal ? edit._original : edit.text ?? ''
      } catch { /* stale selector */ }
      return
    }

    this.previewedHiddenSelector = showOriginal ? edit.selector : null
    this.updateCSS()
  }

  deleteEdit(edit: RuntimeEdit): void {
    const liveEdit = this.findLiveEdit(edit)
    if (!liveEdit) return
    if (liveEdit.action === 'text') this.previewEdit(liveEdit, true)
    this.hiddenElements = this.hiddenElements.filter((candidate) => candidate !== liveEdit)
    this.previewedHiddenSelector = null
    this.updateCSS()
    this.persist()
    this.triggerResize()
    this.notify()
  }

  setEditPermanent(edit: RuntimeEdit, permanent: boolean): void {
    const liveEdit = this.findLiveEdit(edit)
    if (!liveEdit) return
    liveEdit.permanent = permanent
    this.persist()
    this.notify()
  }

  editSelector(edit: RuntimeEdit): void {
    const liveEdit = this.findLiveEdit(edit)
    if (!liveEdit) return
    const next = window.prompt(localizedMessage('pickerSelectorPrompt', 'Customize CSS selector'), liveEdit.selector)?.trim()
    if (!next || next === liveEdit.selector) return
    if (!isValidSelector(next) || /[{}]/.test(next)) {
      window.alert(localizedMessage('pickerSelectorInvalid', 'This is not a valid CSS selector.'))
      return
    }
    liveEdit.selector = next
    this.updateCSS()
    this.persist()
    this.notify()
  }

  private findLiveEdit(edit: RuntimeEdit): RuntimeEdit | undefined {
    return this.hiddenElements.find((candidate) => editKey(candidate) === editKey(edit))
  }

  toggleCompare(): void {
    this.previewOriginal = !this.previewOriginal
    this.updateCSS()
    this.triggerResize()
    this.notify()
  }

  toggleRemember(): void {
    this.settings.remember = !this.settings.remember
    void this.sendMessage({ action: 'set_settings', data: JSON.stringify(this.settings) })
    this.notify()
  }

  toggleMinimize(): void {
    const revision = ++this.minimizeRevision
    const panel = this.host?.shadowRoot?.querySelector<HTMLElement>('.mainWindow') ?? null
    const startRect = panel?.getBoundingClientRect() ?? null
    this.minimizeAnimation?.cancel()
    this.minimizeAnimation = null
    this.minimized = !this.minimized
    this.notify()

    if (!panel || !startRect || matchMedia(REDUCED_MOTION).matches) return
    requestAnimationFrame(() => {
      if (!panel.isConnected || revision !== this.minimizeRevision) return
      const endRect = panel.getBoundingClientRect()
      if (Math.abs(startRect.width - endRect.width) < 1 && Math.abs(startRect.height - endRect.height) < 1) return
      const animation = panel.animate([
        { width: `${startRect.width}px`, height: `${startRect.height}px` },
        { width: `${endRect.width}px`, height: `${endRect.height}px` },
      ], {
        duration: this.minimized ? 260 : 280,
        easing: 'cubic-bezier(.32, .72, 0, 1)',
      })
      this.minimizeAnimation = animation
      const clearAnimation = () => {
        if (this.minimizeAnimation === animation) this.minimizeAnimation = null
      }
      animation.onfinish = clearAnimation
      animation.oncancel = clearAnimation
    })
  }

  openOptions(): void {
    void this.sendMessage({ action: 'open_options' })
  }

  openHotkeySettings(): void {
    void this.sendMessage({ action: 'goto_hotkey_settings' })
  }

  activate(): void {
    if (this.targetingMode) return
    this.targetingMode = true
    this.previewOriginal = false
    this.minimized = false

    const host = document.createElement('div')
    host.id = 'elements_wnd'
    const shadowRoot = host.attachShadow({ mode: 'open' })
    document.body.appendChild(host)
    this.host = host
    this.overlayUi = this.renderer.mount(shadowRoot, this)

    document.addEventListener('mouseover', this.handleMouseover, true)
    document.addEventListener('mousedown', this.hideTarget, true)
    document.addEventListener('mouseup', this.preventEvent, true)
    document.addEventListener('click', this.preventEvent, true)
    document.addEventListener('scroll', this.updateHighlighterPosition, true)
    this.updateCSS()
    this.addOverlays()
    void this.sendMessage({ action: 'status', active: true })
    this.notify()
  }

  deactivate(): void {
    if (!this.targetingMode) return
    this.targetingMode = false
    this.previewOriginal = false
    this.updateCSS()
    this.unhighlightElement()

    const host = this.host
    const ui = this.overlayUi
    this.host = null
    this.overlayUi = null
    this.minimizeRevision += 1
    this.minimizeAnimation?.cancel()
    this.minimizeAnimation = null
    ui?.unmount()
    host?.remove()

    document.removeEventListener('mouseover', this.handleMouseover, true)
    document.removeEventListener('mousedown', this.hideTarget, true)
    document.removeEventListener('mouseup', this.preventEvent, true)
    document.removeEventListener('click', this.preventEvent, true)
    document.removeEventListener('scroll', this.updateHighlighterPosition, true)
    this.removeOverlays()
    void this.sendMessage({ action: 'status', active: false })
    this.notify()
  }

  toggle(): void {
    if (this.targetingMode) this.deactivate()
    else this.activate()
  }

  private preventEvent = (event: Event): boolean | void => {
    if (this.isChildOfWindow(event.target)) return
    event.preventDefault()
    event.stopPropagation()
    return false
  }

  private addOverlays(): void {
    for (const element of document.querySelectorAll('iframe, embed')) {
      const rect = element.getBoundingClientRect()
      const overlay = document.createElement('div') as OverlayElement
      overlay.className = 'elements_overlay'
      Object.assign(overlay.style, {
        position: 'absolute',
        left: `${rect.left + window.scrollX}px`,
        top: `${rect.top + window.scrollY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        background: 'rgba(128,128,128,0.2)',
        zIndex: String(this.maxZIndex - 2),
      })
      overlay.relatedElement = element
      document.body.appendChild(overlay)
    }
  }

  private removeOverlays(): void {
    document.querySelectorAll('.elements_overlay').forEach((element) => element.remove())
  }

  refreshOverlays(): void {
    this.removeOverlays()
    this.addOverlays()
  }

  private triggerResize(): void {
    window.dispatchEvent(new Event('resize'))
    window.setTimeout(() => this.refreshOverlays())
  }

  private updateCSS(): void {
    const cssLines = [
      `#elements_wnd { --elements-surface: #17181c; --elements-panel-radius: 16px; --elements-panel-shadow: 0 2px 6px rgba(0,0,0,.25), 0 20px 45px rgba(0,0,0,.5); position: fixed; bottom: 16px; right: 16px; background: var(--elements-surface); box-shadow: var(--elements-panel-shadow); border-radius: var(--elements-panel-radius); z-index: ${this.maxZIndex}; }`,
    ]

    if (!this.previewOriginal) {
      for (const edit of this.hiddenElements) {
        const selector = edit.selector.replace(/[{}]/g, '')
        if (selector === this.previewedHiddenSelector) {
          cssLines.push(`${selector} { outline: solid 3px rgba(34,211,238,.6) !important; outline-offset: -3px; }`)
        } else if (edit.action === 'text') {
          // Text edits are applied to the DOM because CSS cannot replace text.
        } else if (edit.action === 'round') {
          cssLines.push(`${selector} { border-radius: 12px !important; }`)
        } else if (selector === 'body' || selector === 'html') {
          cssLines.push(`${selector} { background: transparent !important; }`)
        } else {
          cssLines.push(`${selector} { display: none !important; }`)
        }
      }
    }

    if (!this.previewOriginal && this.hiddenElements.length) {
      cssLines.push('html, html body, html body > #elements_wnd { display: block !important; }')
    }

    let style = document.querySelector<HTMLStyleElement>('#elements_styles')
    if (!style) {
      style = document.createElement('style')
      style.id = 'elements_styles'
      document.head.appendChild(style)
    }
    style.textContent = cssLines.join('\n')
    this.applyTextEdits()
  }

  private persist(): void {
    const saved = this.hiddenElements
      .filter((edit) => edit.permanent)
      .map(({ selector, permanent, action, text }) => ({ selector, permanent, ...(action ? { action } : {}), ...(text !== undefined ? { text } : {}) }))
    void this.sendMessage({ action: 'set_saved_elms', website: siteKey(), data: JSON.stringify(saved) })
  }

  private handleExtensionMessage = async (message: { action?: string }): Promise<boolean | undefined> => {
    if (message.action === 'toggle') {
      this.toggle()
      return true
    }
    if (message.action === 'getStatus') return this.targetingMode
    return undefined
  }

  destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true
    if (this.mutationObserver) this.mutationObserver.disconnect()
    window.clearTimeout(this.textEditObserverTimer)
    this.deactivate()
    document.removeEventListener('keydown', this.handleKeydown, true)
    document.removeEventListener('keyup', this.handleKeyup, true)
    try {
      browser.runtime.onMessage.removeListener(this.handleExtensionMessage)
    } catch { /* context already invalidated */ }
    if (browser.runtime?.id) document.querySelector('#elements_styles')?.remove()
  }
}
