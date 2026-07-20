import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { browser } from 'wxt/browser'
import { BrandMark } from '../../src/components/BrandMark'
import {
  MAX_RADIUS,
  MIN_RADIUS,
  normalizePersistedEdits,
  normalizeSettings,
  DEFAULT_SETTINGS,
  type ExtensionSettings,
  type PersistedEdit,
  type ThemePreference,
} from '../../src/core/model'
import { resolveTheme, watchSystemTheme } from '../../src/core/theme'
import { hybridStorage } from '../../src/core/storage'

type Site = { domain: string; rules: PersistedEdit[]; modified: number; paused: boolean }
type SortMode = 'name' | 'date'
type ToastMessage = { id: number; message: string; error: boolean; undo?: () => void | Promise<void> }
type ImportReview = { text: string; sites: number; rules: number }

const SORT_KEY = 'siteListSort'
const DOCUMENTS_URL = 'https://github.com/QenTerra/elements/blob/master/'
const FEEDBACK_URL = 'https://github.com/QenTerra/elements/issues'
const SEARCH_THRESHOLD = 8

function documentUrl(path: string): string {
  return `${DOCUMENTS_URL}${path}`
}

function t(key: string, substitutions?: string | string[]): string {
  const getMessage = (browser.i18n as unknown as { getMessage: (name: string, substitutions?: string | string[]) => string }).getMessage
  return getMessage.call(browser.i18n, key, substitutions) || key
}

function Icon({ children }: { children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}

function SiteIcon() {
  return <Icon><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Icon>
}

function BackupIcon() {
  return <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Icon>
}

function InfoIcon() {
  return <Icon><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></Icon>
}

function SlidersIcon() {
  return <Icon><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></Icon>
}

function TrashIcon() {
  return <Icon><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Icon>
}

function ChevronIcon() {
  return <Icon><polyline points="9 18 15 12 9 6" /></Icon>
}

function PauseIcon() {
  return <Icon><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></Icon>
}

function RuleIcon({ action }: { action?: PersistedEdit['action'] }) {
  if (action === 'round') return <Icon><path d="M4 20v-6a10 10 0 0 1 10-10h6" /></Icon>
  if (action === 'text') return <Icon><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></Icon>
  if (action === 'blur') return <Icon><path d="M12 2.7s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.7 12 2.7z" /></Icon>
  if (action === 'dim') return <Icon><circle cx="12" cy="12" r="4" /><path d="M12 4v1M12 19v1M4 12h1M19 12h1M6.3 6.3l.7.7M17 17l.7.7M6.3 17.7l.7-.7M17 7l.7-.7" /></Icon>
  if (action === 'gray') return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" /></Icon>
  if (action === 'css') return <Icon><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></Icon>
  return <Icon><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" /></Icon>
}

function ruleLabel(action: PersistedEdit['action']): string {
  if (action === 'round') return t('pickerRoundedCorners')
  if (action === 'text') return t('pickerTextEdited')
  if (action === 'blur') return t('pickerBlurred')
  if (action === 'dim') return t('pickerDimmed')
  if (action === 'gray') return t('pickerGrayed')
  if (action === 'css') return t('pickerCustomCss')
  return t('pickerHidden')
}

function ToastNotice({ notice, onDismiss }: { notice: ToastMessage; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const enterFrame = requestAnimationFrame(() => setVisible(true))
    let exitTimer = 0
    const lifetime = notice.error ? 5000 : notice.undo ? 5000 : 2500
    const visibleTimer = window.setTimeout(() => {
      setVisible(false)
      exitTimer = window.setTimeout(() => onDismiss(notice.id), reduceMotion ? 0 : 180)
    }, lifetime)

    return () => {
      cancelAnimationFrame(enterFrame)
      window.clearTimeout(visibleTimer)
      window.clearTimeout(exitTimer)
    }
  }, [notice.error, notice.id, notice.undo, onDismiss])

  return <div
    className={`toast${visible ? ' isVisible' : ''}${notice.error ? ' isError' : ''}`}
    role={notice.error ? 'alert' : 'status'}
    aria-live={notice.error ? 'assertive' : 'polite'}
  >
    <span className="toast__icon">{notice.error ? '!' : '✓'}</span>
    <span className="toast__text">{notice.message}</span>
    {notice.undo && <button type="button" className="toast__undo" onClick={() => {
      void notice.undo?.()
      onDismiss(notice.id)
    }}>{t('optionsUndo')}</button>}
  </div>
}

