#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
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
const SIZE = /^(?:width|height|min-width|min-height)$/
const CONTROL_SELECTOR =
  /(?:button|btn|control|toggle|switch|input|select|textarea|action|nav(?:igation)?-item|menuitem|keycap|radio|checkbox|close)/i

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

function declarationFindings(path, text) {
  const findings = []
  const blocks = [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  for (const block of blocks) {
    const selector = block[1].trim()
    const body = block[2]
    for (const declaration of body.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/gi)) {
      const property = declaration[1].toLowerCase()
      const value = declaration[2].trim()
      const line = text.slice(0, (block.index ?? 0) + (declaration.index ?? 0)).split('\n').length
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
      if (SIZE.test(property) && CONTROL_SELECTOR.test(selector)) {
        pushMatches('raw-component-size', LENGTH)
      }
    }
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

export function auditQdsConsumer({ projectRoot, sourceRoots, exceptions }) {
  const canonical = new Map(
    exceptions
      .filter((exception) => exception.rule === 'canonical-snapshot')
      .map((exception) => [exception.path, exception.sha256]),
  )
  const findings = []
  for (const file of sourceRoots.flatMap((root) => filesUnder(resolve(projectRoot, root)))) {
    if (!SOURCE_EXTENSIONS.has(extname(file))) continue
    const path = relative(projectRoot, file).split('\\').join('/') || file.split('/').at(-1)
    const text = readFileSync(file, 'utf8')
    const canonicalHash = canonical.get(path)
    if (canonicalHash && canonicalHash === sha256(text)) continue
    const declarations = declarationFindings(path, text)
    findings.push(...declarations)
    findings.push(...sourceColorFindings(path, text, declarations))
    findings.push(...sourceDurationFindings(path, text))
  }
  const unique = [
    ...new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values(),
  ]
  return unique.filter((finding) => !exactException(finding, exceptions))
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const projectRoot = resolve(dirname(scriptPath), '..')
  const manifest = JSON.parse(readFileSync(join(projectRoot, 'qds-consumer.json'), 'utf8'))
  const registryPath = join(projectRoot, 'qds-metric-exceptions.json')
  const exceptions = existsSync(registryPath)
    ? JSON.parse(readFileSync(registryPath, 'utf8')).exceptions
    : []
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
