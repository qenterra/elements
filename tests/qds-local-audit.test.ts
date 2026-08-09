import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error The audited CLI is intentionally plain ESM with no runtime TS dependency.
import { auditQdsConsumer } from '../scripts/qds-local-audit.mjs'

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
