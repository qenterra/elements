#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const projectRoot = join(import.meta.dirname, '..')
const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
const changelog = await readFile(join(projectRoot, 'CHANGELOG.md'), 'utf8')
const tag = process.argv[2]
const outputPath = process.argv[3]
const expectedTag = `v${packageJson.version}`

if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag || '(missing)'} does not match ${expectedTag}`)
}
if (!outputPath) throw new Error('Release notes output path is required')

const headingPrefix = `## [${packageJson.version}] — `
const sectionStart = changelog.indexOf(headingPrefix)
if (sectionStart === -1) {
  throw new Error(`CHANGELOG.md has no ${packageJson.version} section`)
}
const headingEnd = changelog.indexOf('\n', sectionStart)
const heading = changelog.slice(sectionStart, headingEnd)
if (!/^## \[[^\]]+\] — \d{4}-\d{2}-\d{2}$/.test(heading)) {
  throw new Error(`CHANGELOG.md section ${packageJson.version} needs a release date`)
}
const nextSection = changelog.indexOf('\n## [', headingEnd + 1)
const releaseChanges = changelog
  .slice(headingEnd + 1, nextSection === -1 ? changelog.length : nextSection)
  .trim()

const targets = ['chrome', 'firefox', 'safari']
const archives = targets.map((target) => `elements-${packageJson.version}-${target}.zip`)
const checksums = []
for (const archive of archives) {
  const bytes = await readFile(join(projectRoot, '.output', archive))
  checksums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${archive}`)
}

const notes = `${releaseChanges}

## Downloads

- \`${archives[0]}\`: Chrome and Chromium browsers.
- \`${archives[1]}\`: Firefox development or self-distribution build.
- \`${archives[2]}\`: Safari WebExtension input for conversion and signing in Xcode.

The archives are unsigned. Store distribution requires the signing and review
process of each browser.

## SHA-256

\`\`\`text
${checksums.join('\n')}
\`\`\`

See the [full changelog](https://github.com/QenTerra/elements/blob/master/CHANGELOG.md).
`

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, notes)
console.log(`Wrote release notes for ${tag} to ${outputPath}`)
