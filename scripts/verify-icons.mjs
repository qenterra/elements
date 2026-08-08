#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const projectRoot = join(import.meta.dirname, '..')
const sourceRoot = join(projectRoot, 'scripts', 'icons')
const outputRoot = join(projectRoot, 'public', 'icons')
const failures = []

const renders = [
  ['icon_16.svg', 'icon_16.png', 16, 'mark'],
  ['icon.svg', 'icon_32.png', 32, 'mark'],
  ['icon.svg', 'icon_48.png', 48, 'mark'],
  ['icon.svg', 'icon_128.png', 128, 'mark'],
  ['action_active_16.svg', 'action_active_16.png', 16, 'action'],
  ['action_active.svg', 'action_active.png', 32, 'action'],
  ['action_inactive_16.svg', 'action_inactive_16.png', 16, 'action'],
  ['action_inactive.svg', 'action_inactive.png', 32, 'action'],
  ['action_unavailable_16.svg', 'action_unavailable_16.png', 16, 'action'],
  ['action_unavailable.svg', 'action_unavailable.png', 32, 'action'],
]

function pathData(svg) {
  return [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1])
}

function validatesSquareViewBox(svg, size) {
  return new RegExp(`viewBox="0 0 ${size} ${size}"`).test(svg)
}

function validateElementsMark(svg, source) {
  const paths = pathData(svg)
  const hasFramingPath = paths.some((path) => {
    const moves = (path.match(/[Mm]/g) ?? []).length
    return moves >= 4 && /[HhVv]/.test(path)
  })
  const horizontalRows = paths.filter((path) => /[Hh]/.test(path)).length
  if (!hasFramingPath || horizontalRows < 3) {
    failures.push(`${source} no longer preserves the Elements mark geometry`)
  }
}

function validateActionMark(svg, source) {
  const paths = pathData(svg)
  if (paths.length < 2 || !paths.some((path) => (path.match(/[Mm]/g) ?? []).length >= 4)) {
    failures.push(`${source} no longer preserves its framed Elements action mark`)
  }
}

for (const [source, output, expected, kind] of renders) {
  const svg = await readFile(join(sourceRoot, source), 'utf8')
  const sourceSize = source.endsWith('_16.svg') ? 32 : kind === 'mark' ? 128 : 32
  if (!validatesSquareViewBox(svg, sourceSize)) {
    failures.push(`${source} needs a ${sourceSize}×${sourceSize} square viewBox`)
  }
  if (kind === 'mark') validateElementsMark(svg, source)
  else validateActionMark(svg, source)

  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: expected } }).render()
  const renderedPng = Buffer.from(rendered.asPng())
  const committedPng = await readFile(join(outputRoot, output))
  let visiblePixels = 0
  const visibleColors = new Set()
  for (let index = 0; index < rendered.pixels.length; index += 4) {
    if (rendered.pixels[index + 3] === 0) continue
    visiblePixels += 1
    visibleColors.add(
      `${rendered.pixels[index]},${rendered.pixels[index + 1]},${rendered.pixels[index + 2]}`,
    )
  }
  if (
    rendered.width !== expected ||
    rendered.height !== expected ||
    visiblePixels === 0 ||
    visibleColors.size < 2
  ) {
    failures.push(`${output} must render non-empty content at ${expected}×${expected}`)
  }
  if (!committedPng.equals(renderedPng)) {
    failures.push(`${output} is stale; regenerate it from ${source} with npm run icons`)
  }
}

if (failures.length)
  throw new Error(`Icon verification failed:\n${failures.map((item) => `- ${item}`).join('\n')}`)

console.log(`Verified Elements mark and action icons at ${renders.length} required sizes.`)
