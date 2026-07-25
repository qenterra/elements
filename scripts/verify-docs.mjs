#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'

const projectRoot = join(import.meta.dirname, '..')
const ignoredDirectories = new Set(['.git', '.output', 'node_modules'])

async function collectMarkdown(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await collectMarkdown(join(directory, entry.name))))
      }
    } else if (entry.isFile() && extname(entry.name) === '.md') {
      files.push(join(directory, entry.name))
    }
  }
  return files
}

function localTargets(markdown) {
  const targets = []
  for (const match of markdown.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)) targets.push(match[1])
  for (const match of markdown.matchAll(/<(?:img|a)\b[^>]*(?:src|href)="([^"]+)"/g)) {
    targets.push(match[1])
  }
  return targets.filter(
    (target) =>
      target &&
      !target.startsWith('#') &&
      !target.startsWith('https://') &&
      !target.startsWith('http://') &&
      !target.startsWith('mailto:'),
  )
}

const markdownFiles = await collectMarkdown(projectRoot)
const brokenLinks = []
for (const file of markdownFiles) {
  const markdown = await readFile(file, 'utf8')
  for (const target of localTargets(markdown)) {
    const pathWithoutAnchor = decodeURIComponent(target.split('#')[0].split('?')[0])
    if (!pathWithoutAnchor) continue
    const destination = resolve(dirname(file), pathWithoutAnchor)
    try {
      await access(destination)
    } catch {
      brokenLinks.push(`${file.slice(projectRoot.length + 1)} -> ${target}`)
    }
  }
}
if (brokenLinks.length) {
  throw new Error(`Broken local documentation links:\n${brokenLinks.join('\n')}`)
}

const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
const [major, minor] = packageJson.version.split('.')
const shortVersion = `${major}.${minor}`
const readme = await readFile(join(projectRoot, 'README.md'), 'utf8')
const changelog = await readFile(join(projectRoot, 'CHANGELOG.md'), 'utf8')
const security = await readFile(join(projectRoot, 'SECURITY.md'), 'utf8')
const notices = await readFile(join(projectRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8')

if (!changelog.includes(`## [${packageJson.version}]`)) {
  throw new Error(`CHANGELOG.md has no ${packageJson.version} section`)
}
if (!security.includes(`| ${shortVersion}.x`)) {
  throw new Error(`SECURITY.md does not mark ${shortVersion}.x as supported`)
}
for (const target of ['chrome', 'firefox', 'safari']) {
  const archive = `elements-${packageJson.version}-${target}.zip`
  if (!readme.includes(archive)) throw new Error(`README.md does not mention ${archive}`)
}

const dependencies = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
]
const missingNotices = dependencies.filter((name) => !notices.includes(`\`${name}\``))
if (missingNotices.length) {
  throw new Error(`THIRD_PARTY_NOTICES.md is missing: ${missingNotices.join(', ')}`)
}

console.log(
  `Verified ${markdownFiles.length} Markdown files, release version ${packageJson.version}, ` +
    `browser archive links, and ${dependencies.length} direct dependency notices.`,
)
