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
        type: 'site.restore',
        recovery: {
          kind: 'rule',
          recovery: {
            site: 'example.com',
            rule: { id: 'rule_deleted', selector: '.deleted', permanent: true },
            modified: 1,
            paused: false,
          },
        },
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
        type: 'site.restore',
        recovery: { kind: 'rule', recovery: { site: 'example.com' } },
      }),
    ).toBe(false)
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

  it('rejects incomplete and malformed recovery payloads at the protocol boundary', () => {
    const validRule = { id: 'rule_deleted', selector: '.deleted', permanent: true }
    const validRuleRecovery = {
      v: 2,
      type: 'site.restore',
      recovery: {
        kind: 'rule',
        recovery: { site: 'example.com', rule: validRule, modified: 1, paused: false },
      },
    }

    expect(isExtensionRequest(validRuleRecovery)).toBe(true)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { selector: '.deleted', permanent: true },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'text', text: 'Edited text', value: 'unexpected' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'gray', text: 'unexpected' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, id: 'short' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'unknown' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'css', value: 'background: url(https://bad.example)' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'round', value: '12px' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'css' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'text' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'round' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'blur', value: '12' },
          },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'text', text: 'Edited text' },
          },
        },
      }),
    ).toBe(true)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'css', value: 'color: red' },
          },
        },
      }),
    ).toBe(true)
    expect(
      isExtensionRequest({
        ...validRuleRecovery,
        recovery: {
          ...validRuleRecovery.recovery,
          recovery: {
            ...validRuleRecovery.recovery.recovery,
            rule: { ...validRule, action: 'blur' },
          },
        },
      }),
    ).toBe(true)

    const validSiteRecovery = {
      v: 2,
      type: 'site.restore',
      recovery: {
        kind: 'site',
        snapshot: {
          site: 'example.com',
          rules: [validRule],
          modified: 1,
          paused: false,
        },
      },
    }
    expect(isExtensionRequest(validSiteRecovery)).toBe(true)
    expect(
      isExtensionRequest({
        ...validSiteRecovery,
        recovery: {
          kind: 'site',
          snapshot: { site: 'Example.com', rules: [validRule], modified: 1, paused: false },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validSiteRecovery,
        recovery: {
          kind: 'site',
          snapshot: { site: 'example.com', rules: [validRule], modified: 1 },
        },
      }),
    ).toBe(false)
    expect(
      isExtensionRequest({
        ...validSiteRecovery,
        recovery: {
          kind: 'site',
          snapshot: {
            site: 'example.com',
            rules: [{ selector: '.nested', permanent: true }],
            modified: 1,
            paused: false,
          },
        },
      }),
    ).toBe(false)
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
