import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { browser } from 'wxt/browser'
import { BrandMark } from '../../src/components/BrandMark'
import { hybridStorage } from '../../src/core/storage'

type Site = { domain: string; count: number; modified: number }
type SortMode = 'name' | 'date'
type ToastMessage = { id: number; message: string; error: boolean }

const SORT_KEY = 'siteListSort'
const DOCUMENTS_URL = 'https://github.com/QenTerra/elements/blob/master/'

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

function ToastNotice({ notice, onDismiss }: { notice: ToastMessage; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const enterFrame = requestAnimationFrame(() => setVisible(true))
    let exitTimer = 0
    const visibleTimer = window.setTimeout(() => {
      setVisible(false)
      exitTimer = window.setTimeout(() => onDismiss(notice.id), reduceMotion ? 0 : 180)
    }, notice.error ? 5000 : 2500)

    return () => {
      cancelAnimationFrame(enterFrame)
      window.clearTimeout(visibleTimer)
      window.clearTimeout(exitTimer)
    }
  }, [notice.error, notice.id, onDismiss])

  return <div
    className={`toast${visible ? ' isVisible' : ''}${notice.error ? ' isError' : ''}`}
    role={notice.error ? 'alert' : 'status'}
    aria-live={notice.error ? 'assertive' : 'polite'}
  >
    <span className="toast__icon">{notice.error ? '!' : '✓'}</span>
    <span className="toast__text">{notice.message}</span>
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
  const [entries, rawMeta] = await Promise.all([
    hybridStorage.entries(),
    hybridStorage.get<unknown>('webMeta', {}),
  ])
  const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta as Record<string, unknown> : {}

  return entries.flatMap(([key, rawValue]) => {
    if (!key.startsWith('web:') || typeof rawValue !== 'string' || rawValue === '[]') return []
    let count = 0
    try {
      const parsed: unknown = JSON.parse(rawValue)
      count = Array.isArray(parsed) ? parsed.length : Number.NaN
    } catch {
      count = Number.NaN
    }
    if (count === 0) return []
    const domain = key.slice('web:'.length)
    const modified = typeof meta[domain] === 'number' ? meta[domain] as number : 0
    return [{ domain, count, modified }]
  })
}

function OptionsApp() {
  const [sites, setSites] = useState<Site[]>([])
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = localStorage.getItem(SORT_KEY)
    return saved === 'date' ? 'date' : 'name'
  })
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const toastId = useRef(0)
  const importInput = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, error = false) => {
    toastId.current += 1
    setToast({ id: toastId.current, message, error })
  }, [])
  const dismissToast = useCallback((id: number) => {
    setToast((current) => current?.id === id ? null : current)
  }, [])

  const reloadSites = useCallback(async () => setSites(await readSites()), [])
  useEffect(() => { void reloadSites() }, [reloadSites])
  useEffect(() => {
    document.title = t('extensionName')
  }, [])
  const sortedSites = useMemo(() => [...sites].sort((left, right) => sortMode === 'date'
    ? right.modified - left.modified || left.domain.localeCompare(right.domain)
    : left.domain.localeCompare(right.domain)), [sites, sortMode])
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

  const deleteSite = async (domain: string) => {
    await hybridStorage.remove(`web:${domain}`)
    const meta = await hybridStorage.get<Record<string, number>>('webMeta', {})
    delete meta[domain]
    await hybridStorage.set('webMeta', meta)
    showToast(t('optionsSiteDeleted', [domain]))
    await reloadSites()
  }

  const exportSettings = async () => {
    const entries = (await hybridStorage.entries()).filter(([, value]) => value !== '[]')
    const data = JSON.stringify({ ...Object.fromEntries(entries), version: 1 }, null, 2)
    const link = document.createElement('a')
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    link.href = url
    link.download = `Elements export ${new Date().toLocaleString('sv-SE').replace(/[^0-9\- ]/g, '-')}.json`
    link.click()
    showToast(t('optionsExportSuccess'))
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const importSettings = async (file: File) => {
    if (file.type && file.type !== 'application/json') throw new Error(t('optionsImportInvalidType'))
    const text = await file.text()
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) throw new Error(t('optionsImportInvalidVersion'))
    const result = await browser.runtime.sendMessage({ action: 'import_settings', data: text })
    if (result !== 'SUCCESS') throw new Error(t('optionsImportFailed'))
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
        <div className="siteList"><div className="siteList__rows">
          {sortedSites.map((site) => <div className="siteRow" data-domain={site.domain} style={{ '--row-index': Math.min(siteAnimationOrder.get(site.domain) ?? 0, 6) } as CSSProperties} key={site.domain}>
            <a className="siteRow__domain" href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer nofollow">{site.domain}</a>
            <span className="siteRow__count">{t('optionsSitesCount', [String(site.count || '?')])}</span>
            <span className="siteRow__date">{formatDate(site.modified)}</span>
            <button type="button" className="siteRow__delete" title={t('optionsSiteDeleteTitle')} onClick={() => void deleteSite(site.domain)}><Icon><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Icon></button>
          </div>)}
          {!sortedSites.length && <p className="siteList__empty">{t('optionsSitesEmpty')}</p>}
        </div></div>
      </section>

      <section className="card">
        <p className="cardTitle"><BackupIcon /><span>{t('optionsBackupTitle')}</span></p>
        <CodeHint />
        <div className="actions">
          <input type="button" value={t('optionsExportButton')} onClick={() => void exportSettings()} />
          <input type="button" className="secondary" value={t('optionsImportButton')} onClick={() => importInput.current?.click()} />
          <input ref={importInput} type="file" accept="application/json" hidden onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void importSettings(file).then(async () => {
              showToast(t('optionsImportSuccess'))
              await reloadSites()
            }).catch((error: unknown) => showToast(error instanceof Error ? error.message : t('optionsErrorGeneric'), true))
          }} />
        </div>
      </section>

      <section className="card">
        <p className="cardTitle"><InfoIcon /><span>{t('optionsAboutTitle')}</span></p>
        <div className="about">
          <p><b>Elements</b><span className="version">v{browser.runtime.getManifest().version}</span><br />Made by <a href="https://github.com/QenTerra" target="_blank" rel="noopener noreferrer">Nikita Melnychenko (QenTerra)</a>.</p>
          <div className="about__documents">
            <nav className="about__links" aria-label={t('optionsLegalDocuments')}>
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
    {toast && <ToastNotice key={toast.id} notice={toast} onDismiss={dismissToast} />}
  </>
}

const root = document.getElementById('root')
if (!root) throw new Error('Options root is missing')
createRoot(root).render(<OptionsApp />)
