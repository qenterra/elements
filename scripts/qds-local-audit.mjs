#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_EXTENSIONS = new Set(['.css', '.html', '.js', '.jsx', '.ts', '.tsx'])
const COLOR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi
const LENGTH = /(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/gi
const DURATION = /(?<![\w-])(?:\d*\.)?\d+(?:ms|s)\b/gi
const NUMBER = /^-?(?:\d*\.)?\d+$/
const SPACING =
  /^(?:margin|padding)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$|^(?:gap|row-gap|column-gap)$/
const RADIUS = /^border(?:-(?:top|bottom)-(?:left|right))?-radius$/
const TYPOGRAPHY = /^(?:font|font-family|font-size|font-weight|line-height|letter-spacing)$/
const SIZE =
  /^(?:width|height|min-width|min-height|max-width|max-height|(?:min-|max-)?(?:inline-size|block-size))$/
const LAYOUT_SIZE =
  /^(?:flex-basis|column-width|grid-auto-columns|grid-auto-rows|grid-template-columns|grid-template-rows)$/
const STROKE =
  /^(?:border(?:-(?:block|inline)(?:-(?:start|end))?|-(?:top|right|bottom|left))?(?:-width)?|column-rule(?:-width)?|outline|outline-width|outline-offset|stroke-width|text-decoration-thickness)$/
const POSITION = /^(?:top|right|bottom|left|inset|inset-(?:block|inline)(?:-(?:start|end))?)$/
const METRIC_RULES = new Set([
  'canonical-snapshot',
  'raw-color',
  'raw-duration',
  'raw-radius',
  'raw-spacing',
  'raw-component-size',
  'raw-typography',
  'raw-stroke',
  'raw-position',
])
const UPSTREAM_RULES = new Set(['raw-color', 'missing-swift-adapter', 'missing-css-adapter'])

function filesUnder(root) {
  if (!existsSync(root)) return []
  if (statSync(root).isFile()) return [root]
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    entry.name === 'node_modules' || entry.name.startsWith('.output') || entry.name === 'artifacts'
      ? []
      : filesUnder(join(root, entry.name)),
  )
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length
}

function declarationBodyFindings(path, text, body, bodyOffset) {
  const findings = []
  for (const declaration of body.matchAll(/((?:--)?[a-z][a-z0-9-]*)\s*:\s*([^;{}]+)/gi)) {
    const property = declaration[1].toLowerCase()
    const value = declaration[2].trim()
    const line = lineAt(text, bodyOffset + (declaration.index ?? 0))
    const pushMatches = (rule, pattern) => {
      for (const match of value.matchAll(pattern)) {
        if (/^-?0(?:px|rem|em|ms|s)?$/i.test(match[0])) continue
        findings.push({ rule, path, line, property, value: match[0] })
      }
    }
    pushMatches('raw-color', COLOR)
    if (
      /^(?:animation|animation-delay|animation-duration|transition|transition-delay|transition-duration)$/.test(
        property,
      )
    ) {
      pushMatches('raw-duration', DURATION)
    }
    if (RADIUS.test(property)) pushMatches('raw-radius', LENGTH)
    if (SPACING.test(property)) pushMatches('raw-spacing', LENGTH)
    if (TYPOGRAPHY.test(property)) {
      if (property === 'line-height' && NUMBER.test(value) && value !== '0') {
        findings.push({ rule: 'raw-typography', path, line, property, value })
      } else if (property === 'font-weight' && /^\d+$/.test(value)) {
        findings.push({ rule: 'raw-typography', path, line, property, value })
      } else if (value !== 'inherit' && !value.includes('var(--qds-')) {
        pushMatches('raw-typography', LENGTH)
        if (property === 'font-family' || property === 'font') {
          findings.push({ rule: 'raw-typography', path, line, property, value })
        }
      }
    }
    if (SIZE.test(property) || LAYOUT_SIZE.test(property)) {
      pushMatches('raw-component-size', LENGTH)
    }
    if (STROKE.test(property)) pushMatches('raw-stroke', LENGTH)
    if (POSITION.test(property)) pushMatches('raw-position', LENGTH)
    // Product aliases must not hide a raw metric from the audit. Canonical QDS snapshots
    // are hash-gated and skipped before this collector runs.
    if (
      property.startsWith('--') &&
      !/(?:shadow|elevation)/.test(property) &&
      !findings.some(
        (finding) =>
          finding.line === line && finding.property === property && finding.rule !== 'raw-color',
      )
    ) {
      pushMatches('raw-component-size', LENGTH)
    }
  }
  return findings
}

