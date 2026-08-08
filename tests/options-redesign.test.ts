import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '..')
const options = readFileSync(resolve(projectRoot, 'entrypoints/options/main.tsx'), 'utf8')
const stylesheet = readFileSync(resolve(projectRoot, 'entrypoints/options.html'), 'utf8')
const english = JSON.parse(
  readFileSync(resolve(projectRoot, 'public/_locales/en/messages.json'), 'utf8'),
) as Record<string, { message: string }>
const russian = JSON.parse(
  readFileSync(resolve(projectRoot, 'public/_locales/ru/messages.json'), 'utf8'),
) as Record<string, { message: string }>

function expectLocalized(keys: string[]) {
  for (const key of keys) {
    expect(english[key]?.message, `missing English ${key}`).toBeTruthy()
    expect(russian[key]?.message, `missing Russian ${key}`).toBeTruthy()
  }
}

describe('options redesign contract', () => {
  it('uses a QDS settings/history shell with semantic sections instead of a card grid', () => {
    expect(options).toContain('className="optionsShell"')
    expect(options).toContain('className="optionsNav"')
    expect(options).toContain('className="optionsSection"')
    expect(options).toContain('className="qds-group settingsGroup"')
    expect(stylesheet).toContain('.optionsShell')
    expect(stylesheet).toContain('.optionsNav')
    expect(stylesheet).toContain('.optionsSection')
  })

  it('exposes appearance as one accessible radio group and keeps setting rows semantic', () => {
    expect(options).toContain('role="radiogroup"')
    expect(options).toContain('type="radio"')
    expect(options).toContain('className="qds-radio-group"')
    expect(options).toContain('className="settingRow qds-interactive-row"')
  })

  it('distinguishes an empty history from a no-results filter and makes search state recoverable', () => {
    expect(options).toContain('optionsSearchScope')
    expect(options).toContain('optionsSearchResults')
    expect(options).toContain('optionsSearchClear')
    expect(options).toContain("onClick={() => setSearch('')}")
    expect(options).toContain("search ? t('optionsSearchEmpty') : t('optionsSitesEmpty')")
    expectLocalized([
      'optionsSearchScope',
      'optionsSearchResults',
      'optionsSearchClear',
      'optionsSitesEmpty',
      'optionsSearchEmpty',
    ])
  })

  it('keeps deletion recovery available beyond a transient toast until the next destructive operation', () => {
    expect(options).toContain('type RecoveryState')
    expect(options).toContain('const [recovery, setRecovery]')
    expect(options).toContain('<RecoveryNotice')
    expect(options).toContain('recovery={recovery}')
    expect(options).toContain(
      "setRecovery({ snapshot, message: t('optionsSiteDeleted', [domain]) })",
    )
    expect(options).toContain("setRecovery({ snapshot, message: t('optionsRuleDeleted') })")
    expectLocalized(['optionsRecoveryTitle', 'optionsRecoveryRestore', 'optionsRecoveryDismiss'])
  })

  it('reports export and settings operations with operation-specific errors rather than swallowing them', () => {
    expect(options).toContain("showToast(t('optionsExportFailed'), true)")
    expect(options).toContain("showToast(t('optionsSitesLoadFailed'), true)")
    expect(options).toContain("showToast(t('optionsSettingsSaveFailed'), true)")
    expectLocalized([
      'optionsExportFailed',
      'optionsSitesLoadFailed',
      'optionsSettingsSaveFailed',
      'optionsSiteDeleteFailed',
      'optionsRuleDeleteFailed',
    ])
  })
})
