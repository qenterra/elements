import { describe, expect, it } from 'vitest'
import { isContentCommand, isExtensionRequest } from '../src/core/protocol'

describe('protocol validation', () => {
  it('accepts complete versioned requests', () => {
    expect(isExtensionRequest({ v: 2, type: 'site.snapshot', site: 'example.com' })).toBe(true)
    expect(isExtensionRequest({ v: 2, type: 'picker.ui.load' })).toBe(true)
    expect(isExtensionRequest({ v: 2, type: 'backup.import', data: '{}', mode: 'merge' })).toBe(
      true,
    )
    expect(isExtensionRequest({ v: 2, type: 'settings.save', settings: {} })).toBe(true)
    expect(
      isExtensionRequest({
        v: 2,
        type: 'site.rules.save',
        site: 'example.com',
        rules: [],
        origin: '2e73000c-06bb-440f-b607-0d7ff7703486',
      }),
    ).toBe(true)
    expect(
      isExtensionRequest({
        v: 2,
        type: 'site.rule.delete',
        site: 'example.com',
        ruleId: 'rule_first',
      }),
    ).toBe(true)
  })

  it('rejects legacy, malformed, and unknown messages', () => {
    expect(isExtensionRequest({ action: 'get_settings' })).toBe(false)
    expect(isExtensionRequest({ v: 2, type: 'site.snapshot' })).toBe(false)
    expect(isExtensionRequest({ v: 2, type: 'backup.import', data: '{}', mode: 'overwrite' })).toBe(
      false,
    )
    expect(isExtensionRequest({ v: 2, type: 'site.rule.delete', site: 'example.com' })).toBe(false)
    expect(
      isExtensionRequest({
        v: 2,
        type: 'site.rules.save',
        site: 'example.com',
        rules: [],
        origin: 42,
      }),
    ).toBe(false)
    expect(isExtensionRequest({ v: 2, type: 'future.action' })).toBe(false)
  })

  it('validates content commands independently', () => {
    expect(isContentCommand({ v: 2, type: 'picker.toggle' })).toBe(true)
    expect(isContentCommand({ v: 2, type: 'site.changed', site: 'example.com' })).toBe(true)
    expect(
      isContentCommand({
        v: 2,
        type: 'site.changed',
        site: 'example.com',
        origin: '2e73000c-06bb-440f-b607-0d7ff7703486',
      }),
    ).toBe(true)
    expect(isContentCommand({ v: 2, type: 'site.changed' })).toBe(false)
  })
})
