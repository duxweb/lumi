import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('react binding renders the Card, Form, and Table with current theme tokens', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Lumi React' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Lumi')
  await expect(page.getByRole('table')).toContainText('json-render')
  await expect(page.getByRole('table')).toContainText('Lumi UI')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lumi-theme-primary').trim())).toBe('#2563eb')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lumi-theme-font-body').trim())).toBe('15px')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lumi-theme-radius').trim())).toBe('0.875rem')
})

test('a narrow desktop window keeps desktop control sizes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const saveBox = await page.getByRole('button', { name: 'Save' }).boundingBox()
  expect(saveBox?.height).toBe(32)
})

test('adapter CSS preserves touch targets, reduced motion, textarea sizing, and semantic contrast', async ({ browser }) => {
  // Touch sizing follows the pointer, not the viewport, so the phone is a touch device here.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/')

  const saveBox = await page.getByRole('button', { name: 'Save' }).boundingBox()
  expect(saveBox?.width).toBeGreaterThanOrEqual(44)
  expect(saveBox?.height).toBeGreaterThanOrEqual(44)

  const metrics = await page.evaluate(() => {
    const toggle = document.querySelector<HTMLElement>('[role="switch"]')!
    const toggleHitArea = getComputedStyle(toggle, '::after')
    const toggleStyle = getComputedStyle(toggle)
    const probe = document.createElement('section')
    probe.innerHTML = `
      <textarea data-testid="fixed-textarea" data-slot="textarea" class="field-sizing-content"></textarea>
      <textarea data-testid="auto-textarea" data-slot="textarea" data-auto-resize="true" class="field-sizing-content"></textarea>
      <span data-testid="warning-badge" data-slot="badge" data-tone="warning" data-appearance="solid">Warning</span>
      <span data-testid="danger-badge" data-slot="badge" data-tone="danger" data-appearance="solid">Danger</span>
    `
    document.body.append(probe)
    const fixed = getComputedStyle(probe.querySelector<HTMLElement>('[data-testid="fixed-textarea"]')!)
    const automatic = getComputedStyle(probe.querySelector<HTMLElement>('[data-testid="auto-textarea"]')!)
    const warning = getComputedStyle(probe.querySelector<HTMLElement>('[data-testid="warning-badge"]')!)
    const danger = getComputedStyle(probe.querySelector<HTMLElement>('[data-testid="danger-badge"]')!)
    return {
      automaticFieldSizing: automatic.getPropertyValue('field-sizing'),
      dangerBackground: danger.backgroundColor,
      fixedFieldSizing: fixed.getPropertyValue('field-sizing'),
      hitHeight: toggleHitArea.height,
      hitWidth: toggleHitArea.width,
      transitionDuration: toggleStyle.transitionDuration,
      warningBackground: warning.backgroundColor,
    }
  })

  expect(metrics.hitWidth).toBe('44px')
  expect(metrics.hitHeight).toBe('44px')
  expect(Number.parseFloat(metrics.transitionDuration)).toBeLessThanOrEqual(0.00001)
  expect(metrics.fixedFieldSizing).toBe('fixed')
  expect(metrics.automaticFieldSizing).toBe('content')
  expect(metrics.warningBackground).not.toBe(metrics.dangerBackground)

  const result = await new AxeBuilder({ page }).include('[data-testid="warning-badge"]').analyze()
  expect(result.violations).toEqual([])
  await context.close()
})
