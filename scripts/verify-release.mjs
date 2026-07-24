#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const packageJson = JSON.parse(
  await readFile(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
)
const tag = process.argv[2]
const expected = `v${packageJson.version}`

if (!tag) throw new Error(`Release tag is required; expected ${expected}`)
if (tag !== expected)
  throw new Error(`Release tag ${tag} does not match package version ${expected}`)

console.log(`Release tag ${tag} matches package version ${packageJson.version}.`)
