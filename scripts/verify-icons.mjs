#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const projectRoot = join(import.meta.dirname, '..')
const sourceRoot = join(projectRoot, 'scripts', 'icons')
const outputRoot = join(projectRoot, 'public', 'icons')
const failures = []

function pngSize(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const renders = [
  ['icon_16.png', 16],
  ['icon_32.png', 32],
  ['icon_48.png', 48],
  ['icon_128.png', 128],
  ['action_active_16.png', 16],
  ['action_active.png', 32],
  ['action_inactive_16.png', 16],
  ['action_inactive.png', 32],
  ['action_unavailable_16.png', 16],
  ['action_unavailable.png', 32],
]

for (const [file, expected] of renders) {
  const size = pngSize(await readFile(join(outputRoot, file)))
  if (!size || size.width !== expected || size.height !== expected) {
    failures.push(`${file} must be a ${expected}×${expected} PNG`)
  }
}

for (const source of ['icon.svg', 'icon_16.svg']) {
  const svg = await readFile(join(sourceRoot, source), 'utf8')
  if (!/viewBox="0 0 (?:128|32) (?:128|32)"/.test(svg)) {
    failures.push(`${source} needs a square viewBox`)
  }
  // Corners plus text lines are the Elements mark, not a generic toolbar glyph.
  if ((svg.match(/<path\b/g) ?? []).length < 3) {
    failures.push(`${source} no longer preserves the Elements mark geometry`)
  }
}

if (failures.length)
  throw new Error(`Icon verification failed:\n${failures.map((item) => `- ${item}`).join('\n')}`)

console.log(`Verified Elements mark and action icons at ${renders.length} required sizes.`)
