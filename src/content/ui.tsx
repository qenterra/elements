import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { browser } from 'wxt/browser'
import contentCss from './content.css?raw'
import { BrandMark } from '../components/BrandMark'
import { useFocusTrap } from '../components/useFocusTrap'
import { qdsShadowDomStyles } from '../qds/adapter/shadow-dom'
import {
  MAX_RADIUS,
  MIN_RADIUS,
  type MarkedInfo,
  type OverlaySnapshot,
  type RuntimeEdit,
} from '../core/model'
import { ElementController } from './controller'

type I18nApi = { getMessage: (name: string, substitutions?: string | string[]) => string }

function t(key: string, substitutions?: string | string[]): string {
  const i18n = browser.i18n as unknown as I18nApi
  return i18n.getMessage(key, substitutions) || key
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a2 2 0 0 0 2-2V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09A1.65 1.65 0 0 0 19.4 15z" />
    </Icon>
  )
}

function TrashIcon() {
  return (
    <Icon>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Icon>
  )
}

function EyeIcon() {
  return (
    <Icon>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

function EyeOffIcon() {
  return (
    <Icon>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
    </Icon>
  )
}

function TextIcon() {
  return (
    <Icon>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </Icon>
  )
}

function RoundIcon() {
  return (
    <Icon>
      <path d="M4 20v-6a10 10 0 0 1 10-10h6" />
    </Icon>
  )
}

function BlurIcon() {
  return (
    <Icon>
      <path d="M12 2.7s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.7 12 2.7z" />
    </Icon>
  )
}

function DimIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 4v1M12 19v1M4 12h1M19 12h1M6.3 6.3l.7.7M17 17l.7.7M6.3 17.7l.7-.7M17 7l.7-.7" />
    </Icon>
  )
}

function GrayIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

function CodeIcon() {
  return (
    <Icon>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </Icon>
  )
}

function UndoIcon() {
  return (
    <Icon>
      <polyline points="3 7 3 13 9 13" />
      <path d="M3 13a9 9 0 1 1 2.6 6.4" />
    </Icon>
  )
}

function RedoIcon() {
  return (
    <Icon>
      <polyline points="21 7 21 13 15 13" />
      <path d="M21 13a9 9 0 1 0-2.6 6.4" />
    </Icon>
  )
}

function PencilIcon() {
  return (
    <Icon>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Icon>
  )
}

function MoreIcon() {
  return (
    <Icon>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </Icon>
  )
}

function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </Icon>
  )
}

function MoonIcon() {
  return (
    <Icon>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
  )
}

function MonitorIcon() {
  return (
    <Icon>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </Icon>
  )
}

function PauseIcon() {
  return (
    <Icon>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </Icon>
  )
}

function ActionIcon({ action }: { action?: RuntimeEdit['action'] }) {
  if (action === 'round') return <RoundIcon />
  if (action === 'text') return <TextIcon />
  if (action === 'blur') return <BlurIcon />
  if (action === 'dim') return <DimIcon />
  if (action === 'gray') return <GrayIcon />
  if (action === 'css') return <CodeIcon />
  return <EyeOffIcon />
}

function actionLabel(action: RuntimeEdit['action']): string {
  if (action === 'round') return t('pickerRoundedCorners')
  if (action === 'text') return t('pickerTextEdited')
  if (action === 'blur') return t('pickerBlurred')
  if (action === 'dim') return t('pickerDimmed')
  if (action === 'gray') return t('pickerGrayed')
  if (action === 'css') return t('pickerCustomCss')
  return t('pickerHidden')
}

type Rect = MarkedInfo['rect']

type PopoverState =
  | { kind: 'edit'; edit: RuntimeEdit; anchor: Rect }
  | { kind: 'create-css'; selector: string; anchor: Rect }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function MatchBadge({ count }: { count: number }) {
  if (count < 0)
    return (
      <span className="popover__matches popover__matches_bad">{t('pickerSelectorInvalid')}</span>
    )
  if (count === 0)
    return (
      <span className="popover__matches popover__matches_bad">{t('pickerSelectorNoMatch')}</span>
    )
  return <span className="popover__matches">{t('pickerSelectorMatches', [String(count)])}</span>
}

