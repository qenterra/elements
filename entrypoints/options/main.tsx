import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { browser } from 'wxt/browser'
import { hybridStorage } from '../../src/core/storage'

type Site = { domain: string; count: number; modified: number }
type SortMode = 'name' | 'date'

const SORT_KEY = 'siteListSort'

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

function usePageFx(): void {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const glow = document.getElementById('cursor_glow')
    if (!glow) return

    let targetX = innerWidth / 2
    let targetY = innerHeight / 2
    let glowX = targetX
    let glowY = targetY
    let frame: number | null = null

    const tick = () => {
      glowX += (targetX - glowX) * 0.07
      glowY += (targetY - glowY) * 0.07
      glow.style.transform = `translate(${glowX.toFixed(1)}px, ${glowY.toFixed(1)}px)`
      if (Math.abs(targetX - glowX) > 0.5 || Math.abs(targetY - glowY) > 0.5) frame = requestAnimationFrame(tick)
      else frame = null
    }
    const onMove = (event: MouseEvent) => {
      targetX = event.clientX
      targetY = event.clientY
      glow.style.opacity = '1'
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const onLeave = () => { glow.style.opacity = '0' }

    document.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)

    const cards = Array.from(document.querySelectorAll<HTMLElement>('.card'))
    const cleanups = cards.map((card) => {
      const onCardMove = (event: MouseEvent) => {
        const rect = card.getBoundingClientRect()
        const dx = (event.clientX - rect.left) / rect.width - 0.5
        const dy = (event.clientY - rect.top) / rect.height - 0.5
        card.style.transform = `rotateX(${(-dy * 1.4).toFixed(2)}deg) rotateY(${(dx * 1.4).toFixed(2)}deg)`
      }
      const onCardLeave = () => { card.style.transform = '' }
      card.addEventListener('mousemove', onCardMove)
      card.addEventListener('mouseleave', onCardLeave)
      return () => {
        card.removeEventListener('mousemove', onCardMove)
        card.removeEventListener('mouseleave', onCardLeave)
      }
    })

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])
}

function OptionsApp() {
  const [sites, setSites] = useState<Site[]>([])
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = localStorage.getItem(SORT_KEY)
    return saved === 'date' ? 'date' : 'name'
  })
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

  usePageFx()

  const reloadSites = useCallback(async () => setSites(await readSites()), [])
  useEffect(() => { void reloadSites() }, [reloadSites])
  useEffect(() => {
    document.title = t('extensionName')
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.error ? 5000 : 2500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const sortedSites = useMemo(() => [...sites].sort((left, right) => sortMode === 'date'
    ? right.modified - left.modified || left.domain.localeCompare(right.domain)
    : left.domain.localeCompare(right.domain)), [sites, sortMode])

  const deleteSite = async (domain: string) => {
    await hybridStorage.remove(`web:${domain}`)
    const meta = await hybridStorage.get<Record<string, number>>('webMeta', {})
    delete meta[domain]
    await hybridStorage.set('webMeta', meta)
    setToast({ message: t('optionsSiteDeleted', [domain]), error: false })
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
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const importSettings = async (file: File) => {
    if (file.type && file.type !== 'application/json') throw new Error('Invalid file type')
    const text = await file.text()
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) throw new Error('Incorrect version number in imported data')
    const result = await browser.runtime.sendMessage({ action: 'import_settings', data: text })
    if (result !== 'SUCCESS') throw new Error(String(result))
  }

  return <>
    <div className="bgFx" aria-hidden="true"><div className="bgFx__glow" id="cursor_glow" /></div>
    <main className="page">
      <section className="card pageHeader">
        <div className="pageHeader__icon"><Icon><path d="m18 16-4-4 4-4" /><path d="m6 8 4 4-4 4" /><path d="m14.5 4-5 16" /></Icon></div>
        <div><h1>{t('extensionName')}</h1><p className="pageHeader__tagline">{t('optionsTagline')}</p></div>
      </section>

      <section className="card">
        <p className="cardTitle"><SiteIcon /><span>{t('optionsSitesTitle')}</span><span className="sortSwitch" role="group" aria-label="Site sort order">
          <button type="button" className={`sortSwitch__btn${sortMode === 'name' ? ' isActive' : ''}`} onClick={() => { setSortMode('name'); localStorage.setItem(SORT_KEY, 'name') }} aria-pressed={sortMode === 'name'}>{t('optionsSitesSortName')}</button>
          <button type="button" className={`sortSwitch__btn${sortMode === 'date' ? ' isActive' : ''}`} onClick={() => { setSortMode('date'); localStorage.setItem(SORT_KEY, 'date') }} aria-pressed={sortMode === 'date'}>{t('optionsSitesSortDate')}</button>
        </span></p>
        <p className="cardDescription">{t('optionsSitesDescription')}</p>
        <div className="siteList"><div className="siteList__rows">
          {sortedSites.map((site) => <div className="siteRow" key={site.domain}>
            <a className="siteRow__domain" href={`https://${site.domain}`} target="_blank" rel="noopener nofollow">{site.domain}</a>
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
              setToast({ message: t('optionsImportSuccess'), error: false })
              await reloadSites()
            }).catch((error: unknown) => setToast({ message: error instanceof Error ? error.message : 'Error', error: true }))
          }} />
        </div>
      </section>

      <section className="card">
        <p className="cardTitle"><InfoIcon /><span>{t('optionsAboutTitle')}</span></p>
        <div className="about"><p><b>Elements</b><span className="version">v{browser.runtime.getManifest().version}</span><br />Made by Nikita Melnychenko (QenTerra).</p></div>
      </section>
    </main>
    {toast && <div className={`toast isVisible${toast.error ? ' isError' : ''}`} role="status"><span className="toast__icon">{toast.error ? '!' : '✓'}</span><span className="toast__text">{toast.message}</span></div>}
  </>
}

const root = document.getElementById('root')
if (!root) throw new Error('Options root is missing')
createRoot(root).render(<OptionsApp />)
