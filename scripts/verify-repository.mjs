#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const excludedRoots = new Set([
  '.build',
  '.cache',
  '.git',
  '.gradle',
  '.hypothesis',
  '.mypy_cache',
  '.next',
  '.nox',
  '.npm',
  '.nuxt',
  '.output',
  '.parcel-cache',
  '.pnpm-store',
  '.pytest_cache',
  '.ruff_cache',
  '.sass-cache',
  '.swiftpm',
  '.tox',
  '.turbo',
  '.venv',
  '.wxt',
  '__pycache__',
  'coverage',
  'htmlcov',
  'node_modules',
  'playwright-report',
  'target',
  'test-results',
  'tmp',
  'venv',
])

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: options.env ?? process.env,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed${signal ? ` with ${signal}` : ` with exit ${code}`}`,
        ),
      )
    })
  })
}

function copyFilter(source) {
  const local = relative(repositoryRoot, source)
  if (!local) return true
  const parts = local.split(sep)
  if (excludedRoots.has(parts[0])) return false
  if (parts[0] === 'artifacts' && parts[1] === 'qa') return false
  return true
}

const scratchRoot = await mkdtemp(join(tmpdir(), 'elements-verify-'))
const workspace = join(scratchRoot, 'workspace')
const npmCache = join(scratchRoot, 'npm-cache')
const playwrightBrowsers = join(scratchRoot, 'playwright-browsers')
const releaseNotes = join(scratchRoot, 'release-notes.md')
const keepWorkspace = process.env.ELEMENTS_KEEP_VERIFY_WORKSPACE === '1'

try {
  await run(
    'python3',
    ['scripts/qenterra_repository_check.py', 'audit', '--root', '.', '--format', 'markdown'],
    {
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    },
  )

  await mkdir(workspace)
  await cp(repositoryRoot, workspace, {
    recursive: true,
    filter: copyFilter,
    preserveTimestamps: true,
  })

  const isolatedEnvironment = {
    ...process.env,
    CI: process.env.CI ?? '1',
    npm_config_cache: npmCache,
    PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsers,
  }

  await run('npm', ['ci', '--cache', npmCache], {
    cwd: workspace,
    env: isolatedEnvironment,
  })
  await run('npm', ['run', 'validate'], { cwd: workspace, env: isolatedEnvironment })
  await run('npm', ['run', 'audit:all'], { cwd: workspace, env: isolatedEnvironment })
  await run('npm', ['run', 'build:chrome'], { cwd: workspace, env: isolatedEnvironment })
  await run('npm', ['run', 'verify:build'], { cwd: workspace, env: isolatedEnvironment })

  const installArguments = ['--no-install', 'playwright', 'install']
  if (process.platform === 'linux') installArguments.push('--with-deps')
  installArguments.push('--no-shell', 'chromium')
  await run('npx', installArguments, { cwd: workspace, env: isolatedEnvironment })
  await run('npm', ['run', 'test:e2e'], { cwd: workspace, env: isolatedEnvironment })
  await run('npm', ['run', 'test:site'], { cwd: workspace, env: isolatedEnvironment })

  const packageMetadata = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8'))
  const releaseTag = `v${packageMetadata.version}`
  await run('npm', ['run', 'verify:release', '--', releaseTag], {
    cwd: workspace,
    env: isolatedEnvironment,
  })
  await run('npm', ['run', 'release:archives'], {
    cwd: workspace,
    env: isolatedEnvironment,
  })
  await run('npm', ['run', 'verify:release-artifacts'], {
    cwd: workspace,
    env: isolatedEnvironment,
  })
  await run('npm', ['run', 'release:notes', '--', releaseTag, releaseNotes], {
    cwd: workspace,
    env: isolatedEnvironment,
  })

  console.log(`Repository verification passed for Elements ${packageMetadata.version}.`)
  console.log(
    'Build trees, dependency installs, browser binaries, reports, and release staging remained outside the repository.',
  )
  console.log(
    'Chrome Web Store review, installed-extension UX, and real-site acceptance remain manual evidence.',
  )
} finally {
  if (keepWorkspace) {
    console.log(`Preserved external verification workspace: ${scratchRoot}`)
  } else {
    await rm(scratchRoot, { recursive: true, force: true })
  }
}