function SelectorPopover({
  state,
  controller,
  onClose,
}: {
  state: PopoverState
  controller: ElementController
  onClose: () => void
}) {
  const isCss =
    state.kind === 'create-css' || (state.kind === 'edit' && state.edit.action === 'css')
  const isRound = state.kind === 'edit' && state.edit.action === 'round'
  const [selector, setSelector] = useState(
    state.kind === 'edit' ? state.edit.selector : state.selector,
  )
  const [css, setCss] = useState(state.kind === 'edit' ? (state.edit.value ?? '') : '')
  const [radius, setRadius] = useState(
    state.kind === 'edit' && state.edit.value !== undefined ? Number(state.edit.value) : 12,
  )
  const [invalid, setInvalid] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const matches = controller.countMatches(selector)

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const size = card.getBoundingClientRect()
    const left = clamp(state.anchor.x, 8, window.innerWidth - size.width - 8)
    let top = state.anchor.y - size.height - 10
    if (top < 8)
      top = clamp(
        state.anchor.y + state.anchor.height + 10,
        8,
        window.innerHeight - size.height - 8,
      )
    setPosition({ left, top })
  }, [state.anchor])

  useFocusTrap(cardRef, inputRef, onClose)

  useEffect(() => {
    controller.setModal(true, onClose)
    inputRef.current?.select()
    return () => controller.setModal(false)
  }, [controller, onClose])

  const save = () => {
    let succeeded = false
    if (state.kind === 'create-css') {
      succeeded = controller.addCssEdit(selector, css)
    } else {
      succeeded = controller.updateEdit(state.edit, {
        selector,
        ...(state.edit.action === 'css' ? { value: css } : {}),
        ...(isRound ? { value: radius } : {}),
      })
    }
    if (succeeded) onClose()
    else setInvalid(true)
  }

  return (
    <div
      ref={cardRef}
      className="popover"
      data-keep-highlight=""
      role="dialog"
      aria-label={t('pickerSelectorPrompt')}
      style={
        position
          ? { left: position.left, top: position.top, visibility: 'visible' }
          : { left: 0, top: 0, visibility: 'hidden' }
      }
    >
      <p className="popover__title">{isCss ? t('pickerCustomCss') : t('pickerSelectorPrompt')}</p>
      <label className="popover__label">
        {t('pickerSelectorLabel')}
        <input
          ref={inputRef}
          className={`popover__input${invalid || matches <= 0 ? ' popover__input_bad' : ''}`}
          type="text"
          value={selector}
          spellCheck={false}
          onChange={(event) => {
            setSelector(event.target.value)
            setInvalid(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
          }}
        />
      </label>
      <MatchBadge count={matches} />
      {isRound && (
        <label className="popover__label popover__label_row">
          {t('pickerRadius')}
          <input
            className="popover__range"
            type="range"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            value={radius}
            onChange={(event) => {
              setRadius(Number(event.target.value))
            }}
          />
          <span className="popover__value">{radius}px</span>
        </label>
      )}
      {isCss && (
        <label className="popover__label">
          {t('pickerCssLabel')}
          <textarea
            className={`popover__input popover__textarea${invalid ? ' popover__input_bad' : ''}`}
            value={css}
            rows={3}
            spellCheck={false}
            placeholder={t('pickerCssPlaceholder')}
            onChange={(event) => {
              setCss(event.target.value)
              setInvalid(false)
            }}
          />
        </label>
      )}
      <div className="popover__actions">
        <button type="button" className="popover__btn popover__btn_primary" onClick={save}>
          {t('pickerSave')}
        </button>
        <button type="button" className="popover__btn" onClick={onClose}>
          {t('pickerCancel')}
        </button>
      </div>
    </div>
  )
}

