import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '..')
const documentAdapterPath = resolve(projectRoot, 'src/qds/adapter/document.css')
const primitivesPath = resolve(projectRoot, 'src/qds/primitives.css')
const shadowAdapterPath = resolve(projectRoot, 'src/qds/adapter/shadow-dom.ts')

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

function cssRule(stylesheet: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'))
  return match?.[1] ?? ''
}

describe('QDS shared theme and primitives', () => {
  it('adapts the pinned QDS tokens for document pages without retaining a local palette', () => {
    expect(existsSync(documentAdapterPath)).toBe(true)

    const adapter = source(documentAdapterPath)
    expect(adapter).toContain(':root')
    expect(adapter).toContain('[data-theme')
    expect(adapter).toContain('--qds-surface-content')
    expect(adapter).not.toMatch(/#[0-9a-f]{3,8}\b|rgba\(/i)
    expect(existsSync(resolve(projectRoot, 'src/theme/tokens.css'))).toBe(false)
  })

  it('ships QDS primitives to both document and Shadow DOM surfaces', () => {
    expect(existsSync(primitivesPath)).toBe(true)

    const primitives = source(primitivesPath)
    for (const selector of [
      '.qds-button',
      '.qds-icon-button',
      '.qds-group',
      '.qds-interactive-row',
      '.qds-status',
      '.qds-radio-group',
      '.qds-dialog',
      '.qds-tooltip',
      '.qds-keycap',
    ]) {
      expect(primitives).toContain(selector)
    }
    expect(primitives).toContain('@media (pointer: coarse)')
    expect(primitives).toContain(':focus-visible')
    expect(source(shadowAdapterPath)).toContain('../../qds/primitives.css?raw')
  })

  it('keeps filled button variants opaque through hover and press states', () => {
    const primitives = source(primitivesPath)

    expect(cssRule(primitives, '.qds-button--primary:hover:not(:disabled)')).toContain(
      'background: var(--qds-action-primary)',
    )
    expect(cssRule(primitives, '.qds-button--primary:active:not(:disabled)')).toContain(
      'background: var(--qds-action-primary)',
    )
    expect(cssRule(primitives, '.qds-button--destructive:hover:not(:disabled)')).toContain(
      'background: var(--qds-state-destructive)',
    )
    expect(cssRule(primitives, '.qds-button--destructive:active:not(:disabled)')).toContain(
      'background: var(--qds-state-destructive)',
    )
    expect(cssRule(primitives, '.qds-button:hover:not(:disabled)')).not.toContain(
      'background: var(--qds-fill-hover)',
    )
  })

  it('gives dialog close controls the same complete fine-pointer base as icon buttons', () => {
    const closeControl = cssRule(source(primitivesPath), '.qds-dialog__close')

    expect(closeControl).toContain('display: inline-grid')
    expect(closeControl).toContain('width: var(--qds-size-control-standard)')
    expect(closeControl).toContain('height: var(--qds-size-control-standard)')
    expect(closeControl).toContain('place-items: center')
    expect(closeControl).toContain('border: var(--qds-stroke-default) solid transparent')
    expect(closeControl).toContain('background: transparent')
    expect(closeControl).toContain('cursor: pointer')
  })

  it('loads the pinned tokens, document adapter, and primitives before each extension page', () => {
    for (const entrypoint of ['entrypoints/options.html', 'entrypoints/onboarding.html']) {
      const html = source(resolve(projectRoot, entrypoint))
      expect(html).toContain('../src/qds/qds-tokens.css')
      expect(html).toContain('../src/qds/adapter/document.css')
      expect(html).toContain('../src/qds/primitives.css')
    }
  })
})
