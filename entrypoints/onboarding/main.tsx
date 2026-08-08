import { useEffect, useReducer, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { browser } from 'wxt/browser'
import {
  initialGuidedTrialState,
  reduceGuidedTrial,
  type GuidedTrialAction,
} from '../../src/onboarding/guided-trial'
import { shortcutKeycaps, type ShortcutPlatform } from '../../src/onboarding/shortcut'
import { DEFAULT_SETTINGS, normalizeSettings, type ThemePreference } from '../../src/core/model'
import { PROTOCOL_VERSION } from '../../src/core/protocol'
import { resolveTheme, watchSystemTheme } from '../../src/core/theme'
import { sendProtocolMessage } from '../../src/core/transport'

function t(key: string): string {
  const getMessage = (browser.i18n as unknown as { getMessage: (name: string) => string })
    .getMessage
  return getMessage.call(browser.i18n, key) || key
}

function shortcutPlatform(os: string | undefined): ShortcutPlatform {
  if (os === 'mac') return 'mac'
  if (os === 'win') return 'windows'
  if (os === 'cros') return 'cros'
  if (os === 'linux') return 'linux'
  return undefined
}

function ShortcutKeycaps({ shortcut, platform }: { shortcut: string; platform: ShortcutPlatform }) {
  const keycaps = shortcutKeycaps(shortcut, platform)
  if (!keycaps.length) return <span className="shortcut__empty">{t('onboardNoShortcut')}</span>

  return (
    <span className="shortcut__keys" aria-label={shortcut}>
      {keycaps.map((key) => (
        <kbd className="qds-keycap" key={key}>
          {key}
        </kbd>
      ))}
    </span>
  )
}

function trialStatusKey(action: GuidedTrialAction | null) {
  switch (action) {
    case 'hide':
      return 'onboardTrialHidden'
    case 'text':
      return 'onboardTrialTextChanged'
    case 'round':
      return 'onboardTrialRounded'
    default:
      return 'onboardTrialSelected'
  }
}

function GuidedTrial({ startNonce }: { startNonce: number }) {
  const [trial, dispatch] = useReducer(reduceGuidedTrial, initialGuidedTrialState)
  const targetRef = useRef<HTMLButtonElement>(null)
  const status = trial.selected ? trialStatusKey(trial.action) : 'onboardTrialIdle'

  useEffect(() => {
    if (!startNonce) return
    dispatch({ type: 'select' })
    const target = targetRef.current
    if (!target) return
    target.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
    target.focus()
  }, [startNonce])

  return (
    <section className="guided-trial qds-group" aria-labelledby="guided-trial-title">
      <div>
        <p className="section-eyebrow">{t('onboardTrialTemporary')}</p>
        <h2 id="guided-trial-title">{t('onboardTrialTitle')}</h2>
        <p>{t('onboardTrialBody')}</p>
      </div>
      <div
        className={`trial-canvas${trial.selected ? ' is-selected' : ''}`}
        data-action={trial.action ?? ''}
      >
        <button
          type="button"
          className="trial-target"
          ref={targetRef}
          aria-pressed={trial.selected}
          onClick={() => dispatch({ type: 'select' })}
        >
          <span>{t('onboardTrialSelect')}</span>
          <strong>{trial.action === 'text' ? t('onboardTrialTextChanged') : 'Elements'}</strong>
        </button>
      </div>
      <div className="trial-actions" aria-label={t('onboardTrialTitle')}>
        <button
          type="button"
          className="qds-button qds-button--secondary"
          disabled={!trial.selected}
          onClick={() => dispatch({ type: 'hide' })}
        >
          {t('onboardTrialHide')}
        </button>
        <button
          type="button"
          className="qds-button qds-button--secondary"
          disabled={!trial.selected}
          onClick={() => dispatch({ type: 'text' })}
        >
          {t('onboardTrialText')}
        </button>
        <button
          type="button"
          className="qds-button qds-button--secondary"
          disabled={!trial.selected}
          onClick={() => dispatch({ type: 'round' })}
        >
          {t('onboardTrialRound')}
        </button>
        <button
          type="button"
          className="qds-button qds-button--quiet"
          onClick={() => dispatch({ type: 'reset' })}
        >
          {t('onboardTrialReset')}
        </button>
      </div>
      <p className="trial-status" aria-live="polite">
        {t(status)}
      </p>
    </section>
  )
}

function OnboardingApp({
  theme,
  shortcut,
  platform,
}: {
  theme: ThemePreference
  shortcut: string
  platform: ShortcutPlatform
}) {
  const [started, setStarted] = useState(false)
  const [trialStartNonce, setTrialStartNonce] = useState(0)
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
        <div className="hero__actions">
          <button
            type="button"
            className="qds-button qds-button--primary"
            data-testid="start-editing"
            onClick={() => {
              setStarted(true)
              setTrialStartNonce((nonce) => nonce + 1)
            }}
          >
            {t('onboardStartEditing')}
          </button>
          <p className="hero__hint">{t('onboardStartEditingHint')}</p>
        </div>
        <div className="shortcut" aria-label={t('onboardShortcutLabel')}>
          <span>{t('onboardShortcutLabel')}</span>
          <ShortcutKeycaps shortcut={shortcut} platform={platform} />
        </div>
        {started ? (
          <div className="ready" data-testid="onboarding-ready" role="status">
            <strong>{t('onboardReadyTitle')}</strong>
            <span>{t('onboardReadyBody')}</span>
          </div>
        ) : null}
      </header>

      <section className="steps" aria-label={t('onboardTitle')}>
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
      </section>

      <GuidedTrial startNonce={trialStartNonce} />

      <section className="privacy">
        <p className="privacy__title">{t('onboardPrivacyTitle')}</p>
        <p className="privacy__body">{t('onboardPrivacyBody')}</p>
      </section>

      <div className="actions">
        <button
          type="button"
          className="qds-button qds-button--quiet"
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
  const [result, shortcutResult, platformResult] = await Promise.all([
    sendProtocolMessage({
      v: PROTOCOL_VERSION,
      type: 'settings.get',
    }),
    sendProtocolMessage({
      v: PROTOCOL_VERSION,
      type: 'shortcut.get',
    }),
    browser.runtime.getPlatformInfo().catch(() => undefined),
  ])
  const theme = result.ok ? normalizeSettings(result.data).theme : DEFAULT_SETTINGS.theme
  const shortcut = shortcutResult.ok ? shortcutResult.data : ''
  const platform = shortcutPlatform(platformResult?.os)
  document.documentElement.dataset.theme = resolveTheme(theme)
  createRoot(container).render(
    <OnboardingApp theme={theme} shortcut={shortcut} platform={platform} />,
  )
}

void bootstrapOnboarding(root)
