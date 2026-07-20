#!/usr/bin/env node
// Renders the SVG branding sources in scripts/icons to the PNGs the manifest
// references. Cross-platform (resvg), so CI can regenerate icons on Linux.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = join(projectDirectory, 'scripts/icons')
const outputDirectory = join(projectDirectory, 'public/icons')

// 16px targets use dedicated sources with two text rows and thicker strokes
// so the mark stays legible at toolbar size.
const jobs = [
  { source: 'icon_16.svg', output: 'icon_16.png', size: 16 },
  { source: 'icon.svg', output: 'icon_32.png', size: 32 },
  { source: 'icon.svg', output: 'icon_48.png', size: 48 },
  { source: 'icon.svg', output: 'icon_128.png', size: 128 },
  { source: 'action_active_16.svg', output: 'action_active_16.png', size: 16 },
  { source: 'action_active.svg', output: 'action_active.png', size: 32 },
  { source: 'action_inactive_16.svg', output: 'action_inactive_16.png', size: 16 },
  { source: 'action_inactive.svg', output: 'action_inactive.png', size: 32 },
  { source: 'action_unavailable_16.svg', output: 'action_unavailable_16.png', size: 16 },
  { source: 'action_unavailable.svg', output: 'action_unavailable.png', size: 32 },
]

for (const job of jobs) {
  const svg = await readFile(join(sourceDirectory, job.source))
  const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: job.size } }).render()
  await writeFile(join(outputDirectory, job.output), rendered.asPng())
  console.log(`Rendered ${job.output} (${job.size}x${job.size})`)
}
