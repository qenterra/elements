import { browser } from 'wxt/browser'
import {
  createRuleId,
  DEFAULT_SETTINGS,
  MAX_RADIUS,
  MIN_RADIUS,
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
import {
  PROTOCOL_VERSION,
  isContentCommand,
  type ExtensionRequest,
  type ResponseFor,
} from '../core/protocol'
import { siteKeyFromUrl } from '../core/site'
import { resolveTheme, watchSystemTheme } from '../core/theme'
import { sendProtocolMessage } from '../core/transport'
import { SnapshotHistory } from './history'
import { getUniqueSelector, isValidSelector } from './selector'
import { RuleEngine } from './rule-engine'

export interface OverlayRenderer {
  mount(shadowRoot: ShadowRoot, controller: ElementController): { unmount: () => void }
}

export interface ElementControllerOptions {
  loadRenderer: () => Promise<OverlayRenderer>
  onDestroy?: () => void
}

type Listener = () => void
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
  return siteKeyFromUrl(location.href) ?? location.hostname.toLowerCase().replace(/^www\./, '')
}

function editKey(edit: RuntimeEdit): string {
  return edit.id ?? `${edit.action ?? 'hide'}:${edit.selector}`
}

function cloneEdits(edits: RuntimeEdit[]): RuntimeEdit[] {
  return edits.map((edit) => ({ ...edit }))
}

function comparableEdits(edits: RuntimeEdit[]): string {
  return JSON.stringify(edits.map(({ _original: _ignored, ...edit }) => edit))
}

