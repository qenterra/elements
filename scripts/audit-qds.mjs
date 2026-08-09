#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(import.meta.dirname, '..')
const qdsRoot = resolve(process.env.QDS_ROOT ?? resolve(projectRoot, '../design-system'))
const doctor = resolve(qdsRoot, 'scripts/audit_consumer.py')
const localAudit = resolve(projectRoot, 'scripts/qds-local-audit.mjs')

if (!existsSync(doctor)) {
  throw new Error(
    `QDS consumer doctor is unavailable at ${doctor}. Set QDS_ROOT to a local QenTerra design-system checkout.`,
  )
}

const localResult = spawnSync(process.execPath, [localAudit], { stdio: 'inherit' })
if ((localResult.status ?? 1) !== 0) {
  process.exitCode = localResult.status ?? 1
} else {
  const result = spawnSync('python3', [doctor, projectRoot, ...process.argv.slice(2)], {
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}
