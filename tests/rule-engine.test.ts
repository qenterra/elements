// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { RuleEngine } from '../src/content/rule-engine'

describe('RuleEngine', () => {
  beforeEach(() => {
    document.head.replaceChildren()
    document.body.innerHTML = '<main><p class="title">Original</p><div class="ad">Ad</div></main>'
  })

  it('compiles style actions and applies reversible text rules', () => {
    const engine = new RuleEngine()
    engine.apply({
      rules: [
        { id: 'rule_hide', selector: '.ad', permanent: true },
        { id: 'rule_text', selector: '.title', permanent: true, action: 'text', text: 'Changed' },
      ],
      paused: false,
      showOriginal: false,
      previewSelector: null,
      defaultRadius: 12,
    })

    expect(document.querySelector('style')?.textContent).toContain(
      '.ad { display: none !important; }',
    )
    expect(document.querySelector('[data-elements-text-replacement]')?.textContent).toBe('Changed')

    engine.apply({
      rules: [],
      paused: false,
      showOriginal: true,
      previewSelector: null,
      defaultRadius: 12,
    })
    expect(document.querySelector('.title')?.textContent).toBe('Original')
  })

  it('never applies imported rules to the extension root', () => {
    const root = document.createElement('div')
    root.setAttribute('data-elements-extension-root', '')
    root.textContent = 'Elements'
    document.body.append(root)
    const engine = new RuleEngine()

    engine.apply({
      rules: [
        { id: 'rule_text', selector: 'div', permanent: true, action: 'text', text: 'Changed' },
      ],
      paused: false,
      showOriginal: false,
      previewSelector: null,
      defaultRadius: 12,
    })

    expect(root.textContent).toBe('Elements')
  })

  it('removes styles and restores text during teardown', () => {
    const engine = new RuleEngine()
    engine.apply({
      rules: [
        { id: 'rule_text', selector: '.title', permanent: true, action: 'text', text: 'Changed' },
      ],
      paused: false,
      showOriginal: false,
      previewSelector: null,
      defaultRadius: 12,
    })
    engine.destroy()
    expect(document.querySelector('.title')?.textContent).toBe('Original')
    expect(document.getElementById('elements-extension-rules-v2')).toBeNull()
  })
})