function CodeHint() {
  const message = t('optionsBackupHint')
  const parts = message.split(/(<code>|<\/code>)/g)
  let inCode = false
  return <p className="cardDescription" id="backup_hint">
    {parts.map((part, index) => {
      if (part === '<code>') { inCode = true; return null }
      if (part === '</code>') { inCode = false; return null }
      return inCode ? <code key={index}>{part}</code> : <span key={index}>{part}</span>
    })}
  </p>
}

function formatDate(timestamp: number): string {
  return timestamp
    ? new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
}

async function readSites(): Promise<Site[]> {
  const [entries, rawMeta, rawPaused] = await Promise.all([
    hybridStorage.entries(),
    hybridStorage.get<unknown>('webMeta', {}),
    hybridStorage.get<unknown>('webPaused', '[]'),
  ])
  const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta as Record<string, unknown> : {}
  let paused: string[] = []
  try {
    const parsed: unknown = typeof rawPaused === 'string' ? JSON.parse(rawPaused) : rawPaused
    if (Array.isArray(parsed)) paused = parsed.filter((site): site is string => typeof site === 'string')
  } catch { /* corrupt pause list treated as empty */ }

  return entries.flatMap(([key, rawValue]) => {
    if (!key.startsWith('web:') || typeof rawValue !== 'string' || rawValue === '[]') return []
    let rules: PersistedEdit[] = []
    try {
      rules = normalizePersistedEdits(JSON.parse(rawValue))
    } catch {
      rules = []
    }
    if (!rules.length) return []
    const domain = key.slice('web:'.length)
    const modified = typeof meta[domain] === 'number' ? meta[domain] as number : 0
    return [{ domain, rules, modified, paused: paused.includes(domain) }]
  })
}

function SettingsCard({ settings, hotkey, onChange }: {
  settings: ExtensionSettings
  hotkey: string
  onChange: (next: Partial<ExtensionSettings>) => void
}) {
  const themes: Array<{ id: ThemePreference; label: string }> = [
    { id: 'system', label: t('themeSystem') },
    { id: 'light', label: t('themeLight') },
    { id: 'dark', label: t('themeDark') },
  ]

  return <section className="card">
    <p className="cardTitle"><SlidersIcon /><span>{t('optionsSettingsTitle')}</span></p>
    <div className="settingRow">
      <span className="settingRow__text">
        <span className="settingRow__label">{t('optionsTheme')}</span>
        <span className="settingRow__hint">{t('optionsThemeHint')}</span>
      </span>
      <span className="segment" role="group" aria-label={t('optionsTheme')}>
        {themes.map((theme) => <button
          key={theme.id}
          type="button"
          className={`segment__btn${settings.theme === theme.id ? ' isActive' : ''}`}
          aria-pressed={settings.theme === theme.id}
          onClick={() => onChange({ theme: theme.id })}
        >{theme.label}</button>)}
      </span>
    </div>
    <div className="settingRow">
      <span className="settingRow__text">
        <span className="settingRow__label">{t('pickerRememberDefault')}</span>
        <span className="settingRow__hint">{t('optionsRememberHint')}</span>
      </span>
      <button type="button" className="switch" role="switch" aria-checked={settings.remember} aria-label={t('pickerRememberDefault')} onClick={() => onChange({ remember: !settings.remember })}>
        <span className="switch__knob" />
      </button>
    </div>
    <div className="settingRow">
      <span className="settingRow__text">
        <span className="settingRow__label">{t('optionsRadius')}</span>
        <span className="settingRow__hint">{t('optionsRadiusHint')}</span>
      </span>
      <span className="radiusPreview" style={{ borderRadius: Math.min(13, settings.radius / 2 + 2) } as CSSProperties} aria-hidden="true" />
      <input
        className="settingRow__range"
        type="range"
        min={MIN_RADIUS}
        max={MAX_RADIUS}
        value={settings.radius}
        aria-label={t('optionsRadius')}
        onChange={(event) => onChange({ radius: Number(event.target.value) })}
      />
      <span className="settingRow__value">{settings.radius}px</span>
    </div>
    <div className="settingRow">
      <span className="settingRow__text">
        <span className="settingRow__label">{t('optionsAdvanced')}</span>
        <span className="settingRow__hint">{t('optionsAdvancedHint')}</span>
      </span>
      <button type="button" className="switch" role="switch" aria-checked={settings.advanced} aria-label={t('optionsAdvanced')} onClick={() => onChange({ advanced: !settings.advanced })}>
        <span className="switch__knob" />
      </button>
    </div>
    <div className="settingRow">
      <span className="settingRow__text">
        <span className="settingRow__label">{t('optionsShortcut')}</span>
        <span className="settingRow__hint">{hotkey}</span>
      </span>
      <button type="button" className="secondary" onClick={() => void browser.runtime.sendMessage({ action: 'goto_hotkey_settings' })}>{t('optionsShortcutChange')}</button>
    </div>
  </section>
}

