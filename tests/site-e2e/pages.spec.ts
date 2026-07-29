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
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make the web fit you.')
  await expect(page.getByRole('link', { name: /Download for Chrome/ }).first()).toHaveAttribute(
    'href',
    /elements-1\.0\.0-chrome\.zip$/,
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

test('demo actions compose, toggle independently, and undo cleanly', async ({ page }) => {
  const canvas = page.locator('#demo-canvas')
  const status = page.locator('#demo-status')
  const undo = page.getByRole('button', { name: 'Undo demo changes' })
  const hide = page.getByRole('button', { name: 'Hide banner' })
  const edit = page.getByRole('button', { name: 'Edit heading' })
  const round = page.getByRole('button', { name: 'Round card' })

  await hide.click()
  await expect(canvas).toHaveAttribute('data-actions', 'hide')
  await expect(status).toContainText('Banner hidden')
  await expect(undo).toBeEnabled()

  await edit.click()
  await round.click()
  await expect(canvas).toHaveAttribute('data-actions', 'hide text round')
  await expect(hide).toHaveAttribute('aria-pressed', 'true')
  await expect(edit).toHaveAttribute('aria-pressed', 'true')
  await expect(round).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#demo-page-title')).toHaveText('A calmer page, on your terms.')
  await expect(status).toContainText(
    'Banner hidden. Heading replaced locally. Card corners rounded.',
  )

  await edit.click()
  await expect(canvas).toHaveAttribute('data-actions', 'hide round')
  await expect(edit).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#demo-page-title')).toHaveText('Quiet interfaces are coming back.')

  await undo.click()
  await expect(canvas).toHaveAttribute('data-actions', '')
  await expect(page.locator('#demo-page-title')).toHaveText('Quiet interfaces are coming back.')
  await expect(hide).toHaveAttribute('aria-pressed', 'false')
  await expect(round).toHaveAttribute('aria-pressed', 'false')
  await expect(undo).toBeDisabled()
})

test('product-tour tabs switch immediately, ignore reselection, and support arrow keys', async ({
  page,
}) => {
  const activeImage = page.locator('[data-tour-image][data-active="true"]')
  const options = page.getByRole('tab', { name: /Review everything/ })

  await options.click()
  await expect(options).toHaveAttribute('aria-selected', 'true')
  await expect(options).toHaveCSS('pointer-events', 'none')
  await expect(activeImage).toHaveAttribute('src', 'images/options-dark.png')
  await expect(activeImage).toHaveAttribute('alt', /settings page/)

  await page.waitForTimeout(200)
  await options.press('Enter')
  await expect(activeImage).toHaveAttribute('src', 'images/options-dark.png')
  const activeAnimations = await page
    .locator('[data-tour-image="options"]')
    .evaluate((image) => image.getAnimations().length)
  expect(activeAnimations).toBe(0)

  await options.press('ArrowRight')
  const narrow = page.getByRole('tab', { name: /Stay compact/ })
  await expect(narrow).toBeFocused()
  await expect(narrow).toHaveAttribute('aria-selected', 'true')
  await expect(activeImage).toHaveAttribute('src', 'images/picker-narrow.png')

  const picker = page.getByRole('tab', { name: /Pick and edit/ })
  await picker.click()
  await expect(picker).toHaveAttribute('aria-selected', 'true')
  await expect(activeImage).toHaveAttribute('src', 'images/picker-dark.png')
})

test('entrance animations settle without jumping back to their loading offset', async ({
  page,
}) => {
  const heroProduct = page.locator('.hero-product')
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full')
  await expect(heroProduct).toHaveClass(/is-revealed/)

  const settledTop = await heroProduct.evaluate((element) => element.getBoundingClientRect().top)
  await page.waitForTimeout(250)
  const laterTop = await heroProduct.evaluate((element) => element.getBoundingClientRect().top)
  expect(Math.abs(laterTop - settledTop)).toBeLessThan(0.5)

  const featureCard = page.locator('.feature-card').first()
  await featureCard.scrollIntoViewIfNeeded()
  await expect(featureCard).toHaveClass(/is-revealed/)
  const featureTop = await featureCard.evaluate((element) => element.getBoundingClientRect().top)
  await page.waitForTimeout(250)
  const featureLaterTop = await featureCard.evaluate(
    (element) => element.getBoundingClientRect().top,
  )
  expect(Math.abs(featureLaterTop - featureTop)).toBeLessThan(0.5)
})

test('narrow layout stays inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()

  await expect(page.locator('.hero-product')).toBeVisible()
  await expect(page.locator('.browser-shot img')).toHaveAttribute(
    'src',
    'images/picker-panel-dark.png',
  )
  const heroContainment = await page.locator('.browser-shot').evaluate((container) => {
    const image = container.querySelector('img')
    if (!image) return { contained: false }

    const outer = container.getBoundingClientRect()
    const inner = image.getBoundingClientRect()
    return {
      contained:
        inner.left >= outer.left - 1 &&
        inner.right <= outer.right + 1 &&
        inner.top >= outer.top - 1 &&
        inner.bottom <= outer.bottom + 1,
    }
  })
  expect(heroContainment.contained).toBe(true)
  await expect(page.locator('.download-card')).toHaveCount(1)
  await expect(page.locator('.download-card svg')).toHaveCount(0)
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
  await expect(page.locator('#demo-canvas')).toHaveAttribute('data-actions', 'hide')
})
