import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { browser } from 'wxt/browser'
import { DEFAULT_SETTINGS, normalizeSettings, type ThemePreference } from '../../src/core/model'
import { PROTOCOL_VERSION } from '../../src/core/protocol'
import { resolveTheme, watchSystemTheme } from '../../src/core/theme'
import { sendProtocolMessage } from '../../src/core/transport'

function t(key: string): string {
  const getMessage = (browser.i18n as unknown as { getMessage: (name: string) => string })
    .getMessage
  return getMessage.call(browser.i18n, key) || key
}

function OnboardingApp({ theme }: { theme: ThemePreference }) {
  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(theme)
    if (theme !== 'system') return
    return watchSystemTheme(() => {
      document.documentElement.dataset.theme = resolveTheme(theme)
    })
  }, [theme])

  return (
    <main className="page">
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
        <span className="step__number" aria-hidden="true">
          1
        </span>
        <div>
          <p className="step__title">{t('onboardStep1Title')}</p>
          <p className="step__body">{t('onboardStep1Body')}</p>
        </div>
      </section>
      <section className="step">
        <span className="step__number" aria-hidden="true">
          2
        </span>
        <div>
          <p className="step__title">{t('onboardStep2Title')}</p>
          <p className="step__body">{t('onboardStep2Body')}</p>
        </div>
      </section>
      <section className="step">
        <span className="step__number" aria-hidden="true">
          3
        </span>
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
        <button
          type="button"
          className="primary"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          {t('onboardOpenOptions')}
        </button>
      </div>
    </main>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Onboarding root is missing')

async function bootstrapOnboarding(container: HTMLElement): Promise<void> {
  document.title = t('onboardTitle')
  document.documentElement.lang = browser.i18n.getUILanguage().split('-')[0] || 'en'
  const result = await sendProtocolMessage({
    v: PROTOCOL_VERSION,
    type: 'settings.get',
  })
  const theme = result.ok ? normalizeSettings(result.data).theme : DEFAULT_SETTINGS.theme
  document.documentElement.dataset.theme = resolveTheme(theme)
  createRoot(container).render(<OnboardingApp theme={theme} />)
}

void bootstrapOnboarding(root)
