/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import {
  allowsNativeKeyboardActivation,
  ownsDocumentShortcut,
} from '../src/content/keyboard-ownership'

describe('document shortcut ownership', () => {
  it('ignores composed paths owned by picker Shadow UI or editable page controls', () => {
    const host = document.createElement('div')
    host.dataset.elementsExtensionRoot = ''
    const shadow = host.attachShadow({ mode: 'open' })
    const pickerButton = document.createElement('button')
    shadow.append(pickerButton)

    const pageButton = document.createElement('button')
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    const page = document.createElement('main')

    expect(ownsDocumentShortcut([pickerButton, shadow, host, document])).toBe(false)
    expect(ownsDocumentShortcut([pageButton, document.body, document])).toBe(false)
    expect(ownsDocumentShortcut([editor, document.body, document])).toBe(false)
    expect(ownsDocumentShortcut([page, document.body, document])).toBe(true)
  })

  it('allows detail-zero Space activation on page and picker buttons', () => {
    const button = document.createElement('button')
    expect(allowsNativeKeyboardActivation([button, document.body], 0)).toBe(true)
    expect(allowsNativeKeyboardActivation([button, document.body], 1)).toBe(false)
  })
})
