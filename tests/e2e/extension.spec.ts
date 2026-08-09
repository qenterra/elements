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
const fixtureSettings = {
  remember: true,
  theme: 'system',
  radius: 12,
  advanced: true,
  coachmarkSeen: true,
} as const

const fixtureHtml = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Elements fixture</title></head>
  <body style="margin:0;font-family:sans-serif">
    <header id="site-header" style="padding:20px;background:#eee">Site header</header>
    <div id="promo-banner" style="padding:40px;background:#fde047">Annoying promo banner</div>
    <main id="content" style="padding:20px">
      <button id="page-button" type="button">Page action</button>
      <input id="page-input" aria-label="Page input" />
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
      // The observable contract is the picker UI, not the internal message
      // acknowledgement. Some Chromium builds delay that Promise after the
      // content script has already handled the command.
      void api.tabs
        .sendMessage(tab.id, { v: version, type: 'picker.toggle' })
        .catch(() => undefined)
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

async function extensionId(): Promise<string> {
  return new URL((await background()).url()).host
}

function settingsFor(theme: 'system' | 'light' | 'dark' = 'system') {
  return { ...fixtureSettings, theme }
}

async function resetExtensionState(theme: 'system' | 'light' | 'dark' = 'system'): Promise<void> {
  await (
    await background()
  ).evaluate(async (settings) => {
    const api = (
      globalThis as unknown as {
        chrome: {
          storage: {
            local: { clear: () => Promise<void> }
            sync: {
              clear: () => Promise<void>
              set: (value: object) => Promise<void>
            }
          }
        }
      }
    ).chrome
    await Promise.all([api.storage.local.clear(), api.storage.sync.clear()])
    await api.storage.sync.set({ settings: JSON.stringify(settings) })
  }, settingsFor(theme))
}

async function expectIsolatedExtensionState(
  theme: 'system' | 'light' | 'dark' = 'system',
): Promise<void> {
  const state = await (
    await background()
  ).evaluate(async () => {
    const api = (
      globalThis as unknown as {
        chrome: {
          storage: {
            local: { get: (keys: null) => Promise<Record<string, unknown>> }
            sync: { get: (keys: null) => Promise<Record<string, unknown>> }
          }
        }
      }
    ).chrome
    const [local, sync] = await Promise.all([
      api.storage.local.get(null),
      api.storage.sync.get(null),
    ])
    return { local, sync }
  })

  expect(state.local).toEqual({})
  expect(state.sync).toEqual({ settings: JSON.stringify(settingsFor(theme)) })
}

async function openExtensionPage(
  path: 'onboarding.html' | 'options.html',
  viewport?: { width: number; height: number },
): Promise<Page> {
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (viewport) await page.setViewportSize(viewport)
  await page.goto(`chrome-extension://${await extensionId()}/${path}`)
  return page
}

async function setStoredTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  await resetExtensionState(theme)
  await expectIsolatedExtensionState(theme)
}

async function emulateIncreasedContrast(page: Page): Promise<void> {
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-contrast', value: 'more' }],
  })
}

async function interceptContentScriptMessage(
  page: Page,
  messageType: string,
): Promise<() => Promise<void>> {
  const session = await context.newCDPSession(page)
  const executionContexts = new Map<
    number,
    {
      id: number
      origin: string
      name: string
      auxData?: { isDefault?: boolean; type?: string }
    }
  >()
  session.on('Runtime.executionContextCreated', ({ context: executionContext }) => {
    executionContexts.set(executionContext.id, executionContext)
  })
  await session.send('Runtime.enable')

  const extensionOrigin = `chrome-extension://${await extensionId()}`
  await expect
    .poll(
      () =>
        [...executionContexts.values()].find(
          (executionContext) =>
            executionContext.origin === extensionOrigin &&
            executionContext.auxData?.type === 'isolated' &&
            executionContext.auxData.isDefault === false,
        )?.id,
      { message: 'extension content-script isolated world was not created' },
    )
    .toBeGreaterThan(0)

  const isolatedWorld = [...executionContexts.values()].find(
    (executionContext) =>
      executionContext.origin === extensionOrigin &&
      executionContext.auxData?.type === 'isolated' &&
      executionContext.auxData.isDefault === false,
  )!
  const install = await session.send('Runtime.evaluate', {
    contextId: isolatedWorld.id,
    expression: `(() => {
      const runtimes = [globalThis.chrome?.runtime, globalThis.browser?.runtime]
        .filter((runtime, index, all) => runtime && all.indexOf(runtime) === index)
      globalThis.__elementsQaMessageInterceptors = runtimes.map((runtime) => ({
        runtime,
        original: runtime.sendMessage.bind(runtime),
      }))
      for (const entry of globalThis.__elementsQaMessageInterceptors) {
        entry.runtime.sendMessage = (message, ...rest) =>
          message?.type === ${JSON.stringify(messageType)}
            ? Promise.resolve({ ok: false, error: 'QA_SYNTHETIC_MESSAGE_FAILURE' })
            : entry.original(message, ...rest)
      }
    })()`,
  })
  if (install.exceptionDetails) {
    throw new Error(install.exceptionDetails.text)
  }

  let restored = false
  return async () => {
    if (restored) return
    await session.send('Runtime.evaluate', {
      contextId: isolatedWorld.id,
      expression: `(() => {
        for (const entry of globalThis.__elementsQaMessageInterceptors ?? []) {
          entry.runtime.sendMessage = entry.original
        }
        delete globalThis.__elementsQaMessageInterceptors
      })()`,
    })
    restored = true
    await session.detach()
  }
}

