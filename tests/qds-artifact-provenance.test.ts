import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error The artifact verifier is intentionally plain ESM with no runtime TS dependency.
import { verifyQdsArtifacts } from '../scripts/verify-qds-artifacts.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const fixturePaths = [
  'site/qds-web.css',
  'src/qds/qds-artifacts-manifest.json',
  'src/qds/qds-tokens.css',
  'src/qds/qds-tokens.source.css',
]

function copyFixture(root: string): void {
  for (const relative of fixturePaths) {
    const destination = join(root, relative)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(projectRoot, relative), destination)
  }
}

describe('QDS generated artifact provenance', () => {
  it('regenerates both committed consumers from the canonical source', () => {
    expect(verifyQdsArtifacts(projectRoot)).toEqual({
      version: '1.8.1',
      tokenCount: expect.any(Number),
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
  })

  it('rejects an output mutation even when the checksum manifest is refreshed', () => {
    const root = mkdtempSync(join(tmpdir(), 'elements-qds-provenance-'))
    copyFixture(root)

    const outputPath = join(root, 'site/qds-web.css')
    const mutated = readFileSync(outputPath, 'utf8').replace(
      '--qds-space-2: 8px',
      '--qds-space-2: 9px',
    )
    writeFileSync(outputPath, mutated)

    const manifestPath = join(root, 'src/qds/qds-artifacts-manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      files: Array<{ path: string; sha256: string; bytes: number }>
    }
    const output = manifest.files.find((file) => file.path === 'site/qds-web.css')
    if (!output) throw new Error('Fixture manifest has no site QDS artifact')
    output.sha256 = createHash('sha256').update(mutated).digest('hex')
    output.bytes = Buffer.byteLength(mutated)
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    expect(() => verifyQdsArtifacts(root)).toThrow(/does not match its canonical source/i)
  })
})
