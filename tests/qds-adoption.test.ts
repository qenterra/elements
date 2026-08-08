import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '..')
const adapterPath = resolve(projectRoot, 'src/qds/adapter/shadow-dom.ts')
const tokenPath = resolve(projectRoot, 'src/qds/qds-tokens.css')
const overlayPath = resolve(projectRoot, 'src/content/ui.tsx')
const manifestPath = resolve(projectRoot, 'qds-consumer.json')
const exceptionsPath = resolve(projectRoot, 'qds-exceptions.json')
const profilePath = resolve(projectRoot, 'docs/qds-product-profile.md')

describe('QDS Shadow DOM adoption', () => {
  it('ships a local QDS adapter and mounts it in the isolated picker', () => {
    expect(existsSync(adapterPath)).toBe(true)
    expect(existsSync(tokenPath)).toBe(true)
    expect(existsSync(manifestPath)).toBe(true)
    expect(existsSync(exceptionsPath)).toBe(true)
    expect(existsSync(profilePath)).toBe(true)
    expect(readFileSync(overlayPath, 'utf8')).toContain('qdsShadowDomStyles')
    expect(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).toContain('qds:doctor')
  })
})
