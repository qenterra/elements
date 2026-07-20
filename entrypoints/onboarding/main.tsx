import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { browser } from 'wxt/browser'
import { normalizeSettings } from '../../src/core/model'
import { resolveTheme, watchSystemTheme } from '../../src/core/theme'
import { hybridStorage } from '../../src/core/storage'

function t(key: string): string {
  const getMessage = (browser.i18n as unknown as { getMessage: (name: string) => string }).getMessage
  return getMessage.call(browser.i18n, key) || key
}

function OnboardingApp() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')

  useEffect(() => {
    document.title = t('onboardTitle')
    void hybridStorage.get<unknown>('settings', '{}').then((raw) => {
      try {
        setTheme(normalizeSettings(typeof raw === 'string' ? JSON.parse(raw) : raw).theme)
      } catch { /* keep system default */ }
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme)
    if (theme !== 'system') return
    return watchSystemTheme(() => {
      document.documentElement.dataset.theme = resolveTheme(theme)
    })
  }, [theme])

  return <main className="page">
    <header className="hero">
      <span className="hero__mark" aria-hidden="true">
        <span className="hero__bracket hero__bracket_tl" />
        <span className="hero__bracket hero__bracket_tr" />
        <span className="hero__bracket hero__bracket_bl" />
        <span className="hero__bracket hero__bracket_br" />
        <span className="hero__lines">
          <span className="hero__line" />
          <span className="hero__line" />
          <span className="hero__line" />
        </span>
      </span>
      <h1>{t('onboardTitle')}</h1>
      <p className="hero__tagline">{t('onboardTagline')}</p>
    </header>

    <section className="step">
      <span className="step__number" aria-hidden="true">1</span>
      <div>
        <p className="step__title">{t('onboardStep1Title')}</p>
        <p className="step__body">{t('onboardStep1Body')}</p>
      </div>
    </section>
    <section className="step">
      <span className="step__number" aria-hidden="true">2</span>
      <div>
        <p className="step__title">{t('onboardStep2Title')}</p>
        <p className="step__body">{t('onboardStep2Body')}</p>
      </div>
    </section>
    <section className="step">
      <span className="step__number" aria-hidden="true">3</span>
      <div>
        <p className="step__title">{t('onboardStep3Title')}</p>
        <p className="step__body">{t('onboardStep3Body')}</p>
      </div>
    </section>

    <section className="privacy">
      <p className="privacy__title">{t('onboardPrivacyTitle')}</p>
      <p className="privacy__body">{t('onboardPrivacyBody')}</p>
    </section>

    <div className="actions">
      <button type="button" className="primary" onClick={() => void browser.runtime.openOptionsPage()}>{t('onboardOpenOptions')}</button>
    </div>
  </main>
}

const root = document.getElementById('root')
if (!root) throw new Error('Onboarding root is missing')
createRoot(root).render(<OnboardingApp />)
