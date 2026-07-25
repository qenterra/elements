import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Worker,
} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

const extensionPath = join(import.meta.dirname, '../../.output/chrome-mv3')
const protocolVersion = 2

const fixtureHtml = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Elements fixture</title></head>
  <body style="margin:0;font-family:sans-serif">
    <header id="site-header" style="padding:20px;background:#eee">Site header</header>
    <div id="promo-banner" style="padding:40px;background:#fde047">Annoying promo banner</div>
    <main id="content" style="padding:20px">
      <h1 id="headline">Original headline</h1>
      <p id="paragraph">Body text that stays.</p>
      <section class="fixture-shell-with-a-long-class-name">
        <div class="fixture-column-with-a-long-class-name">
          <article class="fixture-card-with-a-long-class-name">
            <span id="deep-target">Deep target</span>
          </article>
        </div>
      </section>
    </main>
  </body>
</html>`

test.describe.configure({ mode: 'serial' })

let server: Server
let baseUrl: string
let context: BrowserContext
const pageErrors: string[] = []

async function background(): Promise<Worker> {
  const existing = context.serviceWorkers()
  if (existing.length) return existing[0]
  return context.waitForEvent('serviceworker')
}

async function togglePicker(): Promise<void> {
  const worker = await background()
  await worker.evaluate(
    async ({ urlPrefix, version }) => {
      const api = (
        globalThis as unknown as {
          chrome: {
            tabs: {
              query: (query: object) => Promise<Array<{ id?: number; url?: string }>>
              sendMessage: (tabId: number, message: object) => Promise<unknown>
            }
          }
        }
      ).chrome
      const tabs = await api.tabs.query({})
      const tab = tabs.find((candidate) => candidate.url?.startsWith(urlPrefix))
      if (tab?.id === undefined) throw new Error('Fixture tab not found')
      await api.tabs.sendMessage(tab.id, { v: version, type: 'picker.toggle' })
    },
    { urlPrefix: baseUrl, version: protocolVersion },
  )
}

async function openFixture(viewport?: { width: number; height: number }): Promise<Page> {
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (viewport) await page.setViewportSize(viewport)
  await page.goto(baseUrl)
  return page
}

async function lockTarget(page: Page, selector: string): Promise<void> {
  await page.hover(selector)
  await page.locator(selector).click()
}

async function expectNoSeriousAccessibilityViolations(page: Page, include?: string): Promise<void> {
  const builder = new AxeBuilder({ page })
  if (include) builder.include(include)
  const results = await builder.analyze()
  const violations = results.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target),
    }))
  expect(violations).toEqual([])
}

async function expectActivePathVisible(page: Page): Promise<void> {
  const path = page.locator('#elements-extension-root-v2 #elements_current_elm')
  const active = path.locator('.pathNode.active')
  await expect(active).toBeVisible()
  const [pathBox, activeBox] = await Promise.all([path.boundingBox(), active.boundingBox()])
  expect(pathBox).not.toBeNull()
  expect(activeBox).not.toBeNull()
  expect(activeBox!.x).toBeGreaterThanOrEqual(pathBox!.x)
  expect(activeBox!.x + activeBox!.width).toBeLessThanOrEqual(pathBox!.x + pathBox!.width)
}

async function expectLocatorInsideViewport(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
  expect(box!.y + box!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight))
}

async function expectVerticalCentersAligned(
  first: Locator,
  second: Locator,
  tolerance = 2,
): Promise<void> {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()])
  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  const firstCenter = firstBox!.y + firstBox!.height / 2
  const secondCenter = secondBox!.y + secondBox!.height / 2
  expect(Math.abs(firstCenter - secondCenter)).toBeLessThanOrEqual(tolerance)
}

test.beforeAll(async () => {
  if (!existsSync(extensionPath)) {
    throw new Error('Missing .output/chrome-mv3 — run `npm run build:chrome` before the e2e suite.')
  }
  server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html')
    response.end(fixtureHtml)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  context = await chromium.launchPersistentContext('', {
    headless: false,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : { channel: 'chromium' }),
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })
  context.on('page', (page) => {
    page.on('pageerror', (error) => pageErrors.push(`${page.url()}: ${error.message}`))
  })
})

test.afterAll(async () => {
  await context?.close()
  server?.close()
  expect(pageErrors).toEqual([])
})

test('toolbar toggle opens the lazy-loaded picker panel', async () => {
  const page = await openFixture()
  await togglePicker()
  const picker = page.locator('#elements-extension-root-v2 .mainWindow')
  await expect(picker).toBeVisible()
  await expect(picker.locator('.actionBar')).toBeVisible()
  await expectNoSeriousAccessibilityViolations(page, '#elements-extension-root-v2')
  await page.close()
})

test('click locks a hovered target before actions become available', async () => {
  const page = await openFixture()
  await togglePicker()
  const panel = page.locator('#elements-extension-root-v2 .mainWindow')
  const hide = panel.getByRole('button', { name: 'Hide' })

  await page.hover('#promo-banner')
  await expect(hide).toBeDisabled()
  await page.locator('#promo-banner').click()
  await expect(hide).toBeEnabled()
  await expect(page.locator('#elements-extension-highlighter-v2 .elements_bracket')).toHaveCount(0)
  const [targetBox, toolbarBox] = await Promise.all([
    page.locator('#promo-banner').boundingBox(),
    page.locator('#elements-extension-root-v2 .miniBar').boundingBox(),
  ])
  expect(targetBox).not.toBeNull()
  expect(toolbarBox).not.toBeNull()
  expect(toolbarBox!.y).toBeGreaterThanOrEqual(targetBox!.y + targetBox!.height)

  await page.hover('#headline')
  await expect(panel.locator('.pathNode.active')).toHaveText('#promo-banner')
  await panel.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(panel.locator('.pathNode.active')).toHaveText('#promo-banner')

  await page.keyboard.press('Escape')
  await page.locator('#headline').click()
  await expect(hide).toBeDisabled()
  await expect(panel.locator('.pathNode')).toHaveCount(0)
  await expect(page.locator('#elements-extension-highlighter-v2')).toHaveCount(0)
  await expect(page.locator('#elements-extension-root-v2 .miniBar')).toHaveCount(0)

  await page.hover('#paragraph')
  await expect(hide).toBeDisabled()
  await expect(panel.locator('.pathNode.active')).toHaveText('#paragraph')
  await page.locator('#paragraph').click()
  await expect(hide).toBeEnabled()
  await expect(panel.locator('.pathNode.active')).toHaveText('#paragraph')
  await page.close()
})

test('Q and W keep the active breadcrumb layer in view', async () => {
  const page = await openFixture()
  await togglePicker()
  await lockTarget(page, '#deep-target')

  await expectActivePathVisible(page)
  for (let index = 0; index < 7; index += 1) {
    await page.keyboard.press('q')
    await expectActivePathVisible(page)
  }
  for (let index = 0; index < 7; index += 1) {
    await page.keyboard.press('w')
    await expectActivePathVisible(page)
  }
  await page.close()
})

test('menus, history controls, and the text editor stay inside their visible bounds', async () => {
  const page = await openFixture({ width: 600, height: 480 })
  await togglePicker()
  await lockTarget(page, '#deep-target')

  const panel = page.locator('#elements-extension-root-v2 .mainWindow')
  await panel.getByRole('button', { name: 'More actions' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expectLocatorInsideViewport(page, '#elements-extension-root-v2 .moreMenu')
  expect(
    await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const root = element.getRootNode()
      if (!(root instanceof ShadowRoot)) return false
      const topItem = root.elementFromPoint(rect.left + rect.width / 2, rect.top + 8)
      return Boolean(topItem && element.contains(topItem))
    }),
  ).toBe(true)
  await page.keyboard.press('Escape')

  await panel.getByRole('button', { name: 'Round' }).click()
  const row = panel.locator('.editRow').first()
  const remove = row.getByRole('button', { name: /Delete the rule/ })
  const [rowBox, removeBox] = await Promise.all([row.boundingBox(), remove.boundingBox()])
  expect(rowBox).not.toBeNull()
  expect(removeBox).not.toBeNull()
  expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width)
  await remove.click()
  await expect(row).toHaveCount(0)
  await page.close()

  const narrow = await openFixture({ width: 320, height: 640 })
  await togglePicker()
  await lockTarget(narrow, '#site-header')
  await narrow
    .locator('#elements-extension-root-v2 .mainWindow')
    .getByRole('button', { name: 'Text' })
    .click()
  await expectLocatorInsideViewport(narrow, '#elements-extension-root-v2 .textEditor')
  const editor = narrow.getByRole('dialog', { name: 'Edit visible text' })
  const [editorBox, textareaBox] = await Promise.all([
    editor.boundingBox(),
    editor.getByRole('textbox').boundingBox(),
  ])
  expect(editorBox).not.toBeNull()
  expect(textareaBox).not.toBeNull()
  expect(textareaBox!.x).toBeGreaterThanOrEqual(editorBox!.x)
  expect(textareaBox!.x + textareaBox!.width).toBeLessThanOrEqual(editorBox!.x + editorBox!.width)
  await narrow.close()
})

test('text editing is transactional and undo restores the original DOM node', async () => {
  const page = await openFixture()
  await page.evaluate(() => {
    const state = window as typeof window & { headlineClicks?: number }
    state.headlineClicks = 0
    document.querySelector('#headline')?.addEventListener('click', () => {
      state.headlineClicks = (state.headlineClicks ?? 0) + 1
    })
  })
  await togglePicker()

  await lockTarget(page, '#headline')
  await page.getByRole('button', { name: "Edit the element's text" }).last().click()
  const editor = page.getByRole('dialog', { name: 'Edit visible text' })
  await expect(editor).toBeVisible()
  await editor.getByRole('textbox').fill('Cancelled headline')
  await editor.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('#headline')).toHaveText('Original headline')

  await lockTarget(page, '#headline')
  await page.getByRole('button', { name: "Edit the element's text" }).last().click()
  await editor.getByRole('textbox').fill('Edited headline')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-elements-text-replacement]')).toHaveText('Edited headline')

  await page.keyboard.press('Control+z')
  await expect(page.locator('#headline')).toHaveText('Original headline')
  await togglePicker()
  await page.locator('#headline').click()
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { headlineClicks?: number }).headlineClicks),
    )
    .toBe(1)
  await page.close()
})

test('a remembered rule re-applies after reload', async () => {
  const page = await openFixture()
  await togglePicker()
  await lockTarget(page, '#promo-banner')
  await page.getByRole('button', { name: 'Hide the element' }).last().click()
  await expect(page.locator('#promo-banner')).toBeHidden()
  await expect(page.locator('#elements-extension-root-v2 .changes__count')).toHaveText('1')

  await page.reload()
  await expect(page.locator('#promo-banner')).toBeHidden()
  await page.close()
})

test('complete history supports undo and redo', async () => {
  const page = await openFixture()
  await togglePicker()
  await lockTarget(page, '#site-header')
  await page.getByRole('button', { name: 'Hide the element' }).last().click()
  await expect(page.locator('#site-header')).toBeHidden()
  await page.keyboard.press('Control+z')
  await expect(page.locator('#site-header')).toBeVisible()
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('#site-header')).toBeHidden()
  await page.keyboard.press('Control+z')
  await expect(page.locator('#site-header')).toBeVisible()
  await page.close()
})

test('narrow viewports use a bounded bottom sheet', async () => {
  const page = await openFixture({ width: 320, height: 640 })
  await togglePicker()
  const picker = page.locator('#elements-extension-root-v2 .mainWindow')
  await expect(picker).toBeVisible()
  await expect(page.locator('#elements-extension-root-v2 .miniBar')).toHaveCount(0)
  const bounds = await picker.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640)

  await picker.getByRole('button', { name: 'Minimize' }).click()
  await expect(picker).toHaveClass(/minimized/)
  await expectVerticalCentersAligned(picker, picker.locator('.header__logo_small'))
  await page.close()
})

test('onboarding centers every step number against its copy', async () => {
  const worker = await background()
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`chrome-extension://${extensionId}/onboarding.html`)

  const steps = page.locator('.step')
  await expect(steps).toHaveCount(3)
  for (let index = 0; index < 3; index += 1) {
    const step = steps.nth(index)
    await expectVerticalCentersAligned(step.locator('.step__number'), step.locator(':scope > div'))
  }
  await expectNoSeriousAccessibilityViolations(page)
  await page.close()
})

test('options initializes its theme, lists the port-scoped site, and reviews imports', async () => {
  const worker = await background()
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`chrome-extension://${extensionId}/options.html`)

  await expect(page.locator('.version')).toHaveText('v1.2')
  await expect(page.locator('.siteRow__domain').first()).toHaveText(new URL(baseUrl).host)
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
  await page.getByRole('button', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoSeriousAccessibilityViolations(page)
  await page.getByRole('button', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expectNoSeriousAccessibilityViolations(page)

  await page.locator('input[type="file"]').setInputFiles({
    name: 'elements-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        exportedAt: new Date(0).toISOString(),
        settings: { theme: 'dark' },
        sites: [
          {
            site: 'imported.example',
            modified: 1,
            paused: false,
            rules: [{ id: 'rule_imported', selector: '.promo', permanent: true }],
          },
        ],
      }),
    ),
  })
  const dialog = page.getByRole('dialog', { name: 'Import backup' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('imported.example')
  await expect(dialog).toContainText('1 rule')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.close()
})
