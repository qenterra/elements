#!/usr/bin/env node

import { access, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const projectRoot = join(import.meta.dirname, '..')
const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
const packageLock = JSON.parse(await readFile(join(projectRoot, 'package-lock.json'), 'utf8'))
const targets = ['chrome', 'firefox', 'safari']
const verifyReleaseArchives = process.argv.includes('--release')

if (
  packageLock.version !== packageJson.version ||
  packageLock.packages?.['']?.version !== packageJson.version
) {
  throw new Error('package.json and package-lock.json versions do not match')
}

for (const target of targets) {
  const output = join(projectRoot, '.output', `${target}-mv3`)
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'))
  if (manifest.version !== packageJson.version) {
    throw new Error(
      `${target} manifest has version ${manifest.version}; expected ${packageJson.version}`,
    )
  }
  if (
    !manifest.content_scripts?.some((entry) => entry.js?.includes('content-scripts/content.js'))
  ) {
    throw new Error(`${target} manifest is missing the Elements content script`)
  }
  await access(join(output, 'content-scripts', 'content.js'))
  await access(join(output, 'elements-ui.js'))
  await access(join(output, 'options.html'))
  await access(join(output, 'onboarding.html'))
}

if (verifyReleaseArchives) {
  for (const target of targets) {
    const archive = join(projectRoot, '.output', `elements-${packageJson.version}-${target}.zip`)
    const archiveStats = await stat(archive)
    if (!archiveStats.isFile() || archiveStats.size === 0) {
      throw new Error(`Release archive is missing or empty: ${archive}`)
    }
  }
}

const contentScriptBytes = (
  await stat(join(projectRoot, '.output/chrome-mv3/content-scripts/content.js'))
).size
if (contentScriptBytes > 100_000) {
  throw new Error(
    `Chrome content script is ${contentScriptBytes} bytes; the lazy UI boundary regressed`,
  )
}

const english = JSON.parse(
  await readFile(join(projectRoot, 'public/_locales/en/messages.json'), 'utf8'),
)
const russian = JSON.parse(
  await readFile(join(projectRoot, 'public/_locales/ru/messages.json'), 'utf8'),
)
const missingInRussian = Object.keys(english).filter((key) => !(key in russian))
const extraInRussian = Object.keys(russian).filter((key) => !(key in english))
if (missingInRussian.length || extraInRussian.length) {
  throw new Error(
    `Locale keys differ. Missing in Russian: ${missingInRussian.join(', ') || 'none'}; ` +
      `extra in Russian: ${extraInRussian.join(', ') || 'none'}`,
  )
}

console.log(
  `Verified ${targets.length} manifests, lazy UI boundary (${contentScriptBytes} B), ` +
    `required assets, version ${packageJson.version}, locale parity` +
    `${verifyReleaseArchives ? ', and release archives' : ''}.`,
)