function declarationFindings(path, text) {
  const findings = []
  for (const block of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = block[2]
    const bodyOffset = (block.index ?? 0) + block[0].indexOf(body)
    findings.push(...declarationBodyFindings(path, text, body, bodyOffset))
  }
  for (const attribute of text.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    const body = attribute[2]
    const bodyOffset = (attribute.index ?? 0) + attribute[0].indexOf(body)
    findings.push(...declarationBodyFindings(path, text, body, bodyOffset))
  }
  return findings
}

function sourceColorFindings(path, text, declarationColors) {
  if (extname(path) === '.css' || extname(path) === '.html') return []
  const already = new Set(declarationColors.map((finding) => `${finding.line}:${finding.value}`))
  return text
    .split('\n')
    .flatMap((lineText, index) =>
      [...lineText.matchAll(COLOR)].flatMap((match) =>
        already.has(`${index + 1}:${match[0]}`)
          ? []
          : [{ rule: 'raw-color', path, line: index + 1, property: 'source', value: match[0] }],
      ),
    )
}

function sourceDurationFindings(path, text) {
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(extname(path))) return []
  return text.split('\n').flatMap((lineText, index) => {
    if (!/\bduration\s*:|\b(?:\d*\.)?\d+(?:ms|s)\b/.test(lineText)) return []
    return [...lineText.matchAll(/\bduration\s*:\s*(\d+)|\b(?:\d*\.)?\d+(?:ms|s)\b/g)].map(
      (match) => ({
        rule: 'raw-duration',
        path,
        line: index + 1,
        property: 'source-duration',
        value: match[1] ?? match[0],
      }),
    )
  })
}

function exactException(finding, exceptions) {
  return exceptions.some(
    (exception) =>
      exception.rule === finding.rule &&
      exception.path === finding.path &&
      exception.property === finding.property &&
      exception.value.toLowerCase() === finding.value.toLowerCase(),
  )
}

function collectQdsFindings({ projectRoot, sourceRoots, canonical = [] }) {
  const canonicalFiles = new Map(
    canonical
      .filter((exception) => exception.rule === 'canonical-snapshot')
      .map((exception) => [exception.path, exception.sha256]),
  )
  const findings = []
  for (const file of sourceRoots.flatMap((root) => filesUnder(resolve(projectRoot, root)))) {
    if (!SOURCE_EXTENSIONS.has(extname(file))) continue
    const path = relative(projectRoot, file).split('\\').join('/') || file.split('/').at(-1)
    const text = readFileSync(file, 'utf8')
    const canonicalHash = canonicalFiles.get(path)
    if (canonicalHash && canonicalHash === sha256(text)) continue
    const declarations = declarationFindings(path, text)
    findings.push(...declarations)
    findings.push(...sourceColorFindings(path, text, declarations))
    findings.push(...sourceDurationFindings(path, text))
  }
  const unique = [
    ...new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values(),
  ]
  return unique
}

