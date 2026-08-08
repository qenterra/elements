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

  it('loads the pinned tokens, document adapter, and primitives before each extension page', () => {
    for (const entrypoint of ['entrypoints/options.html', 'entrypoints/onboarding.html']) {
      const html = source(resolve(projectRoot, entrypoint))
      expect(html).toContain('../src/qds/qds-tokens.css')
      expect(html).toContain('../src/qds/adapter/document.css')
      expect(html).toContain('../src/qds/primitives.css')
    }
  })
})
