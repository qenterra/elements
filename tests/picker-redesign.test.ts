import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '..')
const overlay = readFileSync(resolve(projectRoot, 'src/content/ui.tsx'), 'utf8')
const controller = readFileSync(resolve(projectRoot, 'src/content/controller.ts'), 'utf8')
const stylesheet = readFileSync(resolve(projectRoot, 'src/content/content.css'), 'utf8')
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

describe('picker redesign contract', () => {
  it('distinguishes Previewing from Selected before it enables selection actions', () => {
    expect(controller).toContain('const selectionState = this.selectionLocked')
    expect(controller).toContain("? 'selected'")
    expect(controller).toContain("? 'previewing'")
    expect(overlay).toContain("snapshot.selectionState === 'selected'")
    expect(overlay).toContain("? 'pickerSelected'")
    expect(overlay).toContain("? 'pickerPreviewing'")
    expect(stylesheet).toContain('.selectionStatus_selected')
    expectLocalized(['pickerPreviewing', 'pickerSelected', 'pickerSelectionIdle'])
  })

  it('makes breadcrumb levels interactive and supports Arrow Up/Down with Q/W compatibility', () => {
    expect(overlay).toContain('controller.selectPathToken(index)')
    expect(overlay).toContain('className={`pathNode')
    expect(overlay).toContain('type="button"')
    expect(controller).toContain('selectPathToken(index: number): void')
    expect(controller).toContain("event.code === 'ArrowUp'")
    expect(controller).toContain("event.code === 'ArrowDown'")
    expect(controller).toContain("event.code === 'KeyW'")
    expect(controller).toContain("event.code === 'KeyQ'")
    expectLocalized(['pickerSelectPathToken', 'pickerMoveSelection'])
  })

  it('keeps three primary actions, moves secondary actions to More, and restores focus', () => {
    expect(overlay).toContain('className="actionBtn qds-button qds-button--primary"')
    expect(overlay).toContain('className="actionBtn actionBtn_icon qds-icon-button"')
    expect(overlay).toContain('moreButtonRef.current?.focus()')
    for (const action of ['blur', 'dim', 'gray']) {
      expect(overlay).toContain(`runAction('${action}')`)
    }
  })

  it('uses progressive history, an honest new-edit persistence status, and a bounded compact sheet', () => {
    expect(overlay).toContain(
      'const visibleEdits = showAllHistory ? snapshot.edits : snapshot.edits.slice(0, 3)',
    )
    expect(overlay).toContain('pickerShowAllChanges')
    expect(overlay).toContain('pickerPersistenceSaved')
    expect(overlay).toContain('pickerPersistenceTemporary')
    expect(stylesheet).toContain('.historyDisclosure')
    expect(stylesheet).toContain('.persistenceStatus')
    expect(stylesheet).toContain('max-height: min(68vh, 520px)')
    expectLocalized([
      'pickerShowAllChanges',
      'pickerShowRecentChanges',
      'pickerPersistenceSaved',
      'pickerPersistenceTemporary',
    ])
  })
})