function OptionsApp() {
  const [sites, setSites] = useState<Site[]>([])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState<ExtensionSettings>({ ...DEFAULT_SETTINGS })
  const [hotkey, setHotkey] = useState('')
  const [busy, setBusy] = useState<'import' | 'export' | null>(null)
  const [review, setReview] = useState<ImportReview | null>(null)
  const [reviewMode, setReviewMode] = useState<'replace' | 'merge'>('merge')
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = localStorage.getItem(SORT_KEY)
    return saved === 'date' ? 'date' : 'name'
  })
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const toastId = useRef(0)
  const importInput = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, error = false, undo?: () => void | Promise<void>) => {
    toastId.current += 1
    setToast({ id: toastId.current, message, error, undo })
  }, [])
  const dismissToast = useCallback((id: number) => {
    setToast((current) => current?.id === id ? null : current)
  }, [])

  const reloadSites = useCallback(async () => setSites(await readSites()), [])
  useEffect(() => { void reloadSites() }, [reloadSites])
  useEffect(() => {
    document.title = t('extensionName')
  }, [])

  // Theme: apply the stored preference and track the system scheme.
  useEffect(() => {
    void hybridStorage.get<unknown>('settings', '{}').then((raw) => {
      let parsed: unknown = {}
      try {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch { /* keep defaults */ }
      setSettings(normalizeSettings(parsed))
    })
    void browser.commands.getAll().then((commands) => {
      setHotkey(commands[0]?.shortcut || t('pickerNoShortcut'))
    }).catch(() => setHotkey(t('pickerNoShortcut')))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(settings.theme)
    if (settings.theme !== 'system') return
    return watchSystemTheme(() => {
      document.documentElement.dataset.theme = resolveTheme(settings.theme)
    })
  }, [settings.theme])

  // Refresh the list when another tab commits edits.
  useEffect(() => {
    let timer = 0
    const listener = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void reloadSites(), 300)
    }
    browser.storage.onChanged.addListener(listener)
    return () => {
      window.clearTimeout(timer)
      browser.storage.onChanged.removeListener(listener)
    }
  }, [reloadSites])

  const updateSettings = useCallback((next: Partial<ExtensionSettings>) => {
    setSettings((current) => {
      const merged = { ...current, ...next }
      void hybridStorage.set('settings', JSON.stringify(merged))
      return merged
    })
  }, [])

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matching = query ? sites.filter((site) => site.domain.toLowerCase().includes(query)) : sites
    return [...matching].sort((left, right) => sortMode === 'date'
      ? right.modified - left.modified || left.domain.localeCompare(right.domain)
      : left.domain.localeCompare(right.domain))
  }, [sites, sortMode, search])
  const siteAnimationOrder = useMemo(() => new Map(sites.map((site, index) => [site.domain, index])), [sites])

  const changeSortMode = (nextMode: SortMode, animate: boolean) => {
    if (nextMode === sortMode) return
    const previousPositions = new Map<string, number>()
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll<HTMLElement>('.siteRow[data-domain]').forEach((row) => {
        if (row.dataset.domain) previousPositions.set(row.dataset.domain, row.getBoundingClientRect().top)
      })
    }

    setSortMode(nextMode)
    localStorage.setItem(SORT_KEY, nextMode)
    if (!previousPositions.size) return

    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('.siteRow[data-domain]').forEach((row) => {
        if (!row.dataset.domain) return
        const previousTop = previousPositions.get(row.dataset.domain)
        if (previousTop === undefined) return
        const offset = previousTop - row.getBoundingClientRect().top
        if (Math.abs(offset) < 1) return
        row.getAnimations().forEach((animation) => animation.cancel())
        row.animate([
          { transform: `translateY(${offset}px)` },
          { transform: 'translateY(0)' },
        ], {
          duration: 180,
          easing: 'cubic-bezier(.23, 1, .32, 1)',
        })
      })
    })
  }

  const toggleExpanded = (domain: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  const deleteSite = async (domain: string) => {
    const payload = await hybridStorage.get<unknown>(`web:${domain}`, null)
    const meta = await hybridStorage.get<Record<string, number>>('webMeta', {})
    const previousTimestamp = meta[domain]
    await hybridStorage.remove(`web:${domain}`)
    delete meta[domain]
    await hybridStorage.set('webMeta', meta)
    showToast(t('optionsSiteDeleted', [domain]), false, async () => {
      if (payload !== null) await hybridStorage.set(`web:${domain}`, payload)
      const currentMeta = await hybridStorage.get<Record<string, number>>('webMeta', {})
      if (previousTimestamp !== undefined) currentMeta[domain] = previousTimestamp
      await hybridStorage.set('webMeta', currentMeta)
      await reloadSites()
    })
    await reloadSites()
  }

  const deleteRule = async (domain: string, rule: PersistedEdit) => {
    const previous = await hybridStorage.get<unknown>(`web:${domain}`, '[]')
    const site = sites.find((candidate) => candidate.domain === domain)
    if (!site) return
    const remaining = site.rules.filter((candidate) => !(candidate.selector === rule.selector && candidate.action === rule.action))
    if (remaining.length) await hybridStorage.set(`web:${domain}`, JSON.stringify(remaining))
    else {
      await hybridStorage.remove(`web:${domain}`)
      const meta = await hybridStorage.get<Record<string, number>>('webMeta', {})
      delete meta[domain]
      await hybridStorage.set('webMeta', meta)
    }
    showToast(t('optionsRuleDeleted'), false, async () => {
      await hybridStorage.set(`web:${domain}`, previous)
      await reloadSites()
    })
    await reloadSites()
  }

  const togglePauseSite = async (domain: string, paused: boolean) => {
    const raw = await hybridStorage.get<unknown>('webPaused', '[]')
    let list: string[] = []
    try {
      const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(parsed)) list = parsed.filter((site): site is string => typeof site === 'string')
    } catch { /* treat as empty */ }
    const next = new Set(list)
    if (paused) next.add(domain)
    else next.delete(domain)
    if (next.size) await hybridStorage.set('webPaused', JSON.stringify([...next]))
    else await hybridStorage.remove('webPaused')
    await reloadSites()
  }

  const exportSettings = async () => {
    if (busy) return
    setBusy('export')
    try {
      const entries = (await hybridStorage.entries()).filter(([, value]) => value !== '[]')
      const data = JSON.stringify({ ...Object.fromEntries(entries), version: 1 }, null, 2)
      const link = document.createElement('a')
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
      link.href = url
      link.download = `Elements export ${new Date().toLocaleString('sv-SE').replace(/[^0-9\- ]/g, '-')}.json`
      link.click()
      showToast(t('optionsExportSuccess'))
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } finally {
      setBusy(null)
    }
  }

  const startImport = async (file: File) => {
    try {
      if (file.type && file.type !== 'application/json') throw new Error(t('optionsImportInvalidType'))
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error(t('optionsImportInvalidJson'))
      }
      if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) throw new Error(t('optionsImportInvalidVersion'))
      const webKeys = Object.keys(parsed as Record<string, unknown>).filter((key) => key.startsWith('web:'))
      let ruleCount = 0
      for (const key of webKeys) {
        try {
          const rules: unknown = JSON.parse(String((parsed as Record<string, unknown>)[key]))
          if (Array.isArray(rules)) ruleCount += rules.length
        } catch { /* count what parses */ }
      }
      setReviewMode('merge')
      setReview({ text, sites: webKeys.length, rules: ruleCount })
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('optionsErrorGeneric'), true)
    }
  }

  const confirmImport = async () => {
    if (!review || busy) return
    setBusy('import')
    try {
      const snapshotEntries = (await hybridStorage.entries())
        .filter(([key]) => /^settings$|^web:|^webMeta$|^webPaused$/.test(key))
      const snapshot = JSON.stringify({ ...Object.fromEntries(snapshotEntries), version: 1 })
      const result = await browser.runtime.sendMessage({ action: 'import_settings', data: review.text, mode: reviewMode })
      if (result !== 'SUCCESS') throw new Error(t('optionsImportFailed'))
      setReview(null)
      showToast(t('optionsImportSuccess'), false, async () => {
        await browser.runtime.sendMessage({ action: 'import_settings', data: snapshot, mode: 'replace' })
        await reloadSites()
      })
      await reloadSites()
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('optionsErrorGeneric'), true)
    } finally {
      setBusy(null)
    }
  }

  return <>
    <main className="page">
      <section className="card pageHeader">
        <div className="pageHeader__icon"><BrandMark width="24" height="24" /></div>
        <div><h1>{t('extensionName')}</h1><p className="pageHeader__tagline">{t('optionsTagline')}</p></div>
      </section>

      <section className="card">
        <p className="cardTitle"><SiteIcon /><span>{t('optionsSitesTitle')}</span><span className="sortSwitch" role="group" aria-label={t('optionsSortOrder')}>
          <button type="button" className={`sortSwitch__btn${sortMode === 'name' ? ' isActive' : ''}`} onClick={(event) => changeSortMode('name', event.detail > 0)} aria-pressed={sortMode === 'name'}>{t('optionsSitesSortName')}</button>
          <button type="button" className={`sortSwitch__btn${sortMode === 'date' ? ' isActive' : ''}`} onClick={(event) => changeSortMode('date', event.detail > 0)} aria-pressed={sortMode === 'date'}>{t('optionsSitesSortDate')}</button>
        </span></p>
        <p className="cardDescription">{t('optionsSitesDescription')}</p>
        {sites.length >= SEARCH_THRESHOLD && <input
          className="search"
          type="search"
          value={search}
          placeholder={t('optionsSearchPlaceholder')}
          aria-label={t('optionsSearchPlaceholder')}
          onChange={(event) => setSearch(event.target.value)}
        />}
        <div className="siteList"><div className="siteList__rows">
          {filteredSites.map((site) => <div
            className={`siteRow${expanded.has(site.domain) ? ' isExpanded' : ''}${site.paused ? ' isPaused' : ''}`}
            data-domain={site.domain}
            style={{ '--row-index': Math.min(siteAnimationOrder.get(site.domain) ?? 0, 6) } as CSSProperties}
            key={site.domain}
          >
            <div className="siteRow__head">
              <button type="button" className="siteRow__expand" aria-expanded={expanded.has(site.domain)} aria-label={t('optionsSiteRules', [site.domain])} onClick={() => toggleExpanded(site.domain)}><ChevronIcon /></button>
              <a className="siteRow__domain" href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer nofollow">{site.domain}</a>
              <span className="siteRow__count">{t('optionsSitesCount', [String(site.rules.length)])}</span>
              <span className="siteRow__date">{formatDate(site.modified)}</span>
              <button type="button" className={`siteRow__btn${site.paused ? ' isActive' : ''}`} title={t(site.paused ? 'optionsSiteResume' : 'optionsSitePause')} aria-label={t(site.paused ? 'optionsSiteResume' : 'optionsSitePause')} aria-pressed={site.paused} onClick={() => void togglePauseSite(site.domain, !site.paused)}><PauseIcon /></button>
              <button type="button" className="siteRow__btn siteRow__delete" title={t('optionsSiteDeleteTitle')} aria-label={t('optionsSiteDeleteFor', [site.domain])} onClick={() => void deleteSite(site.domain)}><TrashIcon /></button>
            </div>
            <div className="siteRules"><div className="siteRules__inner">
              <div className="siteRules__list">
                {site.rules.map((rule) => <div className="ruleRow" key={`${rule.action ?? 'hide'}:${rule.selector}`}>
                  <span className="ruleRow__icon" title={ruleLabel(rule.action)}><RuleIcon action={rule.action} /></span>
                  <span className="ruleRow__selector" title={rule.selector}>{rule.action === 'text' && rule.text !== undefined ? `${rule.selector} → “${rule.text}”` : rule.selector}</span>
                  {rule.action === 'round' && rule.value !== undefined && <span className="ruleRow__value">{rule.value}px</span>}
                  <button type="button" className="ruleRow__delete" title={t('pickerDeleteRule')} aria-label={t('optionsRuleDeleteFor', [rule.selector])} onClick={() => void deleteRule(site.domain, rule)}><TrashIcon /></button>
                </div>)}
              </div>
            </div></div>
          </div>)}
          {!filteredSites.length && <p className="siteList__empty">
            <span className="bracket" aria-hidden="true" />
            {search ? t('optionsSearchEmpty') : t('optionsSitesEmpty')}
            <span className="bracket bracket_r" aria-hidden="true" />
          </p>}
        </div></div>
      </section>

      <SettingsCard settings={settings} hotkey={hotkey} onChange={updateSettings} />

      <section className="card">
        <p className="cardTitle"><BackupIcon /><span>{t('optionsBackupTitle')}</span></p>
        <CodeHint />
        <div className="actions">
          <button type="button" className="primary" disabled={busy !== null} onClick={() => void exportSettings()}>
            {busy === 'export' && <span className="spinner" aria-hidden="true" />}
            {t('optionsExportButton')}
          </button>
          <button type="button" className="secondary" disabled={busy !== null} onClick={() => importInput.current?.click()}>
            {busy === 'import' && <span className="spinner" aria-hidden="true" />}
            {t('optionsImportButton')}
          </button>
          <input ref={importInput} type="file" accept="application/json" hidden onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void startImport(file)
          }} />
        </div>
      </section>

      <section className="card">
        <p className="cardTitle"><InfoIcon /><span>{t('optionsAboutTitle')}</span></p>
        <div className="about">
          <p><b>Elements</b><span className="version">v{browser.runtime.getManifest().version}</span><br />Made by <a href="https://github.com/QenTerra" target="_blank" rel="noopener noreferrer">Nikita Melnychenko (QenTerra)</a>.</p>
          <div className="about__documents">
            <nav className="about__links" aria-label={t('optionsLegalDocuments')}>
              <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">{t('optionsFeedback')}</a>
              <a href={documentUrl('LICENSE')} target="_blank" rel="noopener noreferrer">{t('optionsLicense')}</a>
              <a href={documentUrl('PRIVACY.md')} target="_blank" rel="noopener noreferrer">{t('optionsPrivacy')}</a>
              <a href={documentUrl('TERMS_OF_USE.md')} target="_blank" rel="noopener noreferrer">{t('optionsTerms')}</a>
              <a href={documentUrl('SECURITY.md')} target="_blank" rel="noopener noreferrer">{t('optionsSecurity')}</a>
              <a href={documentUrl('THIRD_PARTY_NOTICES.md')} target="_blank" rel="noopener noreferrer">{t('optionsNotices')}</a>
            </nav>
          </div>
        </div>
      </section>
    </main>
    {review && <div className="modalOverlay" role="presentation" onKeyDown={(event) => { if (event.key === 'Escape') setReview(null) }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t('optionsImportReviewTitle')}>
        <p className="modal__title">{t('optionsImportReviewTitle')}</p>
        <p className="modal__summary">{t('optionsImportSummary', [String(review.sites), String(review.rules)])}</p>
        <button type="button" className={`modal__choice${reviewMode === 'merge' ? ' isSelected' : ''}`} aria-pressed={reviewMode === 'merge'} onClick={() => setReviewMode('merge')}>
          <span>
            <span className="modal__choiceLabel">{t('optionsImportMerge')}</span>
            <span className="modal__choiceHint">{t('optionsImportMergeHint')}</span>
          </span>
        </button>
        <button type="button" className={`modal__choice${reviewMode === 'replace' ? ' isSelected' : ''}`} aria-pressed={reviewMode === 'replace'} onClick={() => setReviewMode('replace')}>
          <span>
            <span className="modal__choiceLabel">{t('optionsImportReplace')}</span>
            <span className="modal__choiceHint">{t('optionsImportReplaceHint')}</span>
          </span>
        </button>
        <div className="modal__actions">
          <button type="button" className="secondary" onClick={() => setReview(null)}>{t('optionsImportCancel')}</button>
          <button type="button" className="primary" autoFocus disabled={busy !== null} onClick={() => void confirmImport()}>
            {busy === 'import' && <span className="spinner" aria-hidden="true" />}
            {t('optionsImportConfirm')}
          </button>
        </div>
      </div>
    </div>}
    {toast && <ToastNotice key={toast.id} notice={toast} onDismiss={dismissToast} />}
  </>
}

const root = document.getElementById('root')
if (!root) throw new Error('Options root is missing')
createRoot(root).render(<OptionsApp />)
