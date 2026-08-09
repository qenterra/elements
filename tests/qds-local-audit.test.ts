import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error The audited CLI is intentionally plain ESM with no runtime TS dependency.
import * as auditModule from '../scripts/qds-local-audit.mjs'

const { auditQdsConsumer } = auditModule

const projectRoot = resolve(import.meta.dirname, '..')

describe('enhanced local QDS audit', () => {
  it('detects raw colors, durations, radii, spacing, component sizes, and typography', () => {
    const root = mkdtempSync(join(tmpdir(), 'elements-qds-audit-'))
    writeFileSync(
      join(root, 'raw.css'),
      `.button { color: rgba(1, 2, 3, .5); transition: color 173ms ease; border-radius: 9px; padding: 7px; width: 31px; font-size: 13.5px; line-height: 1.4; }`,
    )
    const findings = auditQdsConsumer({
      projectRoot: root,
      sourceRoots: ['.'],
      exceptions: [],
    })
    expect(new Set(findings.map((finding: { rule: string }) => finding.rule))).toEqual(
      new Set([
        'raw-color',
        'raw-duration',
        'raw-radius',
        'raw-spacing',
        'raw-component-size',
        'raw-typography',
      ]),
    )
  })

  it('audits shell and brand layout metrics without selector-name heuristics', () => {
    const root = mkdtempSync(join(tmpdir(), 'elements-qds-layout-audit-'))
    writeFileSync(
      join(root, 'layout.css'),
      `.mainWindow { width: 359px; max-height: 519px; border: 3px solid currentColor; outline: 4px solid currentColor; outline-offset: 5px; inset-inline-end: 11px; }
.brandTrial { height: 71px; max-width: 603px; left: 13px; }
.logicalShell { inline-size: 359px; max-block-size: 519px; column-width: 71px; }`,
    )
    const findings = auditQdsConsumer({ projectRoot: root, sourceRoots: ['.'], exceptions: [] })
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'raw-component-size', property: 'width', value: '359px' }),
        expect.objectContaining({
          rule: 'raw-component-size',
          property: 'max-height',
          value: '519px',
        }),
        expect.objectContaining({ rule: 'raw-stroke', property: 'border', value: '3px' }),
        expect.objectContaining({ rule: 'raw-stroke', property: 'outline', value: '4px' }),
        expect.objectContaining({ rule: 'raw-stroke', property: 'outline-offset', value: '5px' }),
        expect.objectContaining({
          rule: 'raw-position',
          property: 'inset-inline-end',
          value: '11px',
        }),
        expect.objectContaining({ rule: 'raw-position', property: 'left', value: '13px' }),
        expect.objectContaining({
          rule: 'raw-component-size',
          property: 'inline-size',
          value: '359px',
        }),
        expect.objectContaining({
          rule: 'raw-component-size',
          property: 'max-block-size',
          value: '519px',
        }),
        expect.objectContaining({
          rule: 'raw-component-size',
          property: 'column-width',
          value: '71px',
        }),
      ]),
    )
  })

  it('audits inline HTML declarations', () => {
    const root = mkdtempSync(join(tmpdir(), 'elements-qds-inline-audit-'))
    writeFileSync(
      join(root, 'inline.html'),
      `<div style="max-width: 333px; border-width: 3px; top: 7px; padding: 9px">Trial</div>`,
    )
    const findings = auditQdsConsumer({ projectRoot: root, sourceRoots: ['.'], exceptions: [] })
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: 'raw-component-size',
          property: 'max-width',
          value: '333px',
        }),
        expect.objectContaining({ rule: 'raw-stroke', property: 'border-width', value: '3px' }),
        expect.objectContaining({ rule: 'raw-position', property: 'top', value: '7px' }),
        expect.objectContaining({ rule: 'raw-spacing', property: 'padding', value: '9px' }),
      ]),
    )
  })

  it('strictly validates both exception registries and rejects stale governance entries', () => {
    const validate = (
      auditModule as typeof auditModule & {
        validateExceptionRegistries?: (input: {
          projectRoot: string
          sourceRoots: string[]
          metricRegistry: unknown
          upstreamRegistry: unknown
        }) => string[]
      }
    ).validateExceptionRegistries
    expect(validate).toBeTypeOf('function')
    if (!validate) return

    const manifest = JSON.parse(readFileSync(join(projectRoot, 'qds-consumer.json'), 'utf8'))
    const metricRegistry = JSON.parse(
      readFileSync(join(projectRoot, 'qds-metric-exceptions.json'), 'utf8'),
    )
    const upstreamRegistry = JSON.parse(
      readFileSync(join(projectRoot, 'qds-exceptions.json'), 'utf8'),
    )
    const check = (metric = metricRegistry, upstream = upstreamRegistry) =>
      validate({
        projectRoot,
        sourceRoots: manifest.sourceRoots,
        metricRegistry: metric,
        upstreamRegistry: upstream,
      })

    expect(check()).toEqual([])

    const unknownRule = structuredClone(metricRegistry)
    unknownRule.exceptions[2].rule = 'raw-magic'
    expect(check(unknownRule)).toEqual(expect.arrayContaining([expect.stringContaining('rule')]))

    const emptyReason = structuredClone(metricRegistry)
    emptyReason.exceptions[2].reason = ''
    expect(check(emptyReason)).toEqual(expect.arrayContaining([expect.stringContaining('reason')]))

    const duplicate = structuredClone(metricRegistry)
    duplicate.exceptions.push(structuredClone(duplicate.exceptions[2]))
    expect(check(duplicate)).toEqual(expect.arrayContaining([expect.stringContaining('duplicate')]))

    const stale = structuredClone(metricRegistry)
    stale.exceptions.push({
      id: 'stale-layout-value',
      rule: 'raw-component-size',
      path: 'site/index.html',
      property: 'max-width',
      value: '999px',
      reason: 'A deliberately stale test-only exception entry.',
      migrationTrigger: 'The matching declaration is introduced.',
    })
    expect(check(stale)).toEqual(expect.arrayContaining([expect.stringContaining('unused')]))

    const invalidCanonical = structuredClone(metricRegistry)
    invalidCanonical.exceptions[0].path = 'src/qds/missing.css'
    invalidCanonical.exceptions[0].sha256 = 'not-a-sha'
    expect(check(invalidCanonical)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('canonical'),
        expect.stringContaining('sha256'),
      ]),
    )

    const invalidUpstream = structuredClone(upstreamRegistry)
    invalidUpstream.exceptions[0].unexpected = true
    expect(check(metricRegistry, invalidUpstream)).toEqual(
      expect.arrayContaining([expect.stringContaining('unknown field')]),
    )

    const unknownUpstreamRule = structuredClone(upstreamRegistry)
    unknownUpstreamRule.exceptions[0].rule = 'raw-magic'
    expect(check(metricRegistry, unknownUpstreamRule)).toEqual(
      expect.arrayContaining([expect.stringContaining('rule')]),
    )

    const emptyUpstreamField = structuredClone(upstreamRegistry)
    emptyUpstreamField.exceptions[0].reviewTrigger = ''
    expect(check(metricRegistry, emptyUpstreamField)).toEqual(
      expect.arrayContaining([expect.stringContaining('reviewTrigger')]),
    )

    const duplicateUpstream = structuredClone(upstreamRegistry)
    duplicateUpstream.exceptions.push(structuredClone(duplicateUpstream.exceptions[0]))
    expect(check(metricRegistry, duplicateUpstream)).toEqual(
      expect.arrayContaining([expect.stringContaining('duplicate')]),
    )

    const staleUpstreamColor = structuredClone(upstreamRegistry)
    staleUpstreamColor.exceptions[0].path = 'site/index.html'
    expect(check(metricRegistry, staleUpstreamColor)).toEqual(
      expect.arrayContaining([expect.stringContaining('unused')]),
    )

    const staleAdapter = structuredClone(upstreamRegistry)
    staleAdapter.exceptions.push({
      id: 'stale-css-adapter',
      rule: 'missing-css-adapter',
      path: '*',
      reason: 'A deliberately stale adapter exception.',
      reviewTrigger: 'The CSS adapter disappears.',
    })
    expect(check(metricRegistry, staleAdapter)).toEqual(
      expect.arrayContaining([expect.stringContaining('unused')]),
    )
  })

  it('keeps the committed product roots at zero findings with exact exceptions only', () => {
    const manifest = JSON.parse(readFileSync(join(projectRoot, 'qds-consumer.json'), 'utf8'))
    const registry = JSON.parse(
      readFileSync(join(projectRoot, 'qds-metric-exceptions.json'), 'utf8'),
    )
    expect(
      auditQdsConsumer({
        projectRoot,
        sourceRoots: manifest.sourceRoots,
        exceptions: registry.exceptions,
      }),
    ).toEqual([])
  })
})
