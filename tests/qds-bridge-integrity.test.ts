import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error The integrity CLI is intentionally plain ESM with no runtime TS dependency.
import { verifyQdsBridge } from '../scripts/verify-qds-bridge.mjs'

const projectRoot = resolve(import.meta.dirname, '..')

describe('QDS Web bridge integrity', () => {
  it('matches the complete pinned local QDS 1.8.1 CSS snapshot', () => {
    expect(verifyQdsBridge(projectRoot)).toEqual({
      version: '1.8.1',
      tokenCount: expect.any(Number),
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
  })

  it('rejects content drift even when provenance comments remain unchanged', () => {
    const root = mkdtempSync(join(tmpdir(), 'elements-qds-bridge-'))
    copyFileSync(join(projectRoot, 'src/qds/qds-tokens.css'), join(root, 'tokens.css'))
    const bridge = readFileSync(join(projectRoot, 'site/qds-web.css'), 'utf8')
    writeFileSync(
      join(root, 'bridge.css'),
      bridge.replace('--qds-space-2: 8px', '--qds-space-2: 9px'),
    )
    expect(() =>
      verifyQdsBridge(root, {
        source: 'tokens.css',
        bridge: 'bridge.css',
        versionFile: join(projectRoot, 'src/qds/qds-version.json'),
      }),
    ).toThrow(/content does not match/i)
  })
})