async function lockTarget(page: Page, selector: string): Promise<void> {
  await page.hover(selector)
  await page.locator(selector).click()
}

async function seedSavedRoundRule({
  selector = '#deep-target',
  theme = 'system',
  paused = false,
}: {
  selector?: string
  theme?: 'system' | 'light' | 'dark'
  paused?: boolean
} = {}): Promise<void> {
  await resetExtensionState(theme)
  const site = new URL(baseUrl).host
  const modified = 1_700_000_000_000
  const rule = {
    id: 'rule_fixture_round',
    selector,
    permanent: true,
    action: 'round',
    value: '12',
    createdAt: modified,
    updatedAt: modified,
  }
  const stored = await (
    await background()
  ).evaluate(
    async ({ fixtureSite, fixtureRule, fixtureModified, fixturePaused }) => {
      const api = (
        globalThis as unknown as {
          chrome: {
            storage: {
              sync: {
                get: (keys: string[]) => Promise<Record<string, unknown>>
                set: (value: object) => Promise<void>
              }
            }
          }
        }
      ).chrome
      await api.storage.sync.set({
        [`web:${fixtureSite}`]: JSON.stringify([fixtureRule]),
        webMeta: { [fixtureSite]: fixtureModified },
        ...(fixturePaused ? { webPaused: JSON.stringify([fixtureSite]) } : {}),
        elementsSchemaVersion: 2,
      })
      return api.storage.sync.get([
        `web:${fixtureSite}`,
        'webMeta',
        'webPaused',
        'elementsSchemaVersion',
      ])
    },
    {
      fixtureSite: site,
      fixtureRule: rule,
      fixtureModified: modified,
      fixturePaused: paused,
    },
  )

  expect(stored).toEqual({
    [`web:${site}`]: JSON.stringify([rule]),
    webMeta: { [site]: modified },
    ...(paused ? { webPaused: JSON.stringify([site]) } : {}),
    elementsSchemaVersion: 2,
  })
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
    args: [
      '--disable-crash-reporter',
      '--no-crashpad',
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  })
  context.on('page', (page) => {
    page.on('pageerror', (error) => pageErrors.push(`${page.url()}: ${error.message}`))
  })
})