function toPlainRect(rect: DOMRect): MarkedInfo['rect'] {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

export class ElementController {
  private readonly listeners = new Set<Listener>()
  private readonly loadRenderer: () => Promise<OverlayRenderer>
  private readonly onDestroy: () => void
  private readonly maxZIndex = 2147483647
  private readonly history = new SnapshotHistory<RuntimeEdit[]>(
    cloneEdits,
    (left, right) => comparableEdits(left) === comparableEdits(right),
  )
  private readonly ruleEngine = new RuleEngine()

  private host: HTMLDivElement | null = null
  private overlayUi: { unmount: () => void } | null = null
  private highlighter: HTMLDivElement | null = null
  private readonly iframeOverlays = new Set<OverlayElement>()
  private frameResizeObserver: ResizeObserver | null = null
  private mutationObserver: MutationObserver | null = null
  private isDestroyed = false
  private incognito = false
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
  private viewportNotifyFrame = 0
  private readonly suppressedKeyups = new Set<string>()
  private selectionLocked = false

  hoveredElement: Element | null = null
  markedElement: Element | null = null
  previewOriginal = false
  targetingMode = false
  transpose = 0
  hiddenElements: RuntimeEdit[] = []

  constructor(options: ElementControllerOptions) {
    this.loadRenderer = options.loadRenderer
    this.onDestroy = options.onDestroy ?? (() => undefined)
  }

  async init(): Promise<void> {
    // Register messaging before storage I/O so an early toolbar click is not lost.
    document.addEventListener('keydown', this.handleKeydown, true)
    document.addEventListener('keyup', this.handleKeyup, true)
    window.addEventListener('resize', this.handleViewportResize, true)
    browser.runtime.onMessage.addListener(this.handleExtensionMessage)

    const snapshot = await this.request({
      v: PROTOCOL_VERSION,
      type: 'site.snapshot',
      site: siteKey(),
    })
    if (!snapshot) return

    this.hiddenElements = snapshot.rules.map((edit) => ({ ...edit }))
    this.settings = { ...snapshot.settings }
    this.hotkey = snapshot.hotkey
    this.paused = snapshot.paused
    this.incognito = snapshot.incognito
    if (this.incognito) {
      this.settings.remember = false
      this.hiddenElements.forEach((edit) => {
        edit.permanent = false
      })
    }
    this.applyThemePreference()
    this.updateCSS()
    this.notify()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): OverlaySnapshot {
    return {
      minimized: this.minimized,
      incognito: this.incognito,
      previewOriginal: this.previewOriginal,
      paused: this.paused,
      hotkey: this.hotkey,
      settings: { ...this.settings },
      edits: this.hiddenElements.map((edit) => ({ ...edit })),
      path: this.getPathTokens(),
      status: this.status,
      marked: this.getMarkedInfo(),
      textEditRect: this.textEditEl?.isConnected
        ? toPlainRect(this.textEditEl.getBoundingClientRect())
        : null,
      resolvedTheme: this.resolvedTheme,
      showCoachmark: this.targetingMode && !this.settings.coachmarkSeen,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private async request<R extends ExtensionRequest>(
    message: R,
  ): Promise<ResponseFor<R> | undefined> {
    if (!browser.runtime?.id) {
      this.destroy()
      return undefined
    }

    const result = await sendProtocolMessage(message)
    if (result.ok) return result.data
    if (result.error === 'RUNTIME_UNAVAILABLE' || !browser.runtime?.id) this.destroy()
    return undefined
  }

  private async reloadSnapshot(): Promise<void> {
    const snapshot = await this.request({
      v: PROTOCOL_VERSION,
      type: 'site.snapshot',
      site: siteKey(),
    })
    if (!snapshot || this.isDestroyed) return
    const storedKeys = new Set(snapshot.rules.map((edit) => editKey(edit)))
    const temporary = this.hiddenElements.filter(
      (edit) => !edit.permanent && !storedKeys.has(editKey(edit)),
    )
    this.hiddenElements = [...snapshot.rules.map((edit) => ({ ...edit })), ...temporary]
    this.settings = { ...snapshot.settings }
    this.hotkey = snapshot.hotkey
    this.paused = snapshot.paused
    this.incognito = snapshot.incognito
    if (this.incognito) {
      this.settings.remember = false
      this.hiddenElements.forEach((edit) => {
        edit.permanent = false
      })
    }
    this.history.clear()
    this.applyThemePreference()
    this.updateCSS()
    this.notify()
  }

  private saveSettings(): void {
    const settings = { ...this.settings }
    void this.request({
      v: PROTOCOL_VERSION,
      type: 'settings.save',
      settings,
    }).catch(() => undefined)
  }

  // --- Theme -------------------------------------------------------------

  private applyThemePreference(): void {
    this.resolvedTheme = resolveTheme(this.settings.theme)
    this.stopThemeWatch?.()
    this.stopThemeWatch =
      this.settings.theme === 'system'
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
    if (!this.selectionLocked || !this.markedElement?.isConnected || this.textEditEl) return null
    return {
      rect: toPlainRect(this.markedElement.getBoundingClientRect()),
      label: this.elementLabel(this.markedElement),
    }
  }

  private getPathTokens(): PathToken[] {
    if (!this.hoveredElement) return []

    let element: Element | null = this.hoveredElement
    if (element.classList.contains('elements-extension-frame-shield-v2')) {
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
    const host = this.host
    if (!host || !(element instanceof Node)) return false
    return element === host || host.contains(element) || element.getRootNode() === host.shadowRoot
  }

  private ensureHighlighter(): HTMLDivElement {
    if (this.highlighter) return this.highlighter

    const highlighter = document.createElement('div')
    highlighter.id = 'elements-extension-highlighter-v2'
    Object.assign(highlighter.style, {
      pointerEvents: 'none',
      position: 'fixed',
      borderRadius: '8px',
      transformOrigin: 'center',
      zIndex: String(this.maxZIndex - 1),
    })

    document.body.appendChild(highlighter)
    this.highlighter = highlighter
    this.styleHighlighter()
    return highlighter
  }

  private styleHighlighter(): void {
    if (!this.highlighter) return
    const dark = this.resolvedTheme === 'dark'
    this.highlighter.toggleAttribute('data-locked', this.selectionLocked)
    Object.assign(this.highlighter.style, {
      background: dark
        ? this.selectionLocked
          ? 'rgba(34,211,238,0.14)'
          : 'rgba(34,211,238,0.08)'
        : this.selectionLocked
          ? 'rgba(21,94,117,0.12)'
          : 'rgba(21,94,117,0.07)',
      outline: dark
        ? `${this.selectionLocked ? 'solid 2px' : 'dashed 1px'} rgba(103,227,245,0.9)`
        : `${this.selectionLocked ? 'solid 2px' : 'dashed 1px'} rgba(21,94,117,0.9)`,
      outlineOffset: '-2px',
      boxShadow: this.selectionLocked
        ? dark
          ? '0 0 0 1px rgba(34,211,238,0.12), 0 8px 28px rgba(34,211,238,0.14)'
          : '0 0 0 1px rgba(21,94,117,0.12), 0 8px 28px rgba(21,94,117,0.16)'
        : 'none',
      color: dark ? '#67e3f5' : '#155e75',
    })
  }

  private highlightElement(animateGeometry = false): void {
    if (!this.hoveredElement) return

    let marked = this.hoveredElement
    if (marked.classList.contains('elements-extension-frame-shield-v2')) {
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
      this.highlighter?.animate(
        [
          { opacity: 0, transform: 'scale(.985)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        {
          duration: 140,
          easing: 'cubic-bezier(.23, 1, .32, 1)',
        },
      )
    }
    this.notify()
  }

  private unhighlightElement(): void {
    this.highlighter?.remove()
    this.highlighter = null
    this.markedElement = null
    this.hoveredElement = null
    this.transpose = 0
    this.selectionLocked = false
    this.notify()
  }

  private positionHighlighter(animateGeometry: boolean): void {
    const rect = this.markedElement?.getBoundingClientRect()
    if (!rect || !this.highlighter) return
    this.highlighter.style.transition =
      animateGeometry && !matchMedia(REDUCED_MOTION).matches
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
    if (!this.targetingMode || this.selectionLocked) return
    if (this.textEditEl || this.modalCloseHandler) return

    if (this.isChildOfWindow(event.target)) return

    if (!(event.target instanceof Element) || event.target === this.hoveredElement) return
    this.transpose = 0
    this.hoveredElement = event.target
    this.highlightElement(true)
    this.notify()
  }

  private selectTarget = (event: MouseEvent): void => {
    if (!this.targetingMode || this.textEditEl || this.modalCloseHandler) return
    if (this.isChildOfWindow(event.target)) return

    event.preventDefault()
    event.stopPropagation()
    if (event.button !== 0 || !(event.target instanceof Element)) return

    if (this.selectionLocked) {
      this.unhighlightElement()
      return
    }

    if (event.target !== this.hoveredElement) {
      this.transpose = 0
      this.hoveredElement = event.target
      this.highlightElement(true)
    }
    if (!this.markedElement) return

    this.selectionLocked = true
    this.styleHighlighter()
    this.notify()
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!this.targetingMode || this.textEditEl) return

    if (this.modalCloseHandler) {
      if (event.code === 'Escape') {
        this.suppressedKeyups.add(event.code)
        event.stopPropagation()
        event.preventDefault()
        this.modalCloseHandler()
      }
      return
    }

    if (event.code === 'Escape') this.deactivate()
    else if (event.code === 'Space' && this.selectionLocked) this.applyAction('hide')
    else if (event.code === 'KeyE' && this.selectionLocked && this.markedElement)
      this.startTextEdit(this.markedElement)
    else if (event.code === 'KeyC' && this.selectionLocked) this.applyAction('round')
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

    this.suppressedKeyups.add(event.code)
    event.stopPropagation()
    event.preventDefault()
  }

  private handleKeyup = (event: KeyboardEvent): void => {
    if (!this.suppressedKeyups.delete(event.code)) return
    event.stopPropagation()
    event.preventDefault()
  }

  /** Called by the overlay UI while a popover/menu owns keyboard focus. */
  setModal(open: boolean, onClose: (() => void) | null = null): void {
    this.modalCloseHandler = open ? onClose : null
  }

  // --- Edits -------------------------------------------------------------

  private captureRules(): RuntimeEdit[] {
    return cloneEdits(this.hiddenElements)
  }

  private recordHistory(before: RuntimeEdit[]): void {
    this.history.record(before, this.captureRules())
  }

  applyAction(kind: 'hide' | EditAction, event?: MouseEvent): void {
    if (
      !this.selectionLocked ||
      !this.markedElement ||
      (event && this.isChildOfWindow(event.target))
    )
      return
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
    const before = this.captureRules()

    if (kind === 'hide') {
      const now = Date.now()
      const edit: RuntimeEdit = {
        id: createRuleId(),
        selector,
        permanent: this.settings.remember,
        createdAt: now,
        updatedAt: now,
      }
      this.unhighlightElement()
      this.hiddenElements.push(edit)
      this.recordHistory(before)
      this.showStatus(localizedMessage('pickerStatusHidden', 'Element hidden'), true)
      this.updateCSS()
      this.persist()
      this.triggerResize()
      event?.preventDefault()
      event?.stopPropagation()
      return
    }

    // Toggleable style actions: applying twice removes the rule.
    const existing = this.hiddenElements.findIndex(
      (edit) => edit.action === kind && edit.selector === selector,
    )
    if (existing >= 0) {
      this.hiddenElements.splice(existing, 1)
      this.showStatus(localizedMessage('pickerStatusRemoved', 'Edit removed'), true)
    } else {
      const now = Date.now()
      const edit: RuntimeEdit = {
        id: createRuleId(),
        selector,
        permanent: this.settings.remember,
        action: kind,
        ...(kind === 'round' ? { value: String(this.settings.radius) } : {}),
        createdAt: now,
        updatedAt: now,
      }
      this.hiddenElements.push(edit)
      const statusKey = {
        round: 'pickerStatusRounded',
        blur: 'pickerStatusBlurred',
        dim: 'pickerStatusDimmed',
        gray: 'pickerStatusGrayed',
        css: 'pickerStatusCss',
      }[kind]
      this.showStatus(localizedMessage(statusKey, 'Edit applied'), true)
    }
    this.recordHistory(before)
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
    this.textEditOriginal = this.ruleEngine.textFor(element)
    this.notify()
  }

  textEditValue(): string {
    return this.textEditOriginal
  }

  commitTextEdit(nextText: string): boolean {
    const element = this.textEditEl
    if (!element || !nextText.trim()) return false
    const original = this.textEditOriginal
    if (nextText === original) {
      this.finishTextEdit()
      return true
    }

    const selector = this.getSelector(element)
    if (!selector) return false
    const before = this.captureRules()
    const existing = this.hiddenElements.findIndex(
      (edit) => edit.action === 'text' && edit.selector === selector,
    )
    const now = Date.now()
    const entry: RuntimeEdit = {
      id: existing >= 0 ? this.hiddenElements[existing].id : createRuleId(),
      selector,
      permanent: this.settings.remember,
      action: 'text',
      text: nextText,
      createdAt: existing >= 0 ? (this.hiddenElements[existing].createdAt ?? now) : now,
      updatedAt: now,
    }
    if (existing >= 0) this.hiddenElements[existing] = entry
    else this.hiddenElements.push(entry)
    this.recordHistory(before)
    this.finishTextEdit()
    this.showStatus(localizedMessage('pickerStatusTextSaved', 'Text saved'), true)
    this.updateCSS()
    this.persist()
    this.notify()
    return true
  }

  cancelTextEdit(): void {
    if (!this.textEditEl) return
    this.finishTextEdit()
  }

  private finishTextEdit(): void {
    if (!this.textEditEl) return
    this.textEditEl = null
    this.notify()
  }

  undo(): void {
    const previous = this.history.undo()
    if (!previous) return
    this.restoreTextEdits()
    this.hiddenElements = previous
    this.showStatus(localizedMessage('pickerStatusUndone', 'Undone'))
    this.updateCSS()
    this.persist()
    this.triggerResize()
    this.notify()
  }

  redo(): void {
    const next = this.history.redo()
    if (!next) return
    this.restoreTextEdits()
    this.hiddenElements = next
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
    if (this.paused || this.previewOriginal) {
      this.ruleEngine.restoreText()
      return
    }
    this.ruleEngine.apply({
      rules: this.hiddenElements,
      paused: this.paused,
      showOriginal: this.previewOriginal,
      previewSelector: this.previewedHiddenSelector,
      defaultRadius: this.settings.radius,
    })
  }

  private restoreTextEdits(): void {
    this.ruleEngine.restoreText()
  }

  private syncTextObserver(): void {
    const shouldObserve =
      !this.paused &&
      !this.previewOriginal &&
      this.hiddenElements.some((edit) => edit.action === 'text')
    if (!shouldObserve) {
      this.mutationObserver?.disconnect()
      this.mutationObserver = null
      return
    }
    if (this.mutationObserver) return
    this.mutationObserver = new MutationObserver(() => {
      if (this.targetingMode || this.textEditEl) return
      window.clearTimeout(this.textEditObserverTimer)
      this.textEditObserverTimer = window.setTimeout(() => this.applyTextEdits(), 120)
    })
    this.mutationObserver.observe(document.documentElement, { childList: true, subtree: true })
  }

  previewEdit(edit: RuntimeEdit, showOriginal: boolean): void {
    edit = this.findLiveEdit(edit) ?? edit
    if (edit.action === 'text') {
      if (showOriginal) this.ruleEngine.restoreText(edit)
      else this.updateCSS()
      return
    }

    this.previewedHiddenSelector = showOriginal ? edit.selector : null
    this.updateCSS()
  }

  deleteEdit(edit: RuntimeEdit): void {
    const liveEdit = this.findLiveEdit(edit)
    if (!liveEdit) return
    const before = this.captureRules()
    if (liveEdit.action === 'text') this.previewEdit(liveEdit, true)
    this.hiddenElements = this.hiddenElements.filter((candidate) => candidate !== liveEdit)
    this.recordHistory(before)
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
    const before = this.captureRules()
    liveEdit.permanent = this.incognito ? false : permanent
    liveEdit.updatedAt = Date.now()
    this.recordHistory(before)
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

  updateEdit(edit: RuntimeEdit, changes: { selector: string; value?: string | number }): boolean {
    const liveEdit = this.findLiveEdit(edit)
    const next = changes.selector.trim()
    if (!liveEdit || !next || !isValidSelector(next) || /[{}]/.test(next)) return false

    let value = liveEdit.value
    if (liveEdit.action === 'css') {
      if (typeof changes.value !== 'string') return false
      const sanitized = sanitizeCssDeclarations(changes.value)
      if (!sanitized) return false
      value = sanitized
    } else if (liveEdit.action === 'round') {
      const radius = typeof changes.value === 'number' ? changes.value : Number(changes.value)
      if (!Number.isFinite(radius)) return false
      value = String(Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(radius))))
    }

    const before = this.captureRules()
    if (liveEdit.action === 'text' && next !== liveEdit.selector) this.previewEdit(liveEdit, true)
    liveEdit.selector = next
    if (liveEdit.action === 'round' || liveEdit.action === 'css') liveEdit.value = value
    liveEdit.updatedAt = Date.now()
    this.recordHistory(before)
    this.updateCSS()
    this.persist()
    this.notify()
    return true
  }

  addCssEdit(selector: string, declarations: string): boolean {
    const next = selector.trim()
    if (!next || !isValidSelector(next) || /[{}]/.test(next)) return false
    const sanitized = sanitizeCssDeclarations(declarations)
    if (!sanitized) return false
    const before = this.captureRules()
    const now = Date.now()
    const edit: RuntimeEdit = {
      id: createRuleId(),
      selector: next,
      permanent: this.settings.remember,
      action: 'css',
      value: sanitized,
      createdAt: now,
      updatedAt: now,
    }
    this.hiddenElements.push(edit)
    this.recordHistory(before)
    this.showStatus(localizedMessage('pickerStatusCss', 'Custom CSS applied'), true)
    this.updateCSS()
    this.persist()
    this.notify()
    return true
  }

  /** Selector of the current selection, for creating a custom-CSS rule. */
  draftSelector(): string | null {
    return this.selectionLocked && this.markedElement ? this.getSelector(this.markedElement) : null
  }

  private findLiveEdit(edit: RuntimeEdit): RuntimeEdit | undefined {
    return this.hiddenElements.find((candidate) => editKey(candidate) === editKey(edit))
  }

  toggleCompare(): void {
    this.previewOriginal = !this.previewOriginal
    if (this.previewOriginal) this.restoreTextEdits()
    this.updateCSS()
    this.triggerResize()
    this.notify()
  }

  toggleRemember(): void {
    if (this.incognito) return
    this.settings.remember = !this.settings.remember
    this.saveSettings()
    this.notify()
  }

  togglePause(): void {
    this.paused = !this.paused
    void this.request({
      v: PROTOCOL_VERSION,
      type: 'site.pause',
      site: siteKey(),
      paused: this.paused,
    })
    if (this.paused) this.restoreTextEdits()
    this.updateCSS()
    this.applyTextEdits()
    this.triggerResize()
    this.showStatus(
      localizedMessage(
        this.paused ? 'pickerStatusPaused' : 'pickerStatusResumed',
        this.paused ? 'Paused on this site' : 'Rules active again',
      ),
    )
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
      if (
        Math.abs(startRect.width - endRect.width) < 1 &&
        Math.abs(startRect.height - endRect.height) < 1
      )
        return
      const animation = panel.animate(
        [
          { width: `${startRect.width}px`, height: `${startRect.height}px` },
          { width: `${endRect.width}px`, height: `${endRect.height}px` },
        ],
        {
          duration: this.minimized ? 260 : 280,
          easing: 'cubic-bezier(.32, .72, 0, 1)',
        },
      )
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
    if (!host || this.dragCleanup || window.matchMedia('(max-width: 560px)').matches) return
    const rect = host.getBoundingClientRect()
    const offsetX = startX - rect.x
    const offsetY = startY - rect.y
    let moved = false

    const applyPosition = (clientX: number, clientY: number) => {
      const x = Math.min(Math.max(clientX - offsetX, 4), window.innerWidth - rect.width - 4)
      const y = Math.min(Math.max(clientY - offsetY, 4), window.innerHeight - rect.height - 4)
      host.style.setProperty('left', `${x}px`, 'important')
      host.style.setProperty('top', `${y}px`, 'important')
      host.style.removeProperty('right')
      host.style.removeProperty('bottom')
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
      host.style.removeProperty('left')
      host.style.removeProperty('top')
      host.style.removeProperty('right')
      host.style.removeProperty('bottom')
      this.updateCSS()

      if (!matchMedia(REDUCED_MOTION).matches) {
        const settled = host.getBoundingClientRect()
        const deltaX = current.x - settled.x
        const deltaY = current.y - settled.y
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          host.animate(
            [
              { transform: `translate(${deltaX}px, ${deltaY}px)` },
              { transform: 'translate(0, 0)' },
            ],
            { duration: 220, easing: 'cubic-bezier(.32, .72, 0, 1)' },
          )
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
    void this.request({ v: PROTOCOL_VERSION, type: 'options.open' })
  }

  openHotkeySettings(): void {
    void this.request({ v: PROTOCOL_VERSION, type: 'shortcut.open' })
  }

  activate(): void {
    if (this.targetingMode) return
    this.targetingMode = true
    this.previewOriginal = false
    this.minimized = false

    const host = document.createElement('div')
    host.id = 'elements-extension-root-v2'
    host.setAttribute('data-elements-extension-root', '')
    host.dataset.theme = this.resolvedTheme
    const shadowRoot = host.attachShadow({ mode: 'open' })
    document.body.appendChild(host)
    this.host = host
    void this.loadRenderer()
      .then((renderer) => {
        if (!this.targetingMode || this.host !== host || !host.isConnected) return
        this.overlayUi = renderer.mount(shadowRoot, this)
        this.notify()
      })
      .catch(() => {
        if (this.host === host) this.deactivate()
      })

    document.addEventListener('mouseover', this.handleMouseover, true)
    document.addEventListener('mousedown', this.selectTarget, true)
    document.addEventListener('mouseup', this.preventEvent, true)
    document.addEventListener('click', this.preventEvent, true)
    document.addEventListener('scroll', this.updateHighlighterPosition, true)
    this.updateCSS()
    this.addOverlays()
    void this.request({ v: PROTOCOL_VERSION, type: 'picker.status', active: true })
    this.notify()
  }

  deactivate(): void {
    if (!this.targetingMode) return
    this.targetingMode = false
    this.previewOriginal = false
    this.modalCloseHandler = null
    this.finishTextEdit()
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
    document.removeEventListener('mousedown', this.selectTarget, true)
    document.removeEventListener('mouseup', this.preventEvent, true)
    document.removeEventListener('click', this.preventEvent, true)
    document.removeEventListener('scroll', this.updateHighlighterPosition, true)
    this.removeOverlays()
    void this.request({ v: PROTOCOL_VERSION, type: 'picker.status', active: false })
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
    if (!this.frameResizeObserver && typeof ResizeObserver !== 'undefined') {
      this.frameResizeObserver = new ResizeObserver(() => this.syncFrameOverlays())
    }
    for (const element of document.querySelectorAll('iframe, embed')) {
      const rect = element.getBoundingClientRect()
      const overlay = document.createElement('div') as OverlayElement
      overlay.className = 'elements-extension-frame-shield-v2'
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
      this.iframeOverlays.add(overlay)
      this.frameResizeObserver?.observe(element)
    }
  }

  private removeOverlays(): void {
    this.frameResizeObserver?.disconnect()
    this.frameResizeObserver = null
    for (const overlay of this.iframeOverlays) overlay.remove()
    this.iframeOverlays.clear()
  }

  private syncFrameOverlays(): void {
    for (const overlay of this.iframeOverlays) {
      const element = overlay.relatedElement
      if (!element?.isConnected) {
        overlay.remove()
        this.iframeOverlays.delete(overlay)
        continue
      }
      const rect = element.getBoundingClientRect()
      Object.assign(overlay.style, {
        left: `${rect.left + window.scrollX}px`,
        top: `${rect.top + window.scrollY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      })
    }
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
    this.positionHost()
    this.ruleEngine.apply({
      rules: this.hiddenElements,
      paused: this.paused,
      showOriginal: this.previewOriginal,
      previewSelector: this.previewedHiddenSelector,
      defaultRadius: this.settings.radius,
    })
    this.syncTextObserver()
    void this.request({
      v: PROTOCOL_VERSION,
      type: 'badge.update',
      count: this.hiddenElements.length,
      paused: this.paused,
    })
  }

  private positionHost(): void {
    if (!this.host) return
    const style = this.host.style
    style.setProperty('position', 'fixed', 'important')
    style.setProperty('z-index', String(this.maxZIndex), 'important')
    style.removeProperty('top')
    style.removeProperty('right')
    style.removeProperty('bottom')
    style.removeProperty('left')
    if (window.matchMedia('(max-width: 560px)').matches) {
      style.setProperty('right', '8px', 'important')
      style.setProperty('bottom', '8px', 'important')
      style.setProperty('left', '8px', 'important')
      return
    }
    const corner = this.panelCorner
    if (corner.includes('t')) style.setProperty('top', `${PANEL_MARGIN}px`, 'important')
    if (corner.includes('r')) style.setProperty('right', `${PANEL_MARGIN}px`, 'important')
    if (corner.includes('b')) style.setProperty('bottom', `${PANEL_MARGIN}px`, 'important')
    if (corner.includes('l')) style.setProperty('left', `${PANEL_MARGIN}px`, 'important')
  }

  private handleViewportResize = (): void => {
    if (this.viewportNotifyFrame) return
    this.viewportNotifyFrame = requestAnimationFrame(() => {
      this.viewportNotifyFrame = 0
      this.positionHost()
      this.syncFrameOverlays()
      this.notify()
    })
  }

  private persist(): void {
    const saved = this.hiddenElements
      .filter((edit) => edit.permanent)
      .map(({ id, selector, permanent, action, text, value, createdAt, updatedAt }) => ({
        ...(id ? { id } : {}),
        selector,
        permanent,
        ...(action ? { action } : {}),
        ...(text !== undefined ? { text } : {}),
        ...(value !== undefined ? { value } : {}),
        ...(createdAt !== undefined ? { createdAt } : {}),
        ...(updatedAt !== undefined ? { updatedAt } : {}),
      }))
    // Dispatch immediately: the background repository already serializes writes.
    // Deferring the final snapshot behind a content-script promise can lose an
    // undo/delete when the tab closes before that queued callback starts.
    void this.request({
      v: PROTOCOL_VERSION,
      type: 'site.rules.save',
      site: siteKey(),
      rules: saved,
    }).catch(() => undefined)
  }

  // Native Chrome ignores a Promise returned from an onMessage listener, so
  // respond synchronously through sendResponse.
  private handleExtensionMessage = (
    message: unknown,
    _sender: unknown,
    sendResponse: (response?: unknown) => void,
  ): undefined => {
    if (!isContentCommand(message)) return undefined
    if (message.type === 'picker.toggle') {
      this.toggle()
      sendResponse(true)
    } else if (message.type === 'picker.getStatus') {
      sendResponse(this.targetingMode)
    } else if (message.type === 'site.changed' && message.site === siteKey()) {
      void this.reloadSnapshot()
      sendResponse(true)
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
    cancelAnimationFrame(this.viewportNotifyFrame)
    this.stopThemeWatch?.()
    this.deactivate()
    this.ruleEngine.destroy()
    document.removeEventListener('keydown', this.handleKeydown, true)
    document.removeEventListener('keyup', this.handleKeyup, true)
    window.removeEventListener('resize', this.handleViewportResize, true)
    try {
      browser.runtime.onMessage.removeListener(this.handleExtensionMessage)
    } catch {
      /* context already invalidated */
    }
    this.onDestroy()
  }
}
