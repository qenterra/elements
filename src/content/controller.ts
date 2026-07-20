import { browser } from 'wxt/browser'
import {
  DEFAULT_SETTINGS,
  editDeclarations,
  normalizePersistedEdits,
  normalizeSettings,
  sanitizeCssDeclarations,
  type EditAction,
  type ExtensionSettings,
  type MarkedInfo,
  type OverlaySnapshot,
  type PathToken,
  type ResolvedTheme,
  type RuntimeEdit,
  type StatusNotice,
  type ThemePreference,
} from '../core/model'
import { resolveTheme, watchSystemTheme } from '../core/theme'
import { getUniqueSelector, isValidSelector } from './selector'

export interface OverlayRenderer {
  mount(shadowRoot: ShadowRoot, controller: ElementController): { unmount: () => void }
}

type Listener = () => void
type UndoEntry = { type: 'add' | 'remove'; edit: RuntimeEdit }
type PanelCorner = 'br' | 'bl' | 'tr' | 'tl'

type OverlayElement = HTMLDivElement & { relatedElement?: Element }
type I18nApi = { getMessage: (name: string) => string }

function localizedMessage(key: string, fallback: string): string {
  const i18n = browser.i18n as unknown as I18nApi
  return i18n.getMessage(key) || fallback
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const PANEL_MARGIN = 16

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

function toPlainRect(rect: DOMRect): MarkedInfo['rect'] {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

export class ElementController {
  private readonly listeners = new Set<Listener>()
  private readonly renderer: OverlayRenderer
  private readonly maxZIndex = 2147483647
  private undoStack: UndoEntry[] = []
  private redoStack: UndoEntry[] = []

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
  private paused = false
  private resolvedTheme: ResolvedTheme = 'dark'
  private stopThemeWatch: (() => void) | null = null
  private status: StatusNotice | null = null
  private statusId = 0
  private statusTimer = 0
  private modalCloseHandler: (() => void) | null = null
  private panelCorner: PanelCorner = 'br'
  private dragCleanup: (() => void) | null = null
  private scrollNotifyFrame = 0

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

    await Promise.all([this.loadSavedElements(), this.loadSettings(), this.loadHotkey(), this.loadPaused()])

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
      paused: this.paused,
      hotkey: this.hotkey,
      settings: { ...this.settings },
      edits: this.hiddenElements.map((edit) => ({ ...edit })),
      path: this.getPathTokens(),
      status: this.status,
      marked: this.getMarkedInfo(),
      textEditRect: this.textEditEl?.isConnected ? toPlainRect(this.textEditEl.getBoundingClientRect()) : null,
      resolvedTheme: this.resolvedTheme,
      showCoachmark: this.targetingMode && !this.settings.coachmarkSeen,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
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
    this.settings = normalizeSettings(parseJson<unknown>(value, {}))
    this.applyThemePreference()
    this.notify()
  }

  private async loadHotkey(): Promise<void> {
    this.hotkey = await this.sendMessage<string>({ action: 'get_hotkey' }) ?? localizedMessage('pickerNoShortcut', this.hotkey)
    this.notify()
  }

  private async loadPaused(): Promise<void> {
    this.paused = Boolean(await this.sendMessage<boolean>({ action: 'get_paused', website: siteKey() }))
    this.updateCSS()
    this.notify()
  }

  private saveSettings(): void {
    void this.sendMessage({ action: 'set_settings', data: JSON.stringify(this.settings) })
  }

  // --- Theme -------------------------------------------------------------

  private applyThemePreference(): void {
    this.resolvedTheme = resolveTheme(this.settings.theme)
    this.stopThemeWatch?.()
    this.stopThemeWatch = this.settings.theme === 'system'
      ? watchSystemTheme(() => {
        this.resolvedTheme = resolveTheme(this.settings.theme)
        this.syncThemeSurfaces()
        this.notify()
      })
      : null
    this.syncThemeSurfaces()
  }

  private syncThemeSurfaces(): void {
    if (this.host) this.host.dataset.theme = this.resolvedTheme
    this.styleHighlighter()
  }

  setThemePreference(theme: ThemePreference): void {
    this.settings.theme = theme
    this.saveSettings()
    this.applyThemePreference()
    this.notify()
  }

  cycleTheme(): void {
    const order: ThemePreference[] = ['system', 'light', 'dark']
    const next = order[(order.indexOf(this.settings.theme) + 1) % order.length]
    this.setThemePreference(next)
  }

  // --- Status ------------------------------------------------------------

  private showStatus(message: string, undoable = false): void {
    this.statusId += 1
    this.status = { id: this.statusId, message, undoable }
    window.clearTimeout(this.statusTimer)
    this.statusTimer = window.setTimeout(() => {
      this.status = null
      this.notify()
    }, 2600)
    this.notify()
  }

  // --- Selection ---------------------------------------------------------

  private getMarkedInfo(): MarkedInfo | null {
    if (!this.markedElement?.isConnected || this.textEditEl) return null
    return {
      rect: toPlainRect(this.markedElement.getBoundingClientRect()),
      label: this.elementLabel(this.markedElement),
    }
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
      borderRadius: '8px',
      transformOrigin: 'center',
      zIndex: String(this.maxZIndex - 1),
    })

    // The brand signature: four corner brackets drawn on capture.
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      const bracket = document.createElement('div')
      bracket.className = `elements_bracket elements_bracket_${corner}`
      Object.assign(bracket.style, {
        position: 'absolute',
        width: '10px',
        height: '10px',
        pointerEvents: 'none',
        ...(corner.includes('t') ? { top: '-2px', borderTop: 'solid 2.5px currentColor' } : { bottom: '-2px', borderBottom: 'solid 2.5px currentColor' }),
        ...(corner.includes('l') ? { left: '-2px', borderLeft: 'solid 2.5px currentColor' } : { right: '-2px', borderRight: 'solid 2.5px currentColor' }),
        ...(corner === 'tl' ? { borderTopLeftRadius: '6px' } : {}),
        ...(corner === 'tr' ? { borderTopRightRadius: '6px' } : {}),
        ...(corner === 'bl' ? { borderBottomLeftRadius: '6px' } : {}),
        ...(corner === 'br' ? { borderBottomRightRadius: '6px' } : {}),
      })
      highlighter.appendChild(bracket)
    }

    document.body.appendChild(highlighter)
    this.highlighter = highlighter
    this.styleHighlighter()
    return highlighter
  }

  private styleHighlighter(): void {
    if (!this.highlighter) return
    const dark = this.resolvedTheme === 'dark'
    Object.assign(this.highlighter.style, {
      background: dark ? 'rgba(34,211,238,0.14)' : 'rgba(8,145,178,0.12)',
      outline: dark ? 'solid 2px rgba(103,227,245,0.9)' : 'solid 2px rgba(8,145,178,0.85)',
      outlineOffset: '-2px',
      boxShadow: dark
        ? '0 0 0 1px rgba(34,211,238,0.12), 0 8px 28px rgba(34,211,238,0.14)'
        : '0 0 0 1px rgba(8,145,178,0.12), 0 8px 28px rgba(8,145,178,0.18)',
      color: dark ? '#67e3f5' : '#0e7490',
    })
  }

  private animateBrackets(): void {
    if (!this.highlighter || matchMedia(REDUCED_MOTION).matches) return
    for (const bracket of this.highlighter.querySelectorAll<HTMLElement>('.elements_bracket')) {
      bracket.getAnimations().forEach((animation) => animation.cancel())
      bracket.animate([
        { opacity: 0, transform: 'scale(1.6)' },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: 130, easing: 'cubic-bezier(.23, 1, .32, 1)' })
    }
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
    if (animateGeometry) this.animateBrackets()
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

  private updateHighlighterPosition = (): void => {
    this.positionHighlighter(false)
    // Let the mini toolbar follow the element while scrolling.
    if (this.markedElement && !this.scrollNotifyFrame) {
      this.scrollNotifyFrame = requestAnimationFrame(() => {
        this.scrollNotifyFrame = 0
        this.notify()
      })
    }
  }

  private handleMouseover = (event: MouseEvent): void => {
    if (!this.targetingMode || Date.now() < this.preventHighlightingUntil) return
    if (this.textEditEl || this.modalCloseHandler) return

    if (this.isChildOfWindow(event.target)) {
      const path = event.composedPath()
      const keepHighlight = path.some((node) => node instanceof HTMLElement && node.hasAttribute('data-keep-highlight'))
      if (!keepHighlight) {
        this.unhighlightElement()
        this.preventHighlightingUntil = Date.now() + 100
      }
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

    if (this.modalCloseHandler) {
      if (event.code === 'Escape') {
        event.stopPropagation()
        event.preventDefault()
        this.modalCloseHandler()
      }
      return
    }

    if (event.code === 'Escape') this.deactivate()
    else if (event.code === 'Space' && this.markedElement) this.applyAction('hide')
    else if (event.code === 'KeyE' && this.markedElement) this.startTextEdit(this.markedElement)
    else if (event.code === 'KeyC' && this.markedElement) this.applyAction('round')
    else if (event.code === 'KeyW') {
      this.transpose = Math.max(0, this.transpose - 1)
      this.highlightElement()
    } else if (event.code === 'KeyQ') {
      this.transpose += 1
      this.highlightElement()
    } else if (event.code === 'KeyZ' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      this.redo()
    } else if (event.code === 'KeyZ' && (event.ctrlKey || event.metaKey)) {
      this.undo()
    } else return

    event.stopPropagation()
    event.preventDefault()
  }

  private handleKeyup = (event: KeyboardEvent): void => {
    if (!this.targetingMode || this.textEditEl || this.modalCloseHandler) return
    event.stopPropagation()
    event.preventDefault()
  }

  /** Called by the overlay UI while a popover/menu owns keyboard focus. */
  setModal(open: boolean, onClose: (() => void) | null = null): void {
    this.modalCloseHandler = open ? onClose : null
  }

  // --- Edits -------------------------------------------------------------

  private pushUndo(entry: UndoEntry): void {
    this.undoStack.push(entry)
    this.redoStack = []
  }

  applyAction(kind: 'hide' | EditAction, event?: MouseEvent): void {
    if (!this.markedElement || (event && this.isChildOfWindow(event.target))) return
    if (event && event.button !== 0) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (kind === 'text') {
      this.startTextEdit(this.markedElement)
      return
    }

    const selector = this.getSelector(this.markedElement)
    if (!selector) return
    this.previewOriginal = false

    if (kind === 'hide') {
      const edit: RuntimeEdit = { selector, permanent: this.settings.remember }
      this.unhighlightElement()
      this.hiddenElements.push(edit)
      this.pushUndo({ type: 'add', edit })
      this.showStatus(localizedMessage('pickerStatusHidden', 'Element hidden'), true)
      this.updateCSS()
      this.persist()
      this.triggerResize()
      event?.preventDefault()
      event?.stopPropagation()
      return
    }

    // Toggleable style actions: applying twice removes the rule.
    const existing = this.hiddenElements.findIndex((edit) => edit.action === kind && edit.selector === selector)
    if (existing >= 0) {
      const [removed] = this.hiddenElements.splice(existing, 1)
      this.pushUndo({ type: 'remove', edit: removed })
      this.showStatus(localizedMessage('pickerStatusRemoved', 'Edit removed'), true)
    } else {
      const edit: RuntimeEdit = {
        selector,
        permanent: this.settings.remember,
        action: kind,
        ...(kind === 'round' ? { value: String(this.settings.radius) } : {}),
      }
      this.hiddenElements.push(edit)
      this.pushUndo({ type: 'add', edit })
      const statusKey = {
        round: 'pickerStatusRounded',
        blur: 'pickerStatusBlurred',
        dim: 'pickerStatusDimmed',
        gray: 'pickerStatusGrayed',
        css: 'pickerStatusCss',
      }[kind]
      this.showStatus(localizedMessage(statusKey, 'Edit applied'), true)
    }
    this.updateCSS()
    this.persist()
    this.notify()
  }

  private hideTarget = (event?: MouseEvent): void => {
    this.applyAction('hide', event)
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
    element.style.setProperty('outline', `solid 2px ${this.resolvedTheme === 'dark' ? 'rgba(34,211,238,.85)' : 'rgba(8,145,178,.85)'}`, 'important')
    element.style.setProperty('outline-offset', '2px', 'important')
    element.focus()

    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    element.addEventListener('keydown', this.textEditKeydown, true)
    element.addEventListener('blur', this.textEditCommit, true)
    this.notify()
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
      this.pushUndo({ type: 'add', edit: entry })
    }
    this.showStatus(localizedMessage('pickerStatusTextSaved', 'Text saved'), true)
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
    element.style.removeProperty('outline')
    element.style.removeProperty('outline-offset')
    if (!element.getAttribute('style')) element.removeAttribute('style')
    this.textEditEl = null
    this.notify()
  }

  undo(): void {
    const entry = this.undoStack.pop()
    if (!entry) return
    if (entry.type === 'add') {
      const live = this.findLiveEdit(entry.edit)
      if (live) this.hiddenElements = this.hiddenElements.filter((edit) => edit !== live)
      this.redoStack.push({ type: 'add', edit: live ?? entry.edit })
    } else {
      this.hiddenElements.push(entry.edit)
      this.redoStack.push({ type: 'remove', edit: entry.edit })
    }
    this.showStatus(localizedMessage('pickerStatusUndone', 'Undone'))
    this.updateCSS()
    this.persist()
    this.triggerResize()
    this.notify()
  }

  redo(): void {
    const entry = this.redoStack.pop()
    if (!entry) return
    if (entry.type === 'add') {
      this.hiddenElements.push(entry.edit)
      this.undoStack.push({ type: 'add', edit: entry.edit })
    } else {
      const live = this.findLiveEdit(entry.edit)
      if (live) this.hiddenElements = this.hiddenElements.filter((edit) => edit !== live)
      this.undoStack.push({ type: 'remove', edit: live ?? entry.edit })
    }
    this.showStatus(localizedMessage('pickerStatusRedone', 'Redone'))
    this.updateCSS()
    this.persist()
    this.triggerResize()
    this.notify()
  }

  private getSelector(element: Element): string | null {
    try {
      return getUniqueSelector(element)
    } catch {
      return null
    }
  }

  private applyTextEdits(): void {
    if (this.paused) return
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

  private restoreTextEdits(): void {
    for (const edit of this.hiddenElements) {
      if (edit.action !== 'text' || edit._original === undefined) continue
      try {
        const node = document.querySelector(edit.selector)
        if (node && node.textContent === edit.text) node.textContent = edit._original
      } catch { /* stale selector */ }
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
    this.pushUndo({ type: 'remove', edit: liveEdit })
    this.previewedHiddenSelector = null
    this.showStatus(localizedMessage('pickerStatusDeleted', 'Edit deleted'), true)
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

  /** Number of page elements matching a selector; -1 when it cannot parse. */
  countMatches(selector: string): number {
    const trimmed = selector.trim()
    if (!trimmed || /[{}]/.test(trimmed) || !isValidSelector(trimmed)) return -1
    try {
      return document.querySelectorAll(trimmed).length
    } catch {
      return -1
    }
  }

  applySelectorChange(edit: RuntimeEdit, nextSelector: string): boolean {
    const liveEdit = this.findLiveEdit(edit)
    const next = nextSelector.trim()
    if (!liveEdit || !next || !isValidSelector(next) || /[{}]/.test(next)) return false
    if (next !== liveEdit.selector) {
      liveEdit.selector = next
      this.updateCSS()
      this.persist()
    }
    this.notify()
    return true
  }

  updateRoundRadius(edit: RuntimeEdit, radius: number): void {
    const liveEdit = this.findLiveEdit(edit)
    if (!liveEdit || liveEdit.action !== 'round') return
    liveEdit.value = String(Math.round(radius))
    this.updateCSS()
    this.persist()
    this.notify()
  }

  updateCssEdit(edit: RuntimeEdit, declarations: string): boolean {
    const liveEdit = this.findLiveEdit(edit)
    if (!liveEdit || liveEdit.action !== 'css') return false
    if (!sanitizeCssDeclarations(declarations)) return false
    liveEdit.value = declarations
    this.updateCSS()
    this.persist()
    this.notify()
    return true
  }

  addCssEdit(selector: string, declarations: string): boolean {
    const next = selector.trim()
    if (!next || !isValidSelector(next) || /[{}]/.test(next)) return false
    if (!sanitizeCssDeclarations(declarations)) return false
    const edit: RuntimeEdit = { selector: next, permanent: this.settings.remember, action: 'css', value: declarations }
    this.hiddenElements.push(edit)
    this.pushUndo({ type: 'add', edit })
    this.showStatus(localizedMessage('pickerStatusCss', 'Custom CSS applied'), true)
    this.updateCSS()
    this.persist()
    this.notify()
    return true
  }

  /** Selector of the current selection, for creating a custom-CSS rule. */
  draftSelector(): string | null {
    return this.markedElement ? this.getSelector(this.markedElement) : null
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
    this.saveSettings()
    this.notify()
  }

  togglePause(): void {
    this.paused = !this.paused
    void this.sendMessage({ action: 'set_paused', website: siteKey(), data: String(this.paused) })
    if (this.paused) this.restoreTextEdits()
    this.updateCSS()
    this.applyTextEdits()
    this.triggerResize()
    this.showStatus(localizedMessage(this.paused ? 'pickerStatusPaused' : 'pickerStatusResumed', this.paused ? 'Paused on this site' : 'Rules active again'))
    this.notify()
  }

  dismissCoachmark(): void {
    this.settings.coachmarkSeen = true
    this.saveSettings()
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

  // --- Panel drag --------------------------------------------------------

  beginPanelDrag(startX: number, startY: number): void {
    const host = this.host
    if (!host || this.dragCleanup) return
    const rect = host.getBoundingClientRect()
    const offsetX = startX - rect.x
    const offsetY = startY - rect.y
    let moved = false

    const applyPosition = (clientX: number, clientY: number) => {
      const x = Math.min(Math.max(clientX - offsetX, 4), window.innerWidth - rect.width - 4)
      const y = Math.min(Math.max(clientY - offsetY, 4), window.innerHeight - rect.height - 4)
      host.style.left = `${x}px`
      host.style.top = `${y}px`
      host.style.right = 'auto'
      host.style.bottom = 'auto'
    }

    const onMove = (event: PointerEvent) => {
      moved = true
      applyPosition(event.clientX, event.clientY)
    }
    const onUp = () => {
      cleanup()
      if (!moved) return
      const current = host.getBoundingClientRect()
      const centerX = current.x + current.width / 2
      const centerY = current.y + current.height / 2
      const horizontal = centerX < window.innerWidth / 2 ? 'l' : 'r'
      const vertical = centerY < window.innerHeight / 2 ? 't' : 'b'
      this.panelCorner = `${vertical}${horizontal}` as PanelCorner
      host.style.left = ''
      host.style.top = ''
      host.style.right = ''
      host.style.bottom = ''
      this.updateCSS()

      if (!matchMedia(REDUCED_MOTION).matches) {
        const settled = host.getBoundingClientRect()
        const deltaX = current.x - settled.x
        const deltaY = current.y - settled.y
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          host.animate([
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0, 0)' },
          ], { duration: 220, easing: 'cubic-bezier(.32, .72, 0, 1)' })
        }
      }
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
      document.documentElement.style.removeProperty('user-select')
      this.dragCleanup = null
    }

    document.documentElement.style.setProperty('user-select', 'none')
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    this.dragCleanup = cleanup
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
    host.dataset.theme = this.resolvedTheme
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
    this.modalCloseHandler = null
    this.dragCleanup?.()
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
    const corner = this.panelCorner
    const position = [
      corner.includes('b') ? `bottom: ${PANEL_MARGIN}px;` : `top: ${PANEL_MARGIN}px;`,
      corner.includes('r') ? `right: ${PANEL_MARGIN}px;` : `left: ${PANEL_MARGIN}px;`,
    ].join(' ')
    const cssLines = [
      `#elements_wnd { position: fixed; ${position} z-index: ${this.maxZIndex}; }`,
    ]

    if (!this.previewOriginal && !this.paused) {
      for (const edit of this.hiddenElements) {
        const selector = edit.selector.replace(/[{}]/g, '')
        if (selector === this.previewedHiddenSelector) {
          cssLines.push(`${selector} { outline: solid 3px rgba(34,211,238,.6) !important; outline-offset: -3px; }`)
          continue
        }
        if (!edit.action && (selector === 'body' || selector === 'html')) {
          cssLines.push(`${selector} { background: transparent !important; }`)
          continue
        }
        const declarations = editDeclarations(edit, this.settings.radius)
        if (declarations) cssLines.push(`${selector} { ${declarations} }`)
      }
    }

    if (!this.previewOriginal && !this.paused && this.hiddenElements.length) {
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
    void this.sendMessage({ action: 'badge', count: this.hiddenElements.length, paused: this.paused })
  }

  private persist(): void {
    const saved = this.hiddenElements
      .filter((edit) => edit.permanent)
      .map(({ selector, permanent, action, text, value }) => ({
        selector,
        permanent,
        ...(action ? { action } : {}),
        ...(text !== undefined ? { text } : {}),
        ...(value !== undefined ? { value } : {}),
      }))
    void this.sendMessage({ action: 'set_saved_elms', website: siteKey(), data: JSON.stringify(saved) })
  }

  // Native Chrome ignores a Promise returned from an onMessage listener, so
  // respond synchronously through sendResponse.
  private handleExtensionMessage = (message: { action?: string }, _sender: unknown, sendResponse: (response?: unknown) => void): undefined => {
    if (message.action === 'toggle') {
      this.toggle()
      sendResponse(true)
    } else if (message.action === 'getStatus') {
      sendResponse(this.targetingMode)
    }
    return undefined
  }

  destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true
    if (this.mutationObserver) this.mutationObserver.disconnect()
    window.clearTimeout(this.textEditObserverTimer)
    window.clearTimeout(this.statusTimer)
    cancelAnimationFrame(this.scrollNotifyFrame)
    this.stopThemeWatch?.()
    this.deactivate()
    document.removeEventListener('keydown', this.handleKeydown, true)
    document.removeEventListener('keyup', this.handleKeyup, true)
    try {
      browser.runtime.onMessage.removeListener(this.handleExtensionMessage)
    } catch { /* context already invalidated */ }
    if (browser.runtime?.id) document.querySelector('#elements_styles')?.remove()
  }
}
