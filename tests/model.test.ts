import { describe, expect, it } from 'vitest'
import { normalizePersistedEdits } from '../src/core/model'

describe('normalizePersistedEdits', () => {
  it('keeps valid hide, round, and text entries', () => {
    expect(normalizePersistedEdits([
      { selector: '.ad', permanent: true },
      { selector: '.card', permanent: false, action: 'round' },
      { selector: '#headline', permanent: true, action: 'text', text: 'Hello' },
    ])).toEqual([
      { selector: '.ad', permanent: true },
      { selector: '.card', permanent: false, action: 'round' },
      { selector: '#headline', permanent: true, action: 'text', text: 'Hello' },
    ])
  })

  it('drops malformed entries and defaults permanent to true', () => {
    expect(normalizePersistedEdits([
      null,
      { selector: '' },
      { selector: '.safe' },
      'not an object',
    ])).toEqual([
      { selector: '.safe', permanent: true },
    ])
  })

  it('never trusts a text payload without a text action', () => {
    expect(normalizePersistedEdits([
      { selector: '.item', permanent: true, text: 'ignored' },
      { selector: '.title', permanent: true, action: 'text' },
    ])).toEqual([
      { selector: '.item', permanent: true },
      { selector: '.title', permanent: true, action: 'text' },
    ])
  })
})
