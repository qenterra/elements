import { describe, expect, it } from 'vitest'
import {
  editDeclarations,
  migratePersistedEdits,
  normalizePersistedEdits,
  normalizeSettings,
  isSafeSelectorText,
  sanitizeCssDeclarations,
} from '../src/core/model'

describe('normalizePersistedEdits', () => {
  it('keeps valid hide, round, and text entries', () => {
    expect(
      normalizePersistedEdits([
        { selector: '.ad', permanent: true },
        { selector: '.card', permanent: false, action: 'round' },
        { selector: '#headline', permanent: true, action: 'text', text: 'Hello' },
      ]),
    ).toEqual([
      { selector: '.ad', permanent: true },
      { selector: '.card', permanent: false, action: 'round' },
      { selector: '#headline', permanent: true, action: 'text', text: 'Hello' },
    ])
  })

  it('keeps the style actions added in version 1.1', () => {
    expect(
      normalizePersistedEdits([
        { selector: '.banner', permanent: true, action: 'blur' },
        { selector: '.aside', permanent: true, action: 'dim' },
        { selector: '.hero', permanent: true, action: 'gray' },
        { selector: '.card', permanent: true, action: 'round', value: '20' },
        { selector: '.promo', permanent: true, action: 'css', value: 'opacity: 0.5' },
      ]),
    ).toEqual([
      { selector: '.banner', permanent: true, action: 'blur' },
      { selector: '.aside', permanent: true, action: 'dim' },
      { selector: '.hero', permanent: true, action: 'gray' },
      { selector: '.card', permanent: true, action: 'round', value: '20' },
      { selector: '.promo', permanent: true, action: 'css', value: 'opacity: 0.5 !important;' },
    ])
  })

  it('drops malformed entries and defaults permanent to true', () => {
    expect(
      normalizePersistedEdits([null, { selector: '' }, { selector: '.safe' }, 'not an object']),
    ).toEqual([{ selector: '.safe', permanent: true }])
  })

  it('drops unknown actions so older data stays intact and newer data degrades safely', () => {
    expect(
      normalizePersistedEdits([
        { selector: '.future', permanent: true, action: 'hologram' },
        { selector: '.safe', permanent: true },
      ]),
    ).toEqual([{ selector: '.safe', permanent: true }])
  })

  it('never trusts a text payload without a text action', () => {
    expect(
      normalizePersistedEdits([
        { selector: '.item', permanent: true, text: 'ignored' },
        { selector: '.title', permanent: true, action: 'text' },
      ]),
    ).toEqual([
      { selector: '.item', permanent: true },
      { selector: '.title', permanent: true, action: 'text' },
    ])
  })

  it('drops unsafe payloads for round and css actions', () => {
    expect(
      normalizePersistedEdits([
        { selector: '.a', permanent: true, action: 'round', value: '12px; position: fixed' },
        {
          selector: '.b',
          permanent: true,
          action: 'css',
          value: 'background: url(https://evil.example/x)',
        },
        { selector: '.c', permanent: true, action: 'css', value: '} body { display: none' },
      ]),
    ).toEqual([{ selector: '.a', permanent: true, action: 'round' }])
  })

  it('clamps imported radius values to the supported range', () => {
    expect(
      normalizePersistedEdits([
        { selector: '.large', permanent: true, action: 'round', value: '999' },
        { selector: '.small', permanent: true, action: 'round', value: '0' },
      ]),
    ).toEqual([
      { selector: '.large', permanent: true, action: 'round', value: '32' },
      { selector: '.small', permanent: true, action: 'round', value: '2' },
    ])
  })
})

describe('isSafeSelectorText', () => {
  it('accepts balanced selectors and rejects malformed or extension-owned targets', () => {
    expect(isSafeSelectorText('main > article[data-kind="story"]:not(.hidden)')).toBe(true)
    expect(isSafeSelectorText('main[data-value="unterminated]')).toBe(false)
    expect(isSafeSelectorText('.card)')).toBe(false)
    expect(isSafeSelectorText('body { display: none }')).toBe(false)
    expect(isSafeSelectorText('#elements-extension-root-v2')).toBe(false)
  })
})