test.beforeEach(async () => {
  await resetExtensionState()
  await expectIsolatedExtensionState()
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
  const more = panel.getByRole('button', { name: 'More actions' })

  await page.hover('#promo-banner')
  await expect(hide).toBeDisabled()
  await expect(more).toBeDisabled()
  await expect(panel.getByText('Previewing — click to select')).toBeVisible()
  await page.locator('#promo-banner').click()
  await expect(hide).toBeEnabled()
  await expect(more).toBeEnabled()
  await expect(panel.getByText('Selected — actions are ready')).toBeVisible()
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

test('breadcrumb levels and Arrow Up/Down navigate a locked selection', async () => {
  const page = await openFixture()
  await togglePicker()
  await lockTarget(page, '#deep-target')

  const panel = page.locator('#elements-extension-root-v2 .mainWindow')
  const nodes = panel.locator('.pathNode')
  const rootNode = nodes.first()
  const rootLabel = await rootNode.textContent()
  await rootNode.click()
  await expect(panel.locator('.pathNode.active')).toHaveText(rootLabel ?? '')
  await expect(panel.getByRole('button', { name: 'Hide' })).toBeEnabled()

  await page.evaluate(() => {
    document.body.tabIndex = -1
    document.body.focus()
  })
  await page.keyboard.press('ArrowDown')
  await expect(panel.locator('.pathNode.active')).not.toHaveText(rootLabel ?? '')
  await expectActivePathVisible(page)
  await page.keyboard.press('ArrowUp')
  await expect(panel.locator('.pathNode.active')).toHaveText(rootLabel ?? '')
  await page.close()
})

test('Space respects picker and host-page control ownership while keeping the global hide shortcut', async () => {
  const page = await openFixture()
  await page.evaluate(() => {
    const state = window as typeof window & { pageActivations?: number }
    state.pageActivations = 0
    document.querySelector('#page-button')?.addEventListener('click', () => {
      state.pageActivations = (state.pageActivations ?? 0) + 1
    })
  })
  await togglePicker()

  const panel = page.locator('#elements-extension-root-v2 .mainWindow')
  const more = panel.getByRole('button', { name: 'More actions' })
  await lockTarget(page, '#headline')
  await more.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('#page-button').focus()
  await page.keyboard.press('Space')
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { pageActivations?: number }).pageActivations),
    )
    .toBe(1)
  await expect(page.locator('#headline')).toBeVisible()

  const pageInput = page.getByRole('textbox', { name: 'Page input' })
  await pageInput.focus()
  await page.keyboard.press('Space')
  await expect(pageInput).toHaveValue(' ')

  await page.evaluate(() => {
    document.body.tabIndex = -1
    document.body.focus()
  })
  await page.keyboard.press('Space')
  await expect(page.locator('#headline')).toBeHidden()
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
  await expect(panel.getByRole('button', { name: 'More actions' })).toBeFocused()

  await panel.getByRole('button', { name: 'Text' }).click()
  const textEditor = page.getByRole('dialog', { name: 'Edit visible text' })
  await expect(textEditor).toBeVisible()
  await expect
    .poll(() =>
      textEditor.evaluate((dialog) => {
        const root = dialog.getRootNode()
        return root instanceof ShadowRoot ? (root.activeElement?.tagName ?? null) : null
      }),
    )
    .toBe('TEXTAREA')
  await page.keyboard.press('Escape')
  await expect(panel).toBeFocused()

  await lockTarget(page, '#deep-target')
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

test('selector and custom CSS dialogs trap focus only after positioning and restore deterministically', async () => {
  const page = await openFixture()
  await togglePicker()
  await lockTarget(page, '#headline')
  const panel = page.locator('#elements-extension-root-v2 .mainWindow')

  await panel.getByRole('button', { name: 'Round' }).click()
  const editButton = panel.locator('.editRow__edit').first()
  await editButton.click()
  const selectorDialog = page.getByRole('dialog', { name: 'Customize CSS selector' })
  await expect(selectorDialog).toBeVisible()
  const selectorInput = selectorDialog.getByRole('textbox').first()
  await expect(selectorInput).toBeFocused()
  await selectorDialog.getByRole('button', { name: 'Cancel' }).focus()
  await page.keyboard.press('Tab')
  await expect(selectorInput).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(editButton).toBeFocused()

  await panel.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Custom CSS' }).click()
  const cssDialog = page.getByRole('dialog', { name: 'Customize CSS selector' })
  await expect(cssDialog).toBeVisible()
  await expect(cssDialog.getByRole('textbox').first()).toBeFocused()
  await cssDialog.getByRole('button', { name: 'Cancel' }).focus()
  await page.keyboard.press('Tab')
  await expect(cssDialog.getByRole('textbox').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(panel).toBeFocused()
  await page.close()
})

test('persistence failure marks edits temporary and retries the latest snapshot', async () => {
  const page = await openFixture()
  const restoreMessages = await interceptContentScriptMessage(page, 'site.rules.save')

  try {
    await togglePicker()
    await lockTarget(page, '#headline')
    await page
      .locator('#elements-extension-root-v2 .mainWindow')
      .getByRole('button', { name: 'Round' })
      .click()
    const persistence = page.locator('#elements-extension-root-v2 .persistenceStatus')
    await expect(persistence).toContainText('saving failed')
    await expect(persistence.getByRole('button', { name: 'Retry' })).toBeVisible()

    await restoreMessages()
    await persistence.getByRole('button', { name: 'Retry' }).click()
    await expect(persistence).toContainText('Changes saved for this site')
  } finally {
    await restoreMessages().catch(() => undefined)
    await page.close()
  }
})

test('rapid persistence snapshots settle on the newest edit set', async () => {
  const page = await openFixture()
  await togglePicker()
  await lockTarget(page, '#headline')
  const panel = page.locator('#elements-extension-root-v2 .mainWindow')
  await panel.getByRole('button', { name: 'Round' }).click()
  await panel.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Dim the element' }).click()
  await expect(panel.locator('.persistenceStatus')).toContainText('Changes saved for this site')
  await expect(panel.locator('.editRow')).toHaveCount(2)
  await page.reload()
  await togglePicker()
  await expect(page.locator('#elements-extension-root-v2 .editRow')).toHaveCount(2)
  await page.close()
})

test('picker Increased Contrast has intentionally stronger computed boundaries', async () => {
  const page = await openFixture()
  await togglePicker()
  const panel = page.locator('#elements-extension-root-v2 .mainWindow')
  const baseline = await panel.evaluate((element) => ({
    borderColor: getComputedStyle(element).borderColor,
    borderWidth: getComputedStyle(element).borderWidth,
  }))
  await emulateIncreasedContrast(page)
  await expect
    .poll(() => page.evaluate(() => matchMedia('(prefers-contrast: more)').matches))
    .toBe(true)
  const contrast = await panel.evaluate((element) => ({
    borderColor: getComputedStyle(element).borderColor,
    borderWidth: getComputedStyle(element).borderWidth,
  }))
  expect(contrast).not.toEqual(baseline)
  expect(Number.parseFloat(contrast.borderWidth)).toBeGreaterThanOrEqual(
    Number.parseFloat(baseline.borderWidth),
  )
  await page.close()
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
  const panel = page.locator('#elements-extension-root-v2 .mainWindow')
  await page.getByRole('button', { name: "Edit the element's text" }).last().click()
  const editor = page.getByRole('dialog', { name: 'Edit visible text' })
  await expect(editor).toBeVisible()
  await expect(page.getByRole('button', { name: 'More actions' })).toBeDisabled()
  await expect(panel.getByText('Editing text — finish or cancel to continue')).toBeVisible()
  await editor.getByRole('textbox').fill('Cancelled headline')
  await editor.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('#headline')).toHaveText('Original headline')

  await lockTarget(page, '#headline')
  await page.getByRole('button', { name: "Edit the element's text" }).last().click()
  await editor.getByRole('textbox').fill('Edited headline')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-elements-text-replacement]')).toHaveText('Edited headline')

  await page.evaluate(() => {
    document.body.tabIndex = -1
    document.body.focus()
  })
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
  await page.evaluate(() => {
    document.body.tabIndex = -1
    document.body.focus()
  })
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
  const page = await openExtensionPage('onboarding.html')

  await expect(page.getByTestId('start-editing')).toBeVisible()
  await expect(page.getByText('Your shortcut')).toBeVisible()
  await page.getByTestId('start-editing').click()
  await expect(page.getByTestId('onboarding-ready')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select this sample' })).toBeFocused()
  await expect(page.getByText('Sample selected. Choose an edit to preview it.')).toBeVisible()

  const steps = page.locator('.step')
  await expect(steps).toHaveCount(3)
  for (let index = 0; index < 3; index += 1) {
    const step = steps.nth(index)
    await expectVerticalCentersAligned(step.locator('.step__number'), step.locator(':scope > div'))
  }

  const hidePractice = page.getByRole('button', { name: 'Hide', exact: true })
  await expect(hidePractice).toBeEnabled()
  await hidePractice.click()
  await expect(page.getByText('Preview: the sample is hidden. Nothing was saved.')).toBeVisible()
  await expectNoSeriousAccessibilityViolations(page)
  await page.close()
})

test('options initializes its theme, lists the port-scoped site, and reviews imports', async () => {
  await seedSavedRoundRule()
  const page = await openExtensionPage('options.html')

  await expect(page.locator('.version')).toHaveText('v1.0')
  await expect(page.locator('.siteRow__domain').first()).toHaveText(new URL(baseUrl).host)
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
  await page.getByRole('radio', { name: 'Dark' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoSeriousAccessibilityViolations(page)
  await page.getByRole('radio', { name: 'Light' }).check()
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

test('system, light, and dark appearances resolve without losing their preference', async () => {
  for (const appearance of ['system', 'light', 'dark'] as const) {
    await test.step(appearance, async () => {
      await setStoredTheme(appearance)
      const page = await context.newPage()
      await page.emulateMedia({ colorScheme: appearance === 'light' ? 'dark' : 'light' })
      await page.goto(`chrome-extension://${await extensionId()}/options.html`)

      await expect(
        page.getByRole('radio', { name: appearance[0].toUpperCase() + appearance.slice(1) }),
      ).toBeChecked()
      const expectedResolved = appearance === 'system' ? 'light' : appearance
      await expect(page.locator('html')).toHaveAttribute('data-theme', expectedResolved)
      await expectNoSeriousAccessibilityViolations(page)
      await page.close()
    })
  }
})

test('site deletion exposes durable recovery and restores the saved rule', async () => {
  await seedSavedRoundRule({ theme: 'dark' })

  const options = await openExtensionPage('options.html')
  const domain = new URL(baseUrl).host
  const row = options.locator('.siteRow', { hasText: domain })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: `Delete all rules for ${domain}` }).click()
  const recovery = options.getByRole('complementary', { name: 'Deletion can still be undone' })
  await expect(recovery).toBeVisible()
  await expect(options.locator('.siteRow', { hasText: domain })).toHaveCount(0)
  await recovery.getByRole('button', { name: 'Restore rules' }).click()
  await expect(recovery).toHaveCount(0)
  await expect(options.locator('.siteRow', { hasText: domain })).toBeVisible()
  await expect(options.getByRole('status')).toContainText('Saved rules restored.')
  await options.close()
})

test('site deletion failure keeps the saved row and does not offer recovery', async () => {
  await seedSavedRoundRule({ theme: 'dark' })
  const options = await context.newPage()
  await options.emulateMedia({ reducedMotion: 'reduce' })
  await options.addInitScript(() => {
    const runtime = (
      globalThis as unknown as {
        chrome: {
          runtime: {
            sendMessage: (message: { type?: string }, ...rest: unknown[]) => Promise<unknown>
          }
        }
      }
    ).chrome.runtime
    const original = runtime.sendMessage.bind(runtime)
    runtime.sendMessage = (message, ...rest) =>
      message?.type === 'site.delete'
        ? Promise.resolve({ ok: false, error: 'QA_SYNTHETIC_DELETE_FAILURE' })
        : original(message, ...rest)
  })
  await options.goto(`chrome-extension://${await extensionId()}/options.html`)
  const domain = new URL(baseUrl).host
  const row = options.locator('.siteRow', { hasText: domain })
  try {
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: `Delete all rules for ${domain}` }).click()

    await expect(options.getByRole('alert')).toContainText(
      "The site's saved rules could not be deleted. Try again.",
    )
    await expect(row).toBeVisible()
    await expect(
      options.getByRole('complementary', { name: 'Deletion can still be undone' }),
    ).toHaveCount(0)
  } finally {
    await options.close()
    await resetExtensionState()
  }
  await expectIsolatedExtensionState()
})

test('options remain operable with increased contrast and at 200% zoom', async () => {
  await seedSavedRoundRule({ theme: 'dark' })
  // Playwright has no browser-zoom API. Halving the CSS viewport models the
  // reflow pressure of 200% browser zoom from a 640×720 viewport.
  const page = await openExtensionPage('options.html', { width: 320, height: 360 })
  const baselineBoundary = await page.locator('.siteList').evaluate((element) => ({
    borderColor: getComputedStyle(element).borderColor,
    borderWidth: getComputedStyle(element).borderWidth,
  }))
  await emulateIncreasedContrast(page)
  await expect
    .poll(() => page.evaluate(() => matchMedia('(prefers-contrast: more)').matches))
    .toBe(true)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const contrastBoundary = await page.locator('.siteList').evaluate((element) => ({
    borderColor: getComputedStyle(element).borderColor,
    borderWidth: getComputedStyle(element).borderWidth,
  }))
  expect(contrastBoundary).not.toEqual(baselineBoundary)
  await page.getByRole('radio', { name: 'Light' }).focus()
  await expect(page.getByRole('radio', { name: 'Light' })).toBeFocused()
  const overflow = await page.locator('body *').evaluateAll((elements) =>
    elements
      .map((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          className: element.getAttribute('class') ?? '',
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          tag: element.tagName,
        }
      })
      .filter(({ left, right }) => left < -1 || right > window.innerWidth + 1),
  )
  expect(overflow).toEqual([])
  await expectNoSeriousAccessibilityViolations(page)
  await page.close()
})
