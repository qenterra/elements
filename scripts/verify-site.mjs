#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const siteRoot = join(projectRoot, 'site')
const siteFile = join(siteRoot, 'index.html')
const html = await readFile(siteFile, 'utf8')
const errors = []

function requirePattern(pattern, message) {
  if (!pattern.test(html)) errors.push(message)
}

function rejectPattern(pattern, message) {
  if (pattern.test(html)) errors.push(message)
}

const requiredSections = ['main', 'demo', 'features', 'privacy', 'download', 'technical']
for (const id of requiredSections) {
  requirePattern(new RegExp(`\\bid="${id}"`), `Missing #${id} landmark or section`)
}

const headingCount = [...html.matchAll(/<h1\b/g)].length
if (headingCount !== 1) errors.push(`Expected one h1, found ${headingCount}`)

requirePattern(/class="skip-link"/, 'Missing skip link')
requirePattern(/role="tablist"/, 'Missing product-tour tablist')
requirePattern(/aria-live="polite"/, 'Missing live demo status')
requirePattern(/data-actions=""/, 'Demo must expose a composable action state')
requirePattern(/images\/picker-panel-dark\.png/, 'Missing focused picker-panel hero image')
requirePattern(
  /data-tour-image="picker"[\s\S]*data-tour-image="options"[\s\S]*data-tour-image="narrow"/,
  'Product tour must preload all three interface screenshots',
)
requirePattern(/prefers-reduced-motion:\s*reduce/, 'Missing reduced-motion styles')
requirePattern(
  /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/,
  'Missing reduced-motion script',
)
requirePattern(/<noscript>/, 'Missing no-script fallback')
requirePattern(
  /https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@3\.15\.0\/dist\/gsap\.min\.js/,
  'GSAP must be pinned to 3.15.0',
)
requirePattern(
  /https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@3\.15\.0\/dist\/ScrollTrigger\.min\.js/,
  'ScrollTrigger must be pinned to 3.15.0',
)
requirePattern(/integrity="sha384-[^"]+"/, 'External scripts must use subresource integrity')
requirePattern(
  /elements-1\.2\.1-chrome\.zip[\s\S]*elements-1\.2\.1-firefox\.zip[\s\S]*elements-1\.2\.1-safari\.zip/,
  'Missing one or more versioned browser archives',
)

rejectPattern(/\bv1\.1(?!\.0)\b/, 'Found a standalone v1.1 reference')
rejectPattern(/\belements-1\.1-sources\.zip\b/, 'Found the deleted duplicate source archive')
rejectPattern(/\b(?:lorem ipsum|placeholder|coming soon|tbd)\b/i, 'Found placeholder copy')

const localAssets = new Set()
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const target = match[1]
  if (
    target.startsWith('#') ||
    target.startsWith('https://') ||
    target.startsWith('http://') ||
    target.startsWith('mailto:')
  ) {
    continue
  }
  localAssets.add(target.split(/[?#]/)[0])
}

for (const target of localAssets) {
  const asset = resolve(siteRoot, target)
  if (!asset.startsWith(`${siteRoot}/`)) {
    errors.push(`Local asset escapes site/: ${target}`)
    continue
  }
  try {
    await access(asset)
  } catch {
    errors.push(`Missing local asset: ${target}`)
  }
}

const externalScripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(
  (match) => match[1],
)
for (const script of externalScripts) {
  if (!script.startsWith('https://cdn.jsdelivr.net/npm/gsap@3.15.0/')) {
    errors.push(`Unexpected external script: ${script}`)
  }
}

const images = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0])
for (const image of images) {
  if (!/\balt="[^"]*"/.test(image)) errors.push(`Image has no alt attribute: ${image}`)
  if (!/\bwidth="\d+"/.test(image) || !/\bheight="\d+"/.test(image)) {
    errors.push(`Image has no intrinsic dimensions: ${image}`)
  }
}

if (errors.length) {
  throw new Error(`Site verification failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
}

console.log(
  `Verified Pages site: ${requiredSections.length} sections, ${localAssets.size} local assets, ` +
    `${images.length} images, pinned GSAP, reduced motion, downloads, and release references.`,
)