describe('sanitizeCssDeclarations', () => {
  it('normalizes valid declarations and forces !important', () => {
    expect(sanitizeCssDeclarations('opacity: 0.5; border: none')).toBe(
      'opacity: 0.5 !important; border: none !important;',
    )
  })

  it('keeps supported visual properties and existing !important', () => {
    expect(sanitizeCssDeclarations('transform: translateX(4px); color: red !important')).toBe(
      'transform: translateX(4px) !important; color: red !important;',
    )
  })

  it.each([
    ['braces', 'color: red } body { display: none'],
    ['url()', 'background: url(https://evil.example)'],
    ['at-rules', '@import "x"'],
    ['comments', 'color: red /* sneak */'],
    ['custom properties', '--image: "//evil.example/x"'],
    ['image-set()', 'background: image-set("//evil.example/x" 1x)'],
    ['unsupported properties', 'content: "spoofed"'],
    ['empty', '   '],
    ['no colon', 'display none'],
  ])('rejects %s', (_name, value) => {
    expect(sanitizeCssDeclarations(value)).toBeNull()
  })
})

describe('migratePersistedEdits', () => {
  it('adds stable IDs and timestamps without replacing valid metadata', () => {
    const first = migratePersistedEdits(
      [
        { selector: '.legacy', permanent: true },
        { id: 'rule_existing', selector: '.current', permanent: true, createdAt: 5, updatedAt: 9 },
      ],
      100,
    )
    const second = migratePersistedEdits([{ selector: '.legacy', permanent: true }], 200)

    expect(first[0]).toMatchObject({ id: second[0].id, createdAt: 100, updatedAt: 100 })
    expect(first[1]).toMatchObject({ id: 'rule_existing', createdAt: 5, updatedAt: 9 })
  })
})

describe('editDeclarations', () => {
  it('maps every action to its stylesheet payload', () => {
    expect(editDeclarations({ selector: '.a', permanent: true }, 12)).toBe(
      'display: none !important;',
    )
    expect(editDeclarations({ selector: '.a', permanent: true, action: 'round' }, 12)).toBe(
      'border-radius: 12px !important;',
    )
    expect(
      editDeclarations({ selector: '.a', permanent: true, action: 'round', value: '20' }, 12),
    ).toBe('border-radius: 20px !important;')
    expect(editDeclarations({ selector: '.a', permanent: true, action: 'blur' }, 12)).toBe(
      'filter: blur(8px) !important;',
    )
    expect(editDeclarations({ selector: '.a', permanent: true, action: 'dim' }, 12)).toBe(
      'opacity: 0.35 !important;',
    )
    expect(editDeclarations({ selector: '.a', permanent: true, action: 'gray' }, 12)).toBe(
      'filter: grayscale(1) !important;',
    )
    expect(
      editDeclarations({ selector: '.a', permanent: true, action: 'css', value: 'color: red' }, 12),
    ).toBe('color: red !important;')
  })

  it('applies text edits to the DOM, not the stylesheet', () => {
    expect(
      editDeclarations({ selector: '.a', permanent: true, action: 'text', text: 'x' }, 12),
    ).toBeNull()
  })
})

describe('normalizeSettings', () => {
  it('fills defaults for missing or corrupt values', () => {
    expect(normalizeSettings(null)).toEqual({
      remember: true,
      theme: 'system',
      radius: 12,
      advanced: false,
      coachmarkSeen: false,
    })
    expect(normalizeSettings({ theme: 'neon', radius: 'huge' })).toMatchObject({
      theme: 'system',
      radius: 12,
    })
  })

  it('keeps explicit choices and clamps the radius', () => {
    expect(
      normalizeSettings({
        remember: false,
        theme: 'light',
        radius: 500,
        advanced: true,
        coachmarkSeen: true,
      }),
    ).toEqual({ remember: false, theme: 'light', radius: 32, advanced: true, coachmarkSeen: true })
  })
})
