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

  it('gives every button variant an intentional hover and press state without losing filled contrast', () => {
    const primitives = source(primitivesPath)

    for (const [variant, surface] of [
      ['.qds-button--primary', '--qds-action-primary'],
      ['.qds-button--secondary', '--qds-action-secondary'],
      ['.qds-button--destructive', '--qds-state-destructive'],
    ]) {
      expect(cssRule(primitives, `${variant}:hover:not(:disabled)`)).toContain(
        `background: var(${surface})`,
      )
      const pressed = cssRule(primitives, `${variant}:active:not(:disabled)`)
      expect(pressed).toContain(`background: var(${surface})`)
      expect(pressed).toContain('transform: scale(0.98)')
    }

    expect(cssRule(primitives, '.qds-button--quiet:hover:not(:disabled)')).toContain(
      'background: var(--qds-fill-hover)',
    )
    const quietPressed = cssRule(primitives, '.qds-button--quiet:active:not(:disabled)')
    expect(quietPressed).toContain('background: var(--qds-fill-pressed)')
    expect(quietPressed).toContain('transform: scale(0.98)')
    expect(cssRule(primitives, '.qds-button:hover:not(:disabled)')).not.toContain(
      'background: var(--qds-fill-hover)',
    )
  })

  it('gives dialog close controls complete icon-control parity across input and motion states', () => {
    const primitives = source(primitivesPath)
    const closeControl = cssRule(primitives, '.qds-dialog__close')

    expect(closeControl).toContain('display: inline-grid')
    expect(closeControl).toContain('width: var(--qds-size-control-standard)')
    expect(closeControl).toContain('height: var(--qds-size-control-standard)')
    expect(closeControl).toContain('place-items: center')
    expect(closeControl).toContain('border: var(--qds-stroke-default) solid transparent')
    expect(closeControl).toContain('background: transparent')
    expect(closeControl).toContain('cursor: pointer')

    const closeDisabled = cssRule(primitives, '.qds-dialog__close:disabled')
    expect(closeDisabled).toContain('color: var(--qds-text-disabled)')
    expect(closeDisabled).toContain('background: var(--qds-fill-disabled)')
    expect(closeDisabled).toContain('cursor: default')

    expect(cssRule(primitives, '.qds-dialog__close:focus-visible')).toContain(
      'outline: var(--qds-stroke-focus) solid var(--qds-border-focus)',
    )
    expect(primitives).toMatch(
      /@media \(pointer: coarse\)[\s\S]*\.qds-dialog__close[\s\S]*min-width: var\(--qds-size-target-touch\)[\s\S]*min-height: var\(--qds-size-target-touch\)/,
    )
    expect(primitives).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.qds-dialog__close[\s\S]*transition-duration: var\(--qds-motion-instant\)/,
    )
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
