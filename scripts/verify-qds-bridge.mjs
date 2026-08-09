#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function verifyQdsBridge(projectRoot = defaultRoot, options = {}) {
  const sourcePath = join(projectRoot, options.source ?? 'src/qds/qds-tokens.css')
  const bridgePath = join(projectRoot, options.bridge ?? 'site/qds-web.css')
  const source = readFileSync(sourcePath, 'utf8')
  const bridge = readFileSync(bridgePath, 'utf8')
  if (bridge !== source) {
    throw new Error('QDS Web bridge content does not match the pinned local token snapshot')
  }
  const version = source.match(/QenTerra Design System ([0-9.]+)/)?.[1]
  if (!version) throw new Error('Pinned QDS version is missing from the canonical snapshot')
  const tokenCount = new Set(
    [...source.matchAll(/--qds-[a-z0-9-]+(?=\s*:)/gi)].map((match) => match[0]),
  ).size
  if (tokenCount < 100) throw new Error(`QDS token snapshot is incomplete: ${tokenCount} tokens`)
  return { version, tokenCount, hash: sha256(source) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyQdsBridge()
  console.log(
    `Verified QDS Web bridge ${result.version}: ${result.tokenCount} tokens, ${result.hash}.`,
  )
}
