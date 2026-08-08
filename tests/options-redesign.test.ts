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
    expect(options).toContain(
      'const hasActiveSearch = sites.length > 0 && search.trim().length > 0',
    )
    expect(options).toContain("hasActiveSearch ? t('optionsSearchEmpty') : t('optionsSitesEmpty')")
    expectLocalized([
      'optionsSearchScope',
      'optionsSearchResultsOne',
      'optionsSearchResultsFew',
      'optionsSearchResultsMany',
      'optionsSearchClear',
      'optionsSitesEmpty',
      'optionsSearchEmpty',
    ])
  })

  it('uses locale plural categories and grammatical result-count messages', () => {
    const russianRules = new Intl.PluralRules('ru')
    expect(russianRules.select(1)).toBe('one')
    expect(russianRules.select(2)).toBe('few')
    expect(russianRules.select(12)).toBe('many')
    expect(english.optionsSearchResultsOne?.message).toBe('$COUNT$ site shown')
    expect(english.optionsSearchResultsFew?.message).toBe('$COUNT$ sites shown')
    expect(english.optionsSearchResultsMany?.message).toBe('$COUNT$ sites shown')
    expect(russian.optionsSearchResultsOne?.message).toBe('Показан $COUNT$ сайт')
    expect(russian.optionsSearchResultsFew?.message).toBe('Показано $COUNT$ сайта')
    expect(russian.optionsSearchResultsMany?.message).toBe('Показано $COUNT$ сайтов')
    expect(english.optionsSearchResults).toBeUndefined()
    expect(russian.optionsSearchResults).toBeUndefined()
  })

  it('keeps deletion recovery available beyond a transient toast until the next destructive operation', () => {
    expect(options).toContain('type RecoveryState')
    expect(options).toContain('const [recovery, setRecovery]')
    expect(options).toContain('<RecoveryNotice')
    expect(options).toContain('recovery={recovery}')
    expect(options).toContain("kind: 'site'")
    expect(options).toContain("kind: 'rule'")
    expect(options).toContain('recovery: recovery.recovery')
    expectLocalized(['optionsRecoveryTitle', 'optionsRecoveryRestore', 'optionsRecoveryDismiss'])
  })

  it('keeps fine and coarse pointer targets valid for sort, switches, and navigation', () => {
    for (const selector of ['.sortSwitch__btn', '.switch', '.optionsNav__links a']) {
      expect(stylesheet).toContain(selector)
    }
    expect(stylesheet).toContain('min-height: var(--qds-size-control-standard)')
    expect(stylesheet).toMatch(
      /@media \(pointer: coarse\)[\s\S]*(?:\.sortSwitch__btn|\.switch|\.optionsNav__links a)[\s\S]*min-height: var\(--qds-size-target-touch\)/,
    )
  })

  it('waits for import undo, reports failure, and only dismisses the notice after success', () => {
    expect(options).toContain('const restored = await notice.undo?.()')
    expect(options).toContain("t('optionsImportUndoFailed')")
    expect(options).toContain('if (restored) onDismiss(notice.id)')
    expectLocalized(['optionsImportUndoFailed'])
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
