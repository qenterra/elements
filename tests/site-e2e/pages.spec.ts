import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/')
})

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
})

test('presents the product without layout or serious accessibility failures', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make the web fit you.')
  await expect(page.getByRole('link', { name: /Download for Chrome/ }).first()).toHaveAttribute(
    'href',
    /elements-1\.2\.1-chrome\.zip$/,
  )
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)

  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations
    .filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target),
    }))
  expect(serious).toEqual([])
})

test('demo actions apply one state and undo cleanly', async ({ page }) => {
  const canvas = page.locator('#demo-canvas')
  const status = page.locator('#demo-status')
  const undo = page.getByRole('button', { name: 'Undo demo changes' })

  await page.getByRole('button', { name: 'Hide banner' }).click()
  await expect(canvas).toHaveAttribute('data-state', 'hide')
  await expect(status).toContainText('Banner hidden')
  await expect(undo).toBeEnabled()

  await page.getByRole('button', { name: 'Edit heading' }).click()
  await expect(canvas).toHaveAttribute('data-state', 'text')
  await expect(page.locator('#demo-page-title')).toHaveText('A calmer page, on your terms.')

  await page.getByRole('button', { name: 'Round card' }).click()
  await expect(canvas).toHaveAttribute('data-state', 'round')
  await expect(page.getByRole('button', { name: 'Round card' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await undo.click()
  await expect(canvas).toHaveAttribute('data-state', 'idle')
  await expect(page.locator('#demo-page-title')).toHaveText('Quiet interfaces are coming back.')
  await expect(undo).toBeDisabled()
})

test('product-tour tabs update the real screenshot and support arrow keys', async ({ page }) => {
  const image = page.locator('#tour-image')
  const options = page.getByRole('tab', { name: /Review everything/ })

  await options.click()
  await expect(options).toHaveAttribute('aria-selected', 'true')
  await expect(image).toHaveAttribute('src', 'images/options-dark.png')
  await expect(image).toHaveAttribute('alt', /settings page/)

  await options.press('ArrowRight')
  const narrow = page.getByRole('tab', { name: /Stay compact/ })
  await expect(narrow).toBeFocused()
  await expect(narrow).toHaveAttribute('aria-selected', 'true')
  await expect(image).toHaveAttribute('src', 'images/picker-narrow.png')
})

test('narrow layout stays inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()

  await expect(page.locator('.hero-product')).toBeVisible()
  await expect(page.locator('.download-card')).toHaveCount(3)
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
})

test('reduced-motion mode keeps content visible and interactions working', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await expect(page.locator('.hero-product')).toBeVisible()
  await page.getByRole('button', { name: 'Hide banner' }).click()
  await expect(page.locator('#demo-canvas')).toHaveAttribute('data-state', 'hide')
})
