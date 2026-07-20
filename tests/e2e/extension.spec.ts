import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test'
import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

const extensionPath = join(import.meta.dirname, '../../.output/chrome-mv3')

const fixtureHtml = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Elements fixture</title></head>
  <body style="margin:0;font-family:sans-serif">
    <header id="site-header" style="padding:20px;background:#eee">Site header</header>
    <div id="promo-banner" style="padding:40px;background:#fde047">Annoying promo banner</div>
    <main id="content" style="padding:20px">
      <h1 id="headline">Original headline</h1>
      <p id="paragraph">Body text that stays.</p>
    </main>
  </body>
</html>`

test.describe.configure({ mode: 'serial' })

let server: Server
let baseUrl: string
let context: BrowserContext

async function background(): Promise<Worker> {
  const existing = context.serviceWorkers()
  if (existing.length) return existing[0]
  return context.waitForEvent('serviceworker')
}

async function togglePicker(): Promise<void> {
  const worker = await background()
  await worker.evaluate(async (urlPrefix) => {
    const api = (globalThis as { chrome?: never }).chrome as unknown as {
      tabs: {
        query: (query: object) => Promise<Array<{ id?: number; url?: string }>>
        sendMessage: (tabId: number, message: object) => Promise<unknown>
      }
    }
    const tabs = await api.tabs.query({})
    const tab = tabs.find((candidate) => candidate.url?.startsWith(urlPrefix))
    if (tab?.id === undefined) throw new Error('Fixture tab not found')
    await api.tabs.sendMessage(tab.id, { action: 'toggle' })
  }, baseUrl)
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
    headless: true,
    // Extensions need the full Chromium build (the default headless shell
    // does not load them). CHROMIUM_PATH lets CI and sandboxes point at a
    // pre-installed browser.
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })
})

test.afterAll(async () => {
  await context?.close()
  server?.close()
})

async function openFixture(): Promise<Page> {
  const page = await context.newPage()
  await page.goto(baseUrl)
  return page
}

test('toolbar toggle opens the picker panel', async () => {
  const page = await openFixture()
  await togglePicker()
  await expect(page.locator('#elements_wnd .mainWindow')).toBeVisible()
  await expect(page.locator('#elements_wnd .actionBar')).toBeVisible()
  await page.close()
})

test('mini toolbar hides an element and records the change', async () => {
  const page = await openFixture()
  await togglePicker()
  await page.hover('#promo-banner')
  const miniBar = page.locator('#elements_wnd .miniBar')
  await expect(miniBar).toBeVisible()
  await miniBar.locator('.miniBar__btn').first().click()
  await expect(page.locator('#promo-banner')).toBeHidden()
  await expect(page.locator('#elements_wnd .statusToast')).toBeVisible()
  await expect(page.locator('#elements_wnd .changes__count')).toHaveText('1')
  await page.close()
})

test('a remembered rule re-applies after reload', async () => {
  const page = await openFixture()
  await expect(page.locator('#promo-banner')).toBeHidden()
  await page.close()
})

test('Ctrl+Z undoes the last change', async () => {
  const page = await openFixture()
  await togglePicker()
  await page.hover('#site-header')
  await page.locator('#elements_wnd .miniBar .miniBar__btn').first().click()
  await expect(page.locator('#site-header')).toBeHidden()
  await page.keyboard.press('Control+z')
  await expect(page.locator('#site-header')).toBeVisible()
  await page.close()
})

test('options page lists the edited site and switches themes', async () => {
  const worker = await background()
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/options.html`)

  await expect(page.locator('.siteRow__domain')).toHaveText('127.0.0.1')
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
  await page.getByRole('button', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.close()
})
