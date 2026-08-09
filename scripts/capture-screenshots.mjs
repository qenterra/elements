#!/usr/bin/env node
// Captures store-listing screenshots (1280x800) from a built Chrome
// extension. Requires `npm run build:chrome` first.
// Usage: CHROMIUM_PATH=/path/to/chrome node scripts/capture-screenshots.mjs
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), '..')
const extensionPath = join(projectDirectory, '.output/chrome-mv3')
const outputDirectory = process.env.QA_OUTPUT_DIR
  ? join(projectDirectory, process.env.QA_OUTPUT_DIR)
  : join(projectDirectory, '.output/screenshots')
const qaOnly = Boolean(process.env.QA_OUTPUT_DIR)
const documentationImageDirectory = join(projectDirectory, 'docs/images')
const siteImageDirectory = join(projectDirectory, 'site/images')

const demoHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Daily Sample</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font: 16px/1.6 Georgia, serif; color: #1f2430; background: #faf9f6; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 18px 48px; background: #fff; border-bottom: 1px solid #e8e5de; font-family: system-ui, sans-serif; }
  .logo { font-weight: 700; font-size: 20px; letter-spacing: -0.02em; }
  nav a { color: #555; text-decoration: none; margin-left: 22px; font-size: 14px; }
  .promo { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 18px 48px; background: linear-gradient(90deg, #f43f5e, #f97316); color: #fff; font-family: system-ui, sans-serif; font-weight: 600; }
  .promo button { font: inherit; background: #fff; color: #f43f5e; border: 0; border-radius: 8px; padding: 8px 18px; }
  .layout { display: grid; grid-template-columns: 1fr 300px; gap: 40px; max-width: 1060px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 34px; line-height: 1.25; margin-bottom: 14px; }
  .byline { font-family: system-ui, sans-serif; font-size: 13px; color: #8a8578; margin-bottom: 22px; }
  article p { margin-bottom: 16px; }
  .newsletter { background: #10b981; color: #fff; border-radius: 14px; padding: 24px; font-family: system-ui, sans-serif; margin-bottom: 22px; }
  .newsletter b { display: block; font-size: 17px; margin-bottom: 6px; }
  .trending { background: #fff; border: 1px solid #e8e5de; border-radius: 14px; padding: 20px; font-family: system-ui, sans-serif; font-size: 14px; }
  .trending h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #8a8578; margin-bottom: 12px; }
  .trending li { margin: 0 0 10px 18px; }
</style>
</head>
<body>
  <header><span class="logo">The Daily Sample</span><nav><a href="#">World</a><a href="#">Tech</a><a href="#">Culture</a><a href="#">Sports</a></nav></header>
  <div class="promo" id="promo">🔥 Limited offer — subscribe today and save 40% <button>Subscribe</button></div>
  <div class="layout">
    <article>
      <h1>Quiet interfaces are making a comeback</h1>
      <p class="byline">By A. Writer · 12 min read</p>
      <p>After a decade of attention-hungry design, product teams are rediscovering restraint. The most loved tools of the year share a common trait: they get out of the way.</p>
      <p>Designers describe the shift as a return to craft — typography that breathes, motion that explains instead of decorates, and color used as signal rather than noise.</p>
      <p>“The best interface is the one you stop noticing,” says one engineer, echoing a principle that has guided toolmakers for decades.</p>
    </article>
    <aside>
      <div class="newsletter" id="newsletter"><b>Never miss a story</b>Join 80,000 readers. No spam, ever.</div>
      <div class="trending"><h3>Trending</h3><ul><li>The return of personal websites</li><li>Why keyboards matter</li><li>Local-first software</li></ul></div>
    </aside>
  </div>
</body>
</html>`

const server = createServer((_request, response) => {
  response.setHeader('content-type', 'text/html')
  response.end(demoHtml)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}/`
const fixtureSite = new URL(baseUrl).host
const fixtureModified = 1_700_000_000_000
const fixtureRule = {
  id: 'rule_fixture_round',
  selector: '#newsletter',
  permanent: true,
  action: 'round',
  value: '12',
  createdAt: fixtureModified,
  updatedAt: fixtureModified,
}

const context = await chromium.launchPersistentContext('', {
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : { channel: 'chromium' }),
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  args: [
    '--disable-crash-reporter',
    '--no-crashpad',
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
})
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
const extensionId = new URL(worker.url()).host
const screenshotManifest = []
await mkdir(outputDirectory, { recursive: true })
await mkdir(documentationImageDirectory, { recursive: true })
await mkdir(siteImageDirectory, { recursive: true })

function settingsFor(theme) {
  return {
    remember: true,
    theme,
    radius: 12,
    advanced: true,
    coachmarkSeen: true,
  }
}

async function resetExtensionState(theme) {
  await worker.evaluate(async (settings) => {
    await Promise.all([chrome.storage.local.clear(), chrome.storage.sync.clear()])
    await chrome.storage.sync.set({
      settings: JSON.stringify(settings),
    })
  }, settingsFor(theme))
}

async function emulateEvidenceMedia(page, { colorScheme, contrast, reducedMotion } = {}) {
  await page.emulateMedia({
    colorScheme: colorScheme ?? 'light',
    reducedMotion: reducedMotion ?? 'no-preference',
  })
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-contrast', value: contrast ?? 'no-preference' }],
  })
}

async function effectiveEnvironment(page) {
  return page.evaluate(() => ({
    colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'reduce'
      : 'no-preference',
    contrast: matchMedia('(prefers-contrast: more)').matches ? 'more' : 'no-preference',
    viewport: { width: window.innerWidth, height: window.innerHeight },
  }))
}

async function saveScreenshot(page, file, state) {
  const path = join(outputDirectory, file)
  await page.screenshot({ path })
  screenshotManifest.push({
    file,
    state,
    effective: await effectiveEnvironment(page),
    deviceScaleFactor: await page.evaluate(() => window.devicePixelRatio),
    cssZoom: await page.evaluate(() => getComputedStyle(document.documentElement).zoom),
  })
}

async function capturePicker(
  theme,
  file,
  viewport = { width: 1280, height: 800 },
  interaction = 'locked',
  target = '#promo',
  panelFile,
  evidence = {},
) {
  await resetExtensionState(theme)
  const page = await context.newPage()
  await page.setViewportSize(
    evidence.zoom
      ? {
          width: Math.round(viewport.width / evidence.zoom),
          height: Math.round(viewport.height / evidence.zoom),
        }
      : viewport,
  )
  await emulateEvidenceMedia(page, evidence)
  await page.goto(baseUrl)
  await worker.evaluate(async (urlPrefix) => {
    const tabs = await chrome.tabs.query({})
    const tab = tabs.find((candidate) => candidate.url?.startsWith(urlPrefix))
    await chrome.tabs.sendMessage(tab.id, { v: 2, type: 'picker.toggle' })
  }, baseUrl)
  const pickerPanel = page.locator('#elements-extension-root-v2 .mainWindow')
  await pickerPanel.waitFor()
  if (interaction !== 'idle') await page.hover(target)
  if (interaction !== 'hover' && interaction !== 'idle') await page.locator(target).click()
  if (interaction === 'more') {
    await page
      .locator('#elements-extension-root-v2 .mainWindow')
      .getByRole('button', { name: 'More actions' })
      .click()
  }
  if (interaction === 'ancestor') {
    await page.keyboard.press('q')
    await page.keyboard.press('q')
  }
  if (interaction === 'text') {
    await page
      .locator('#elements-extension-root-v2 .mainWindow')
      .getByRole('button', { name: 'Text' })
      .click()
  }
  if (interaction === 'deselected') {
    await page.locator('#newsletter').click()
  }
  if (interaction === 'minimized') {
    await page
      .locator('#elements-extension-root-v2 .mainWindow')
      .getByRole('button', { name: 'Minimize' })
      .click()
  }
  await page.waitForTimeout(250)
  await saveScreenshot(page, file, {
    surface: 'picker',
    theme,
    interaction,
    target,
    ...evidence,
  })
  if (panelFile) {
    await page.addStyleTag({
      content: `
        body {
          background: #0d0f12 !important;
        }

        body > :not(#elements-extension-root-v2) {
          visibility: hidden !important;
        }
      `,
    })
    await pickerPanel.screenshot({ path: join(outputDirectory, panelFile) })
    const panel = await pickerPanel.boundingBox()
    screenshotManifest.push({
      file: panelFile,
      state: { surface: 'picker-panel', theme, interaction },
      effective: {
        ...(await effectiveEnvironment(page)),
        crop: panel ? { width: Math.round(panel.width), height: Math.round(panel.height) } : null,
      },
      deviceScaleFactor: await page.evaluate(() => window.devicePixelRatio),
      cssZoom: await page.evaluate(() => getComputedStyle(document.documentElement).zoom),
    })
  }
  await page.close()
}

async function seedSavedRule(theme) {
  await resetExtensionState(theme)
  await worker.evaluate(
    async ({ site, rule, modified }) => {
      await chrome.storage.sync.set({
        [`web:${site}`]: JSON.stringify([rule]),
        webMeta: { [site]: modified },
        elementsSchemaVersion: 2,
      })
    },
    { site: fixtureSite, rule: fixtureRule, modified: fixtureModified },
  )
}

async function assertSeededSite() {
  const stored = await worker.evaluate(async (site) => {
    return chrome.storage.sync.get([`web:${site}`, 'webMeta', 'webPaused', 'elementsSchemaVersion'])
  }, fixtureSite)
  assert.deepEqual(stored, {
    [`web:${fixtureSite}`]: JSON.stringify([fixtureRule]),
    webMeta: { [fixtureSite]: fixtureModified },
    elementsSchemaVersion: 2,
  })
}

async function captureOptions(theme, file, state = 'default', evidence = {}) {
  if (state === 'empty') await resetExtensionState(theme)
  else {
    await seedSavedRule(theme)
    await assertSeededSite()
  }
  const page = await context.newPage()
  const viewport = evidence.viewport ?? { width: 1280, height: 800 }
  await page.setViewportSize(
    evidence.zoom
      ? {
          width: Math.round(viewport.width / evidence.zoom),
          height: Math.round(viewport.height / evidence.zoom),
        }
      : viewport,
  )
  await emulateEvidenceMedia(page, evidence)
  if (state === 'delete-error') {
    await page.addInitScript(() => {
      const original = chrome.runtime.sendMessage.bind(chrome.runtime)
      chrome.runtime.sendMessage = (message, ...rest) => {
        if (message?.type === 'site.delete') {
          return Promise.resolve({ ok: false, error: 'QA_SYNTHETIC_DELETE_FAILURE' })
        }
        return original(message, ...rest)
      }
    })
  }
  await page.goto(`chrome-extension://${extensionId}/options.html`)
  if (state === 'recovery' || state === 'delete-error') {
    const deleteButton = page.getByRole('button', { name: /Delete all rules for/ }).first()
    await deleteButton.click()
    await page.waitForTimeout(250)
    if (state === 'recovery') {
      await page.locator('.recoveryNotice').scrollIntoViewIfNeeded()
    }
  }
  await page.waitForTimeout(600)
  await saveScreenshot(page, file, { surface: 'options', theme, state, ...evidence })
  await page.close()
}

async function captureOnboarding(theme, file, state = 'initial', evidence = {}) {
  await resetExtensionState(theme)
  const page = await context.newPage()
  await page.setViewportSize(evidence.viewport ?? { width: 1280, height: 800 })
  await emulateEvidenceMedia(page, evidence)
  await page.goto(`chrome-extension://${extensionId}/onboarding.html`)
  if (state === 'trial') {
    await page.getByTestId('start-editing').click()
    await page.getByRole('button', { name: 'Hide', exact: true }).click()
  }
  await page.waitForTimeout(600)
  await saveScreenshot(page, file, { surface: 'onboarding', theme, state, ...evidence })
  await page.close()
}

await capturePicker(
  'dark',
  '01-picker-dark.png',
  undefined,
  'locked',
  '#promo',
  '15-picker-panel-dark.png',
)
await capturePicker('light', '02-picker-light.png')
await captureOptions('dark', '03-options-dark.png')
await captureOptions('light', '04-options-light.png')
await capturePicker('dark', '05-picker-narrow.png', { width: 390, height: 844 })
await capturePicker('dark', '06-picker-hover-preview.png', undefined, 'hover')
await capturePicker('dark', '07-picker-more-menu.png', undefined, 'more')
await capturePicker('dark', '08-picker-ancestor-focus.png', undefined, 'ancestor', '#newsletter')
await capturePicker('dark', '09-picker-text-editor-narrow.png', { width: 390, height: 844 }, 'text')
await capturePicker('dark', '10-picker-deselected.png', undefined, 'deselected')
await capturePicker(
  'dark',
  '11-picker-minimized-narrow.png',
  { width: 390, height: 844 },
  'minimized',
)
await captureOnboarding('dark', '12-onboarding-dark.png')
await capturePicker('dark', '13-picker-default-wide.png', undefined, 'idle')
await capturePicker('dark', '14-picker-default-narrow.png', { width: 390, height: 844 }, 'idle')
await capturePicker(
  'system',
  '16-picker-system-light.png',
  undefined,
  'locked',
  '#promo',
  undefined,
  {
    colorScheme: 'light',
  },
)
await capturePicker(
  'system',
  '17-picker-system-dark.png',
  undefined,
  'locked',
  '#promo',
  undefined,
  {
    colorScheme: 'dark',
  },
)
await capturePicker(
  'dark',
  '18-picker-reduced-motion.png',
  undefined,
  'locked',
  '#promo',
  undefined,
  {
    reducedMotion: 'reduce',
  },
)
await capturePicker(
  'dark',
  '19-picker-increased-contrast.png',
  undefined,
  'more',
  '#promo',
  undefined,
  {
    contrast: 'more',
  },
)
await capturePicker(
  'dark',
  '20-picker-zoom-200.png',
  { width: 640, height: 720 },
  'text',
  '#promo',
  undefined,
  { zoom: 2 },
)
await captureOptions('system', '21-options-system-light.png', 'default', { colorScheme: 'light' })
await captureOptions('system', '22-options-system-dark.png', 'default', { colorScheme: 'dark' })
await captureOptions('dark', '23-options-recovery.png', 'recovery')
await captureOptions('dark', '24-options-delete-error.png', 'delete-error')
await captureOptions('dark', '25-options-increased-contrast.png', 'default', { contrast: 'more' })
await captureOptions('dark', '26-options-zoom-200.png', 'default', {
  viewport: { width: 640, height: 720 },
  zoom: 2,
})
await captureOnboarding('dark', '27-onboarding-trial.png', 'trial')
await captureOnboarding('light', '28-onboarding-light.png')

const documentationImages = new Map([
  ['01-picker-dark.png', 'picker-dark.png'],
  ['03-options-dark.png', 'options-dark.png'],
  ['05-picker-narrow.png', 'picker-narrow.png'],
  ['12-onboarding-dark.png', 'onboarding-dark.png'],
  ['15-picker-panel-dark.png', 'picker-panel-dark.png'],
])
const siteImages = new Map(
  [...documentationImages].filter(([, destination]) => destination !== 'onboarding-dark.png'),
)
if (!qaOnly) {
  await Promise.all(
    [...documentationImages].map(([source, destination]) =>
      copyFile(join(outputDirectory, source), join(documentationImageDirectory, destination)),
    ),
  )
  await Promise.all(
    [...siteImages].map(([source, destination]) =>
      copyFile(join(outputDirectory, source), join(siteImageDirectory, destination)),
    ),
  )
  await copyFile(
    join(projectDirectory, 'public/icons/icon_128.png'),
    join(siteImageDirectory, 'icon-128.png'),
  )
}

await writeFile(
  join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(
    screenshotManifest.toSorted((left, right) => left.file.localeCompare(right.file)),
    null,
    2,
  )}\n`,
)

console.log(`Saved QA screenshots to ${outputDirectory}`)
console.log(
  qaOnly
    ? `Recorded ${screenshotManifest.length} deterministic QA states without changing public screenshots.`
    : `Refreshed ${documentationImages.size} documentation screenshots, ${siteImages.size} Pages screenshots, and the Pages icon.`,
)
await context.close()
server.close()
process.exit(0)
