import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assignedShortcut } from '../src/core/shortcut'
import { initialGuidedTrialState, reduceGuidedTrial } from '../src/onboarding/guided-trial'
import { shortcutKeycaps } from '../src/onboarding/shortcut'

const projectRoot = resolve(import.meta.dirname, '..')
const onboardingPath = resolve(projectRoot, 'entrypoints/onboarding/main.tsx')
const onboardingHtmlPath = resolve(projectRoot, 'entrypoints/onboarding.html')
const sitePath = resolve(projectRoot, 'site/index.html')
const siteAdapterPath = resolve(projectRoot, 'site/qds-web.css')
const iconVerifierPath = resolve(projectRoot, 'scripts/verify-icons.mjs')

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

function messages(locale: 'en' | 'ru'): Record<string, { message: string }> {
  return JSON.parse(
    source(resolve(projectRoot, `public/_locales/${locale}/messages.json`)),
  ) as Record<string, { message: string }>
}

describe('onboarding redesign', () => {
  it('puts the safe Start editing call to action before the instruction wall', () => {
    const onboarding = source(onboardingPath)
    const startEditing = onboarding.indexOf("t('onboardStartEditing')")
    const steps = onboarding.indexOf('<section className="steps"')

    expect(startEditing).toBeGreaterThan(-1)
    expect(steps).toBeGreaterThan(startEditing)
    expect(onboarding).toContain('data-testid="start-editing"')
    expect(onboarding).toContain('data-testid="onboarding-ready"')
    expect(onboarding).toContain('scrollIntoView')
    expect(onboarding).toContain('.focus()')
    expect(onboarding).toContain("dispatch({ type: 'select' })")
  })

  it('keeps an unassigned command raw through background and localizes it only in onboarding', () => {
    const onboarding = source(onboardingPath)
    const background = source(resolve(projectRoot, 'entrypoints/background.ts'))

    expect(onboarding).toContain("type: 'shortcut.get'")
    expect(onboarding).toContain('shortcutKeycaps(shortcut, platform)')
    expect(onboarding).toContain("t('onboardNoShortcut')")
    expect(background).toContain('return ok(await getAssignedShortcut())')
    expect(assignedShortcut([])).toBe('')
    expect(shortcutKeycaps(assignedShortcut([]), 'mac')).toEqual([])
  })

  it('canonicalizes command keycaps for macOS and non-macOS shortcuts', () => {
    expect(shortcutKeycaps('Shift+Command+Alt+MacCtrl+X', 'mac')).toEqual(['⌘', '⌃', '⌥', '⇧', 'X'])
    expect(shortcutKeycaps('Shift+Ctrl+Alt+X', 'windows')).toEqual(['Ctrl', 'Alt', 'Shift', 'X'])
    expect(shortcutKeycaps('')).toEqual([])
  })

  it('keeps the guided trial entirely in local reducer state and never sends a persistence request', () => {
    const onboarding = source(onboardingPath)
    const trial = source(resolve(projectRoot, 'src/onboarding/guided-trial.ts'))

    expect(onboarding).toContain('useReducer(reduceGuidedTrial, initialGuidedTrialState)')
    expect(onboarding).not.toMatch(
      /storage\.|chrome\.storage|browser\.storage|rules\.(?:save|create|delete)/,
    )
    expect(trial).not.toMatch(/storage|browser|chrome|sendProtocolMessage|persist/i)

    const selected = reduceGuidedTrial(initialGuidedTrialState, { type: 'select' })
    const changed = reduceGuidedTrial(selected, { type: 'hide' })
    expect(changed).toEqual({ selected: true, action: 'hide' })
    expect(reduceGuidedTrial(changed, { type: 'reset' })).toEqual(initialGuidedTrialState)
  })

  it('keeps onboarding labels and outcomes localized in English and Russian', () => {
    const requiredKeys = [
      'onboardStartEditing',
      'onboardStartEditingHint',
      'onboardReadyTitle',
      'onboardReadyBody',
      'onboardShortcutLabel',
      'onboardNoShortcut',
      'onboardTrialTitle',
      'onboardTrialBody',
      'onboardTrialSelect',
      'onboardTrialHide',
      'onboardTrialText',
      'onboardTrialRound',
      'onboardTrialReset',
      'onboardTrialIdle',
      'onboardTrialSelected',
      'onboardTrialHidden',
      'onboardTrialTextChanged',
      'onboardTrialRounded',
      'onboardTrialTemporary',
    ]

    for (const key of requiredKeys) {
      expect(messages('en')[key]?.message, `English ${key}`).toBeTruthy()
      expect(messages('ru')[key]?.message, `Russian ${key}`).toBeTruthy()
    }
  })

  it('uses QDS document primitives, validates Elements icon sizes, and gives the public site a pinned QDS web bridge', () => {
    const onboardingHtml = source(onboardingHtmlPath)
    const onboarding = source(onboardingPath)
    const site = source(sitePath)

    expect(onboardingHtml).toContain('../src/qds/primitives.css')
    expect(onboarding).toContain('qds-keycap')
    expect(onboarding).toContain('qds-button')
    expect(existsSync(iconVerifierPath)).toBe(true)
    expect(source(iconVerifierPath)).toContain('Elements mark')
    expect(source(iconVerifierPath)).toContain('Resvg')
    expect(source(iconVerifierPath)).toContain('rendered.pixels')
    expect(source(iconVerifierPath)).toContain('action_unavailable_16.svg')
    expect(existsSync(siteAdapterPath)).toBe(true)
    expect(source(siteAdapterPath)).toContain('QenTerra Design System 1.8.1')
    expect(site).toContain('<link rel="stylesheet" href="qds-web.css"')
    expect(site).toContain('<link rel="stylesheet" href="product-illustration.css"')
    expect(site).not.toMatch(/animation:\s*[^;]*\binfinite\b/i)
    expect(source(resolve(projectRoot, 'qds-exceptions.json'))).not.toContain(
      '"path": "site/index.html"',
    )
  })
})