function MiniToolbar({
  marked,
  controller,
  advanced,
  onCreateCss,
}: {
  marked: MarkedInfo
  controller: ElementController
  advanced: boolean
  onCreateCss: (anchor: Rect) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [viewportRevision, setViewportRevision] = useState(0)

  useLayoutEffect(() => {
    const bar = barRef.current
    if (bar) setSize({ width: bar.offsetWidth, height: bar.offsetHeight })
  }, [advanced, marked.label, viewportRevision])

  useEffect(() => {
    const update = () => setViewportRevision((revision) => revision + 1)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  if (window.innerWidth <= 560) return null

  const width = size?.width ?? 210
  const height = size?.height ?? 36
  const left = clamp(marked.rect.x, 8, window.innerWidth - width - 8)
  const maxTop = window.innerHeight - height - 8
  const above = marked.rect.y - height - 8
  const below = marked.rect.y + marked.rect.height + 8
  const top = above >= 64 ? above : below <= maxTop ? below : clamp(above, 8, maxTop)

  return (
    <div
      ref={barRef}
      className="miniBar"
      data-keep-highlight=""
      style={{ left, top, visibility: size ? 'visible' : 'hidden' }}
    >
      <span className="miniBar__label" aria-hidden="true">
        <span className="miniBar__selector">{marked.label}</span>
        <span className="miniBar__size">
          {Math.round(marked.rect.width)}×{Math.round(marked.rect.height)}
        </span>
      </span>
      <span className="miniBar__rule" />
      <button
        type="button"
        className="miniBar__btn"
        title={`${t('pickerHideElement')} (Space)`}
        aria-label={t('pickerHideElement')}
        onClick={() => controller.applyAction('hide')}
      >
        <EyeOffIcon />
      </button>
      <button
        type="button"
        className="miniBar__btn"
        title={`${t('pickerEditText')} (E)`}
        aria-label={t('pickerEditText')}
        onClick={() => controller.applyAction('text')}
      >
        <TextIcon />
      </button>
      <button
        type="button"
        className="miniBar__btn"
        title={`${t('pickerRoundCorners')} (C)`}
        aria-label={t('pickerRoundCorners')}
        onClick={() => controller.applyAction('round')}
      >
        <RoundIcon />
      </button>
      <span className="miniBar__rule" />
      <button
        type="button"
        className="miniBar__btn"
        title={t('pickerBlurElement')}
        aria-label={t('pickerBlurElement')}
        onClick={() => controller.applyAction('blur')}
      >
        <BlurIcon />
      </button>
      <button
        type="button"
        className="miniBar__btn"
        title={t('pickerDimElement')}
        aria-label={t('pickerDimElement')}
        onClick={() => controller.applyAction('dim')}
      >
        <DimIcon />
      </button>
      <button
        type="button"
        className="miniBar__btn"
        title={t('pickerGrayElement')}
        aria-label={t('pickerGrayElement')}
        onClick={() => controller.applyAction('gray')}
      >
        <GrayIcon />
      </button>
      {advanced && (
        <button
          type="button"
          className="miniBar__btn"
          title={t('pickerCustomCss')}
          aria-label={t('pickerCustomCss')}
          onClick={(event) =>
            onCreateCss((event.currentTarget as HTMLElement).getBoundingClientRect())
          }
        >
          <CodeIcon />
        </button>
      )}
    </div>
  )
}

function TextEditor({ rect, controller }: { rect: Rect; controller: ElementController }) {
  const [value, setValue] = useState(() => controller.textEditValue())
  const [invalid, setInvalid] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const size = card.getBoundingClientRect()
    const left = clamp(rect.x, 8, window.innerWidth - size.width - 8)
    let top = rect.y + rect.height + 10
    if (top + size.height > window.innerHeight - 8)
      top = clamp(rect.y - size.height - 10, 8, window.innerHeight - size.height - 8)
    setPosition({ left, top })
  }, [rect])

  useFocusTrap(cardRef, inputRef, () => controller.cancelTextEdit())

  useEffect(() => {
    const cancel = () => controller.cancelTextEdit()
    controller.setModal(true, cancel)
    inputRef.current?.select()
    return () => controller.setModal(false)
  }, [controller])

  const save = () => {
    if (controller.commitTextEdit(value)) return
    setInvalid(true)
    inputRef.current?.focus()
  }

  return (
    <div
      ref={cardRef}
      className="popover textEditor"
      data-keep-highlight=""
      role="dialog"
      aria-label={t('pickerTextEditorTitle')}
      style={
        position
          ? { left: position.left, top: position.top, visibility: 'visible' }
          : { left: 0, top: 0, visibility: 'hidden' }
      }
    >
      <p className="popover__title">{t('pickerTextEditorTitle')}</p>
      <label className="popover__label">
        {t('pickerTextEditorLabel')}
        <textarea
          ref={inputRef}
          className={`popover__input popover__textarea${invalid ? ' popover__input_bad' : ''}`}
          value={value}
          rows={3}
          onChange={(event) => {
            setValue(event.target.value)
            setInvalid(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              save()
            }
          }}
        />
      </label>
      {invalid && (
        <p className="popover__error" role="alert">
          {t('pickerTextEditorEmpty')}
        </p>
      )}
      <div className="popover__actions">
        <button type="button" className="popover__btn popover__btn_primary" onClick={save}>
          {t('pickerSave')}
        </button>
        <button type="button" className="popover__btn" onClick={() => controller.cancelTextEdit()}>
          {t('pickerCancel')}
        </button>
      </div>
    </div>
  )
}

function Coachmark({ controller }: { controller: ElementController }) {
  return (
    <div className="coachmark" role="note">
      <p className="coachmark__title">{t('coachTitle')}</p>
      <p className="coachmark__hint">{t('coachHint')}</p>
      <button
        type="button"
        className="coachmark__dismiss"
        onClick={() => controller.dismissCoachmark()}
      >
        {t('coachDismiss')}
      </button>
    </div>
  )
}

function StatusToast({
  snapshot,
  controller,
}: {
  snapshot: OverlaySnapshot
  controller: ElementController
}) {
  const status = snapshot.status
  if (!status) return null
  return (
    <div className="statusToast__region" role="status" aria-live="polite">
      <div className="statusToast" key={status.id}>
        <span className="statusToast__text">{status.message}</span>
        {status.undoable && (
          <button type="button" className="statusToast__undo" onClick={() => controller.undo()}>
            {t('pickerUndoButton')}
          </button>
        )}
      </div>
    </div>
  )
}

function ThemeButton({
  snapshot,
  controller,
}: {
  snapshot: OverlaySnapshot
  controller: ElementController
}) {
  const preference = snapshot.settings.theme
  const title = t('pickerTheme', [
    t(
      preference === 'system' ? 'themeSystem' : preference === 'light' ? 'themeLight' : 'themeDark',
    ),
  ])
  return (
    <button
      type="button"
      className="topButton topButton_theme"
      title={title}
      aria-label={title}
      onClick={() => controller.cycleTheme()}
    >
      {preference === 'system' ? (
        <MonitorIcon />
      ) : preference === 'light' ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  )
}

function PickerPanel({ controller }: { controller: ElementController }) {
  const [snapshot, setSnapshot] = useState(controller.getSnapshot())
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const pathRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const [morePosition, setMorePosition] = useState<{ left: number; top: number } | null>(null)
  const pathRevision = snapshot.path
    .map((token) => `${token.label}:${token.active ? 'active' : 'idle'}`)
    .join('|')

  useEffect(() => controller.subscribe(() => setSnapshot(controller.getSnapshot())), [controller])
  useLayoutEffect(() => {
    const pathContainer = pathRef.current
    if (!pathContainer) return
    const active = pathContainer.querySelector<HTMLElement>('.pathNode.active')
    if (!active) {
      pathContainer.scrollLeft = pathContainer.scrollWidth
      return
    }
    const nextLeft = active.offsetLeft - (pathContainer.clientWidth - active.offsetWidth) / 2
    pathContainer.scrollTo({
      left: clamp(nextLeft, 0, pathContainer.scrollWidth - pathContainer.clientWidth),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [pathRevision])

  useLayoutEffect(() => {
    if (!moreOpen) {
      setMorePosition(null)
      return
    }

    const place = () => {
      const button = moreButtonRef.current
      const menu = moreMenuRef.current
      if (!button || !menu) return
      const anchor = button.getBoundingClientRect()
      const size = menu.getBoundingClientRect()
      const left = clamp(anchor.x, 8, window.innerWidth - size.width - 8)
      const above = anchor.y - size.height - 8
      const below = anchor.y + anchor.height + 8
      const preferredTop = above >= 8 ? above : below
      setMorePosition({
        left,
        top: clamp(preferredTop, 8, window.innerHeight - size.height - 8),
      })
    }

    place()
    const observer = new ResizeObserver(place)
    if (moreButtonRef.current) observer.observe(moreButtonRef.current)
    if (moreMenuRef.current) observer.observe(moreMenuRef.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [moreOpen])

  useEffect(() => {
    if (!moreOpen) return
    controller.setModal(true, () => setMoreOpen(false))
    moreMenuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus()
    return () => {
      controller.setModal(false)
      moreButtonRef.current?.focus()
    }
  }, [moreOpen, controller])

  const navigateMoreMenu = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    )
    if (!items.length) return
    const root = event.currentTarget.getRootNode()
    const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement
    const current = Math.max(0, items.indexOf(active as HTMLButtonElement))
    let next: number | null = null
    if (event.key === 'ArrowDown') next = (current + 1) % items.length
    else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (event.key === 'Escape' || event.key === 'Tab') {
      setMoreOpen(false)
      return
    }
    if (next === null) return
    event.preventDefault()
    items[next].focus()
  }

  const path = snapshot.path.length
    ? snapshot.path.flatMap((token, index) =>
        index === 0
          ? [
              <button
                type="button"
                key={`${index}:${token.label}`}
                className={`pathNode${token.active ? ' active' : ''}`}
                aria-current={token.active ? 'true' : undefined}
                aria-label={t('pickerSelectPathToken', [token.label])}
                disabled={snapshot.selectionState === 'idle'}
                onClick={() => controller.selectPathToken(index)}
              >
                {token.label}
              </button>,
            ]
          : [
              <span key={`${index}:${token.label}:separator`} className="pathSeparator">
                &gt;
              </span>,
              <button
                type="button"
                key={`${index}:${token.label}`}
                className={`pathNode${token.active ? ' active' : ''}`}
                aria-current={token.active ? 'true' : undefined}
                aria-label={t('pickerSelectPathToken', [token.label])}
                disabled={snapshot.selectionState === 'idle'}
                onClick={() => controller.selectPathToken(index)}
              >
                {token.label}
              </button>,
            ],
      )
    : t('pickerHoverHint')

  const hasSelection = snapshot.selectionState === 'selected' && !snapshot.textEditRect
  const visibleEdits = showAllHistory ? snapshot.edits : snapshot.edits.slice(0, 3)
  const canCollapseHistory = snapshot.edits.length > 3
  const openCreateCss = (anchor: Rect) => {
    const selector = controller.draftSelector()
    if (selector) setPopover({ kind: 'create-css', selector, anchor })
    setMoreOpen(false)
  }
  const runAction = (kind: Parameters<ElementController['applyAction']>[0]) => {
    controller.applyAction(kind)
    setMoreOpen(false)
  }

  return (
    <>
      <div
        className={`mainWindow mainWindow_animated${snapshot.minimized ? ' minimized' : ''}`}
        role="region"
        aria-label={t('pickerAriaLabel')}
        data-keep-highlight=""
      >
        <div
          className="header"
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('button')) return
            controller.beginPanelDrag(event.clientX, event.clientY)
          }}
        >
          <span className="header__logo">
            <BrandMark width="17" height="17" />
            Elements
          </span>
          <span className="header__logo header__logo_small" aria-hidden="true">
            <BrandMark width="14" height="14" />
            Elements
          </span>
        </div>

        <div className="topButtons">
          <ThemeButton snapshot={snapshot} controller={controller} />
          <button
            type="button"
            className="topButton topButton_settings"
            title={t('pickerSettings')}
            aria-label={t('pickerSettings')}
            onClick={() => controller.openOptions()}
          >
            <SettingsIcon />
          </button>
          <button
            type="button"
            className="topButton topButton_minimize"
            title={t(snapshot.minimized ? 'pickerExpand' : 'pickerMinimize')}
            aria-label={t(snapshot.minimized ? 'pickerExpand' : 'pickerMinimize')}
            onClick={() => controller.toggleMinimize()}
          >
            <i>
              <Icon>
                <line x1="7" y1="7" x2="17" y2="17" />
                <polyline points="17 7 17 17 7 17" />
              </Icon>
            </i>
          </button>
          <button
            type="button"
            className="topButton topButton_close"
            title={t('pickerClose')}
            aria-label={t('pickerClose')}
            onClick={() => controller.deactivate()}
          >
            <Icon>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </Icon>
          </button>
        </div>

        <div
          className="mainWindow__body"
          aria-hidden={snapshot.minimized}
          inert={snapshot.minimized ? true : undefined}
        >
          <hr />

          {snapshot.showCoachmark && <Coachmark controller={controller} />}

          <p className={`selectionStatus selectionStatus_${snapshot.selectionState}`} role="status">
            {t(
              snapshot.selectionState === 'selected'
                ? 'pickerSelected'
                : snapshot.selectionState === 'previewing'
                  ? 'pickerPreviewing'
                  : 'pickerSelectionIdle',
            )}
          </p>

          <div
            id="elements_current_elm"
            ref={pathRef}
            role="navigation"
            aria-label={t('pickerSelectionPath')}
          >
            {path}
          </div>

          <div className="actionBar" role="toolbar" aria-label={t('pickerActions')}>
            <button
              type="button"
              className="actionBtn qds-button qds-button--primary"
              aria-label={t('pickerActionHide')}
              disabled={!hasSelection}
              onClick={() => runAction('hide')}
            >
              <EyeOffIcon />
              <span>{t('pickerActionHide')}</span>
              <kbd>Space</kbd>
            </button>
            <button
              type="button"
              className="actionBtn qds-button qds-button--primary"
              aria-label={t('pickerActionText')}
              disabled={!hasSelection}
              onClick={() => runAction('text')}
            >
              <TextIcon />
              <span>{t('pickerActionText')}</span>
              <kbd>E</kbd>
            </button>
            <button
              type="button"
              className="actionBtn qds-button qds-button--primary"
              aria-label={t('pickerActionRound')}
              disabled={!hasSelection}
              onClick={() => runAction('round')}
            >
              <RoundIcon />
              <span>{t('pickerActionRound')}</span>
              <kbd>C</kbd>
            </button>
            <div className="actionBar__more">
              <button
                ref={moreButtonRef}
                type="button"
                className="actionBtn actionBtn_icon qds-icon-button"
                title={t('pickerMore')}
                aria-label={t('pickerMore')}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                <MoreIcon />
              </button>
            </div>
            <span className="actionBar__rule" />
            <button
              type="button"
              className="actionBtn actionBtn_icon qds-icon-button"
              disabled={!snapshot.canUndo}
              title={`${t('pickerUndoButton')} (Ctrl+Z)`}
              aria-label={t('pickerUndoButton')}
              onClick={() => controller.undo()}
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              className="actionBtn actionBtn_icon qds-icon-button"
              disabled={!snapshot.canRedo}
              title={`${t('pickerRedoButton')} (Ctrl+Shift+Z)`}
              aria-label={t('pickerRedoButton')}
              onClick={() => controller.redo()}
            >
              <RedoIcon />
            </button>
          </div>

          <div className="changes">
            <p className="changes__title">
              {t('pickerChanges')}
              {snapshot.edits.length > 0 && (
                <span className="changes__count">{snapshot.edits.length}</span>
              )}
            </p>
            {snapshot.edits.length === 0 && (
              <p className="changes__empty">
                <span className="bracket bracket_l" aria-hidden="true" />
                {t('pickerChangesEmpty')}
                <span className="bracket bracket_r" aria-hidden="true" />
              </p>
            )}
            {snapshot.edits.length > 0 && (
              <div className="editList" role="list">
                {visibleEdits.map((edit) => (
                  <EditRow
                    key={`${edit.action ?? 'hide'}:${edit.selector}`}
                    edit={edit}
                    controller={controller}
                    onEdit={(anchor) => setPopover({ kind: 'edit', edit, anchor })}
                  />
                ))}
              </div>
            )}
            {canCollapseHistory && (
              <button
                type="button"
                className="historyDisclosure qds-button qds-button--quiet"
                aria-expanded={showAllHistory}
                onClick={() => setShowAllHistory((showAll) => !showAll)}
              >
                {t(showAllHistory ? 'pickerShowRecentChanges' : 'pickerShowAllChanges', [
                  String(snapshot.edits.length),
                ])}
              </button>
            )}
          </div>

          <hr />
          <div className="footer">
            <button
              type="button"
              className="footerToggle"
              role="switch"
              aria-checked={snapshot.settings.remember}
              title={t(snapshot.incognito ? 'pickerIncognitoTemporary' : 'pickerRememberHint')}
              disabled={snapshot.incognito}
              onClick={() => controller.toggleRemember()}
            >
              <span className={`toggle${snapshot.settings.remember ? ' toggle_on' : ''}`}>
                <span className="toggle__knob" />
              </span>
              {t(snapshot.incognito ? 'pickerIncognitoTemporary' : 'pickerRememberDefault')}
            </button>
            <button
              type="button"
              className="footerToggle"
              role="switch"
              aria-checked={snapshot.previewOriginal}
              onClick={() => controller.toggleCompare()}
            >
              <span className={`toggle${snapshot.previewOriginal ? ' toggle_on' : ''}`}>
                <span className="toggle__knob" />
              </span>
              {t('pickerShowOriginal')}
            </button>
            <button
              type="button"
              className={`footerToggle footerToggle_pause${snapshot.paused ? ' isActive' : ''}`}
              role="switch"
              aria-checked={snapshot.paused}
              title={t('pickerPauseHint')}
              onClick={() => controller.togglePause()}
            >
              <PauseIcon />
              {t('pickerPause')}
            </button>
          </div>
          <p className="persistenceStatus qds-status" role="status">
            {t(
              snapshot.incognito || !snapshot.settings.remember
                ? 'pickerPersistenceTemporary'
                : 'pickerPersistenceSaved',
            )}
          </p>
          <div className="hotkeyHints">
            <button
              type="button"
              className="hotkeyHint"
              title={t('pickerChangeShortcut')}
              onClick={() => controller.openHotkeySettings()}
            >
              {snapshot.hotkey.split('+').map((key) => (
                <span className="key" key={key}>
                  {key}
                </span>
              ))}{' '}
              {t('pickerToggleOverlay')}
            </button>
            <span className="hotkeyHint hotkeyHint_static">
              <span className="key">↑</span>/<span className="key">↓</span> ·{' '}
              <span className="key">Q</span>/<span className="key">W</span>{' '}
              {t('pickerMoveSelection')}
            </span>
          </div>
        </div>

        <StatusToast snapshot={snapshot} controller={controller} />
      </div>

      {moreOpen && (
        <div
          ref={moreMenuRef}
          className="moreMenu"
          data-keep-highlight=""
          role="menu"
          onKeyDown={navigateMoreMenu}
          style={
            morePosition
              ? { left: morePosition.left, top: morePosition.top, visibility: 'visible' }
              : { left: 0, top: 0, visibility: 'hidden' }
          }
        >
          <button
            type="button"
            role="menuitem"
            className="moreMenu__item"
            disabled={!hasSelection}
            onClick={() => runAction('blur')}
          >
            <BlurIcon />
            {t('pickerBlurElement')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="moreMenu__item"
            disabled={!hasSelection}
            onClick={() => runAction('dim')}
          >
            <DimIcon />
            {t('pickerDimElement')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="moreMenu__item"
            disabled={!hasSelection}
            onClick={() => runAction('gray')}
          >
            <GrayIcon />
            {t('pickerGrayElement')}
          </button>
          {snapshot.settings.advanced && (
            <button
              type="button"
              role="menuitem"
              className="moreMenu__item"
              disabled={!hasSelection}
              onClick={(event) =>
                openCreateCss((event.currentTarget as HTMLElement).getBoundingClientRect())
              }
            >
              <CodeIcon />
              {t('pickerCustomCss')}
            </button>
          )}
        </div>
      )}

      {snapshot.marked && !snapshot.minimized && (
        <MiniToolbar
          marked={snapshot.marked}
          controller={controller}
          advanced={snapshot.settings.advanced}
          onCreateCss={(anchor) =>
            setPopover({ kind: 'create-css', selector: controller.draftSelector() ?? '', anchor })
          }
        />
      )}
      {snapshot.textEditRect && <TextEditor rect={snapshot.textEditRect} controller={controller} />}
      {popover && (
        <SelectorPopover state={popover} controller={controller} onClose={() => setPopover(null)} />
      )}
    </>
  )
}

function EditRow({
  edit,
  controller,
  onEdit,
}: {
  edit: RuntimeEdit
  controller: ElementController
  onEdit: (anchor: Rect) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const preview = (showOriginal: boolean) => controller.previewEdit(edit, showOriginal)
  const previewOnTouch = (showOriginal: boolean) => {
    if (matchMedia('(hover: none)').matches) preview(showOriginal)
  }

  const remove = () => {
    const row = rowRef.current
    if (!row || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      controller.deleteEdit(edit)
      return
    }
    const height = row.offsetHeight
    const animation = row.animate(
      [
        { height: `${height}px`, opacity: 1 },
        { height: '0px', opacity: 0 },
      ],
      { duration: 160, easing: 'cubic-bezier(.23, 1, .32, 1)' },
    )
    animation.onfinish = () => controller.deleteEdit(edit)
    animation.oncancel = () => controller.deleteEdit(edit)
  }

  return (
    <div className="editRow" role="listitem" ref={rowRef}>
      <span className="editRow__action" title={actionLabel(edit.action)}>
        <ActionIcon action={edit.action} />
      </span>
      <span className="editRow__selector" title={edit.selector}>
        {edit.action === 'text' && edit.text !== undefined ? edit.text : edit.selector}
      </span>
      <label className="editRow__remember" title={t('pickerRememberEdit')}>
        <input
          type="checkbox"
          checked={edit.permanent}
          onChange={(event) => controller.setEditPermanent(edit, event.target.checked)}
          aria-label={t('pickerRememberEdit')}
        />
      </label>
      <button
        type="button"
        className="editRow__btn editRow__preview"
        title={t('pickerPreviewOriginal')}
        aria-label={t('pickerPreviewOriginal')}
        onMouseEnter={() => preview(true)}
        onMouseLeave={() => preview(false)}
        onBlur={() => preview(false)}
        onPointerDown={() => previewOnTouch(true)}
        onPointerUp={() => previewOnTouch(false)}
        onPointerCancel={() => previewOnTouch(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            preview(true)
          }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            preview(false)
          }
        }}
      >
        <EyeIcon />
      </button>
      <button
        type="button"
        className="editRow__btn editRow__edit"
        title={t('pickerEditRule', [edit.selector])}
        aria-label={t('pickerEditRule', [edit.selector])}
        onClick={(event) => onEdit((event.currentTarget as HTMLElement).getBoundingClientRect())}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="editRow__btn editRow__delete"
        title={t('pickerDeleteRuleFor', [edit.selector])}
        aria-label={t('pickerDeleteRuleFor', [edit.selector])}
        onClick={remove}
      >
        <TrashIcon />
      </button>
    </div>
  )
}

export function mountOverlay(
  shadowRoot: ShadowRoot,
  controller: ElementController,
): { unmount: () => void } {
  const style = document.createElement('style')
  style.textContent = `${qdsShadowDomStyles}\n${contentCss}`
  shadowRoot.appendChild(style)
  const mountPoint = document.createElement('div')
  shadowRoot.appendChild(mountPoint)
  const root: Root = createRoot(mountPoint)
  root.render(<PickerPanel controller={controller} />)
  return { unmount: () => root.unmount() }
}
