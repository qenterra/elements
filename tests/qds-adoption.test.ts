import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '..')
const adapterPath = resolve(projectRoot, 'src/qds/adapter/shadow-dom.ts')
const tokenPath = resolve(projectRoot, 'src/qds/qds-tokens.css')
const pickerStylesheetPath = resolve(projectRoot, 'src/content/content.css')
const overlayPath = resolve(projectRoot, 'src/content/ui.tsx')
const manifestPath = resolve(projectRoot, 'qds-consumer.json')
const exceptionsPath = resolve(projectRoot, 'qds-exceptions.json')
const profilePath = resolve(projectRoot, 'docs/qds-product-profile.md')
const metricExceptionsPath = resolve(projectRoot, 'qds-metric-exceptions.json')

type DocumentedException = { id: string; path: string }

function documentedExceptions(profile: string): DocumentedException[] {
  const afterHeading = profile.split(/^## Exceptions\n/m)[1] ?? ''
  const section = afterHeading.split(/^## /m)[0] ?? ''
  return [...section.matchAll(/^- `([^`]+)` — `([^`]+)`$/gm)].map((match) => ({
    id: match[1],
    path: match[2],
  }))
}

describe('QDS Shadow DOM adoption', () => {
  it('ships a local QDS adapter and mounts it in the isolated picker', () => {
    expect(existsSync(adapterPath)).toBe(true)
    expect(existsSync(tokenPath)).toBe(true)
    expect(existsSync(manifestPath)).toBe(true)
    expect(existsSync(exceptionsPath)).toBe(true)
    expect(existsSync(profilePath)).toBe(true)
    expect(existsSync(metricExceptionsPath)).toBe(true)
    expect(readFileSync(overlayPath, 'utf8')).toContain('qdsShadowDomStyles')
    expect(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).toContain('qds:doctor')
  })

  it('requires property-and-value precision for local metric and platform exceptions', () => {
    const registry = JSON.parse(readFileSync(metricExceptionsPath, 'utf8')) as {
      exceptions: Array<Record<string, unknown>>
    }
    expect(registry.exceptions.length).toBeGreaterThan(0)
    for (const exception of registry.exceptions) {
      expect(exception.path).toEqual(expect.any(String))
      expect(exception.property).toEqual(expect.any(String))
      expect(exception.value).toEqual(expect.any(String))
      expect(exception.reason).toEqual(expect.any(String))
      expect(exception.migrationTrigger).toEqual(expect.any(String))
      if (exception.rule === 'canonical-snapshot') {
        expect(exception.sha256).toMatch(/^[a-f0-9]{64}$/)
      }
    }
  })

  it('audits every product UI root and records only path-level raw-token debt', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8'))

    expect(manifest.sourceRoots).toEqual(['src', 'entrypoints', 'site'])
    expect(existsSync(pickerStylesheetPath)).toBe(true)
    expect(readFileSync(overlayPath, 'utf8')).toContain('./content.css?raw')
    const exceptionPaths = exceptions.exceptions.map(
      (exception: { path: string }) => exception.path,
    )
    expect(exceptionPaths).toContain('src/qds/qds-tokens.css')
    expect(exceptionPaths).not.toContain('src/theme/tokens.css')
  })

  it('keeps the product profile aligned with the authoritative exception registry', () => {
    const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8')) as {
      exceptions: Array<{ id: string; path: string }>
    }
    const profile = readFileSync(profilePath, 'utf8')
    const documented = documentedExceptions(profile)
    const documentedPairs = new Set(documented.map(({ id, path }) => `${id}\u0000${path}`))
    const registry = exceptions.exceptions.map(({ id, path }) => ({ id, path }))

    expect(profile).toContain('`qds-exceptions.json`')
    expect(documentedPairs.size).toBe(documented.length)
    expect(documented).toEqual(registry)
  })
})
