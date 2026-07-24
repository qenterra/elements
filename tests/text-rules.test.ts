// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TextRuleManager } from '../src/content/text-rules'

describe('TextRuleManager', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('replaces visible text without destroying the original DOM nodes', () => {
    const card = document.createElement('div')
    card.className = 'card'
    const leading = document.createTextNode('Hello ')
    const strong = document.createElement('strong')
    strong.textContent = 'world'
    const button = document.createElement('button')
    button.textContent = 'Action'
    const onClick = vi.fn()
    button.addEventListener('click', onClick)
    card.append(leading, strong, button)
    document.body.append(card)

    const manager = new TextRuleManager()
    manager.apply([
      { id: 'rule_text', selector: '.card', permanent: true, action: 'text', text: 'Replacement' },
    ])

    expect(card.querySelector('[data-elements-text-replacement]')?.textContent).toBe('Replacement')
    expect(card.querySelector('[data-elements-text-original]')?.contains(strong)).toBe(true)

    manager.restoreAll()

    expect([...card.childNodes]).toEqual([leading, strong, button])
    button.click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('updates an applied replacement without wrapping the element again', () => {
    document.body.innerHTML = '<p class="title"><em>Original</em></p>'
    const manager = new TextRuleManager()
    manager.apply([
      { id: 'rule_text', selector: '.title', permanent: true, action: 'text', text: 'First' },
    ])
    manager.apply([
      { id: 'rule_text', selector: '.title', permanent: true, action: 'text', text: 'Second' },
    ])

    expect(document.querySelectorAll('[data-elements-text-original]')).toHaveLength(1)
    expect(document.querySelector('[data-elements-text-replacement]')?.textContent).toBe('Second')
  })

  it('restores an old target before applying the same rule ID to a new selector', () => {
    document.body.innerHTML = '<p class="old">Old</p><p class="new">New</p>'
    const manager = new TextRuleManager()
    manager.apply([
      { id: 'rule_text', selector: '.old', permanent: true, action: 'text', text: 'Changed' },
    ])
    manager.apply([
      { id: 'rule_text', selector: '.new', permanent: true, action: 'text', text: 'Moved' },
    ])

    expect(document.querySelector('.old')?.textContent).toBe('Old')
    expect(document.querySelector('.new [data-elements-text-replacement]')?.textContent).toBe(
      'Moved',
    )
  })

  it('restores text when a rule disappears', () => {
    document.body.innerHTML = '<p class="title">Original</p>'
    const manager = new TextRuleManager()
    manager.apply([
      { id: 'rule_text', selector: '.title', permanent: true, action: 'text', text: 'Changed' },
    ])
    manager.apply([])
    expect(document.querySelector('.title')?.textContent).toBe('Original')
  })
})