export function auditQdsConsumer({ projectRoot, sourceRoots, exceptions }) {
  return collectQdsFindings({ projectRoot, sourceRoots, canonical: exceptions }).filter(
    (finding) => !exactException(finding, exceptions),
  )
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function unknownFields(value, allowed) {
  return plainObject(value) ? Object.keys(value).filter((key) => !allowed.has(key)) : []
}

function validRelativePath(projectRoot, path) {
  if (typeof path !== 'string' || !path.trim() || isAbsolute(path)) return false
  const resolved = resolve(projectRoot, path)
  const back = relative(projectRoot, resolved)
  return back !== '..' && !back.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
}

function pathInSourceRoots(projectRoot, sourceRoots, path) {
  const target = resolve(projectRoot, path)
  return sourceRoots.some((root) => {
    const sourceRoot = resolve(projectRoot, root)
    const back = relative(sourceRoot, target)
    return back === '' || (back !== '..' && !back.startsWith('../') && !isAbsolute(back))
  })
}

function validateMetricRegistry(projectRoot, sourceRoots, registry, rawFindings) {
  const errors = []
  if (!plainObject(registry)) return ['qds-metric-exceptions registry must be an object']
  for (const field of unknownFields(registry, new Set(['schemaVersion', 'exceptions']))) {
    errors.push(`qds-metric-exceptions has unknown field ${field}`)
  }
  if (registry.schemaVersion !== 1) errors.push('qds-metric-exceptions schemaVersion must be 1')
  if (!Array.isArray(registry.exceptions))
    return [...errors, 'qds-metric-exceptions exceptions must be an array']

  const ids = new Set()
  const signatures = new Set()
  for (const [index, exception] of registry.exceptions.entries()) {
    const label = `qds-metric-exceptions[${index}]`
    if (!plainObject(exception)) {
      errors.push(`${label} must be an object`)
      continue
    }
    const canonical = exception.rule === 'canonical-snapshot'
    const allowed = new Set([
      'id',
      'rule',
      'path',
      'property',
      'value',
      'reason',
      'migrationTrigger',
      ...(canonical ? ['sha256'] : []),
    ])
    for (const field of unknownFields(exception, allowed))
      errors.push(`${label} has unknown field ${field}`)
    for (const field of ['id', 'rule', 'path', 'property', 'value', 'reason', 'migrationTrigger']) {
      if (typeof exception[field] !== 'string' || !exception[field].trim())
        errors.push(`${label} ${field} must be a non-empty string`)
    }
    if (!METRIC_RULES.has(exception.rule)) errors.push(`${label} rule is not recognized`)
    if (ids.has(exception.id)) errors.push(`${label} duplicate id ${exception.id}`)
    ids.add(exception.id)
    const signature = [exception.rule, exception.path, exception.property, exception.value]
      .join('\0')
      .toLowerCase()
    if (signatures.has(signature)) errors.push(`${label} duplicate exception signature`)
    signatures.add(signature)
    if (!validRelativePath(projectRoot, exception.path)) {
      errors.push(`${label} path must be a project-relative canonical path`)
    } else if (!pathInSourceRoots(projectRoot, sourceRoots, exception.path)) {
      errors.push(`${label} path is outside the declared source roots`)
    }
    const target = typeof exception.path === 'string' ? resolve(projectRoot, exception.path) : ''
    if (!target || !existsSync(target) || !statSync(target).isFile()) {
      errors.push(`${label} ${canonical ? 'canonical ' : ''}path does not exist`)
    }
    if (canonical) {
      if (exception.property !== '*' || exception.value !== '*')
        errors.push(`${label} canonical snapshot property and value must be *`)
      if (typeof exception.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(exception.sha256)) {
        errors.push(`${label} sha256 must be a lowercase 64-character digest`)
      } else if (
        target &&
        existsSync(target) &&
        sha256(readFileSync(target, 'utf8')) !== exception.sha256
      ) {
        errors.push(`${label} canonical snapshot sha256 does not match ${exception.path}`)
      }
    } else if (!rawFindings.some((finding) => exactException(finding, [exception]))) {
      errors.push(`${label} unused exact exception`)
    }
  }
  return errors
}

function validateUpstreamRegistry(projectRoot, sourceRoots, registry, adapters, expectedAdapters) {
  const errors = []
  if (!plainObject(registry)) return ['qds-exceptions registry must be an object']
  for (const field of unknownFields(registry, new Set(['schemaVersion', 'exceptions']))) {
    errors.push(`qds-exceptions has unknown field ${field}`)
  }
  if (registry.schemaVersion !== 1) errors.push('qds-exceptions schemaVersion must be 1')
  if (!Array.isArray(registry.exceptions))
    return [...errors, 'qds-exceptions exceptions must be an array']
  const ids = new Set()
  const signatures = new Set()
  for (const [index, exception] of registry.exceptions.entries()) {
    const label = `qds-exceptions[${index}]`
    if (!plainObject(exception)) {
      errors.push(`${label} must be an object`)
      continue
    }
    const allowed = new Set(['id', 'rule', 'path', 'reason', 'reviewTrigger'])
    for (const field of unknownFields(exception, allowed))
      errors.push(`${label} has unknown field ${field}`)
    for (const field of allowed) {
      if (typeof exception[field] !== 'string' || !exception[field].trim())
        errors.push(`${label} ${field} must be a non-empty string`)
    }
    if (!UPSTREAM_RULES.has(exception.rule)) errors.push(`${label} rule is not recognized`)
    if (ids.has(exception.id)) errors.push(`${label} duplicate id ${exception.id}`)
    ids.add(exception.id)
    const signature = [exception.rule, exception.path].join('\0').toLowerCase()
    if (signatures.has(signature)) errors.push(`${label} duplicate exception signature`)
    signatures.add(signature)
    if (exception.path !== '*' && !validRelativePath(projectRoot, exception.path))
      errors.push(`${label} path must be project-relative or *`)
    if (exception.path !== '*' && !pathInSourceRoots(projectRoot, sourceRoots, exception.path)) {
      errors.push(`${label} path is outside the declared source roots`)
    }
    if (exception.rule === 'raw-color' && exception.path === '*') {
      errors.push(`${label} raw-color path must name an exact source file`)
    }
    if (exception.rule?.startsWith('missing-') && exception.path !== '*') {
      errors.push(`${label} adapter exception path must be *`)
    }
    if (exception.path !== '*') {
      const target = resolve(projectRoot, exception.path)
      if (!existsSync(target) || !statSync(target).isFile()) {
        errors.push(`${label} path does not exist`)
      } else if (exception.rule === 'raw-color') {
        COLOR.lastIndex = 0
        if (!COLOR.test(readFileSync(target, 'utf8'))) {
          errors.push(`${label} unused raw-color exception`)
        }
      }
      COLOR.lastIndex = 0
    } else if (
      exception.rule === 'missing-swift-adapter' &&
      (!expectedAdapters.swift || adapters.swift)
    ) {
      errors.push(`${label} unused missing-swift-adapter exception`)
    } else if (
      exception.rule === 'missing-css-adapter' &&
      (!expectedAdapters.css || adapters.css)
    ) {
      errors.push(`${label} unused missing-css-adapter exception`)
    }
  }
  return errors
}

export function validateExceptionRegistries({
  projectRoot,
  sourceRoots,
  metricRegistry,
  upstreamRegistry,
}) {
  const metricExceptions =
    plainObject(metricRegistry) && Array.isArray(metricRegistry.exceptions)
      ? metricRegistry.exceptions
      : []
  const rawFindings = collectQdsFindings({
    projectRoot,
    sourceRoots,
    canonical: metricExceptions,
  })
  const sourceTexts = sourceRoots
    .flatMap((root) => filesUnder(resolve(projectRoot, root)))
    .filter((file) => SOURCE_EXTENSIONS.has(extname(file)))
    .map((file) => readFileSync(file, 'utf8'))
  const adapters = {
    swift: sourceTexts.some((text) => text.includes('import QenTerraDesignTokens')),
    css: sourceTexts.some(
      (text) => text.includes('@qenterra/design-tokens') || text.includes('qds-tokens.css'),
    ),
  }
  const consumerPath = join(projectRoot, 'qds-consumer.json')
  const expectedAdapters = existsSync(consumerPath)
    ? (JSON.parse(readFileSync(consumerPath, 'utf8')).adapters ?? {})
    : {}
  return [
    ...validateMetricRegistry(projectRoot, sourceRoots, metricRegistry, rawFindings),
    ...validateUpstreamRegistry(
      projectRoot,
      sourceRoots,
      upstreamRegistry,
      adapters,
      expectedAdapters,
    ),
  ]
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const projectRoot = resolve(dirname(scriptPath), '..')
  const manifest = JSON.parse(readFileSync(join(projectRoot, 'qds-consumer.json'), 'utf8'))
  const registryPath = join(projectRoot, 'qds-metric-exceptions.json')
  const metricRegistry = existsSync(registryPath)
    ? JSON.parse(readFileSync(registryPath, 'utf8'))
    : { schemaVersion: 1, exceptions: [] }
  const upstreamRegistry = JSON.parse(
    readFileSync(join(projectRoot, manifest.exceptions ?? 'qds-exceptions.json'), 'utf8'),
  )
  const governanceErrors = validateExceptionRegistries({
    projectRoot,
    sourceRoots: manifest.sourceRoots,
    metricRegistry,
    upstreamRegistry,
  })
  if (governanceErrors.length) {
    console.error(JSON.stringify({ status: 'failed', governanceErrors }, null, 2))
    process.exitCode = 1
    process.exit()
  }
  const exceptions = metricRegistry.exceptions
  const findings = auditQdsConsumer({
    projectRoot,
    sourceRoots: manifest.sourceRoots,
    exceptions,
  })
  if (findings.length) {
    console.error(JSON.stringify({ status: 'failed', findings }, null, 2))
    process.exitCode = 1
  } else {
    console.log(
      JSON.stringify(
        { status: 'passed', roots: manifest.sourceRoots, exceptions: exceptions.length },
        null,
        2,
      ),
    )
  }
}
