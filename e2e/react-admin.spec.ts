import type { Locator, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { CAPABILITIES } from '../apps/admin/src/capabilities.js'
import { capturesSettingsSection, capturesVisual, settingsSections, visualPages, visualRuns, visualSnapshotName } from './react-admin-visual-matrix'

const screenshotOptions = { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01, scale: 'css' } as const
const VISUAL_NOW = new Date('2026-08-10T08:00:00.000Z')
const VISUAL_FONT_STYLE = `
  *, ::before, ::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    font-family: Arial, sans-serif !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }
`

test.beforeEach(async ({ page, request }) => {
  const response = await request.post('http://127.0.0.1:3002/__reset')
  expect(response.ok()).toBe(true)
  await page.clock.install({ time: VISUAL_NOW })
  await page.addInitScript((style) => {
    document.addEventListener('DOMContentLoaded', () => {
      const element = document.createElement('style')
      element.dataset.lumiVisual = 'true'
      element.textContent = style
      document.head.append(element)
    })
  }, VISUAL_FONT_STYLE)
})

/**
 * Static visual checks do not consume live updates. Refuse the stream so
 * unrelated notifications cannot change a snapshot during its assertion.
 */
async function withoutLiveStream(page: Page): Promise<void> {
  await page.route(url => new URL(url).pathname === '/live', route => route.fulfill({ status: 503, body: '' }))
}

async function login(page: Page, username = 'admin'): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('admin-login-username').fill(username)
  await page.getByTestId('admin-login-password').fill('admin')
  await page.getByTestId('admin-login-submit').click()
  await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible()
}

test('sign-up, a reset link and the new password take a reader into the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await scanA11y(page)

  // Sign-up: checked here first, then refused by the server for a taken address.
  await page.getByTestId('admin-login-register').click()
  await expect(page).toHaveURL(/\/register$/)
  await page.getByTestId('admin-register-submit').click()
  await expect(page.getByText('Enter your name.')).toBeVisible()
  await expect(page.getByTestId('admin-register-name')).toBeFocused()
  await page.getByTestId('admin-register-name').fill('Lin Reader')
  await page.getByTestId('admin-register-email').fill('ada@lumi.test')
  await page.getByTestId('admin-register-password').fill('short')
  await page.getByTestId('admin-register-submit').click()
  await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
  await page.getByTestId('admin-register-password').fill('readers-pass')
  await page.getByTestId('admin-register-submit').click()
  await expect(page.getByTestId('admin-register-error')).toContainText('An account already uses this email')
  await scanA11y(page)
  await page.getByTestId('admin-register-email').fill('lin@lumi.test')
  await page.getByTestId('admin-register-submit').click()
  // The new account is signed in straight away.
  await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible()
  await openAccountMenu(page)
  await page.getByTestId('admin-logout').click()

  // Forgotten password: the answer does not say whether the address has an account.
  await expect(page.getByTestId('admin-login-form')).toBeVisible()
  await page.getByTestId('admin-login-forgot').click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await page.getByTestId('admin-forgot-email').fill('lin@lumi.test')
  await page.getByTestId('admin-forgot-submit').click()
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  await expect(page.getByText('If an account uses lin@lumi.test')).toBeVisible()
  await scanA11y(page)

  // The mailed link: a mismatch is caught here, then the new password is saved and used.
  await page.goto('/reset-password?token=reset-lin@lumi.test')
  await page.getByTestId('admin-reset-password').fill('a-new-password')
  await page.getByTestId('admin-reset-confirm').fill('another-password')
  await page.getByTestId('admin-reset-submit').click()
  await expect(page.getByText('The two passwords differ.')).toBeVisible()
  await page.getByTestId('admin-reset-confirm').fill('a-new-password')
  await page.getByTestId('admin-reset-submit').click()
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()
  await scanA11y(page)
  await page.getByTestId('admin-account-login').click()
  await page.getByTestId('admin-login-username').fill('lin@lumi.test')
  await page.getByTestId('admin-login-password').fill('readers-pass')
  await page.getByTestId('admin-login-submit').click()
  await expect(page.getByTestId('admin-login-error')).toBeVisible()
  await page.getByTestId('admin-login-password').fill('a-new-password')
  await page.getByTestId('admin-login-submit').click()
  await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible()

  // A link without its token says so instead of showing a form that cannot work.
  await openAccountMenu(page)
  await page.getByTestId('admin-logout').click()
  await page.goto('/reset-password')
  await expect(page.getByRole('heading', { name: 'This link is incomplete' })).toBeVisible()
  await expect(page.getByTestId('admin-reset-request')).toHaveAttribute('href', '/forgot-password')
})

test('theme tokens reach UI controls and Admin surfaces together', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)
  await visit(page, '/products/new', 'Create product')
  const input = page.getByRole('textbox', { name: 'Name', exact: true })
  const section = page.locator('.lumi-form-page__step-panel .lumi-form-section').first()
  await expect(page.locator('html')).toHaveCSS('font-size', '16px')
  // Control text is `--lumi-fs-control` (label size), shared with buttons and options.
  await expect(input).toHaveCSS('font-size', '13px')
  await expect(input).toHaveCSS('height', '32px')
  await expect(input).toHaveCSS('border-top-left-radius', '7px')
  await expect(section).toHaveCSS('border-top-left-radius', '10px')
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lumi-theme-font-size', '18px')
  })
  await expect(input).toHaveCSS('font-size', '14.625px')
  await expect(input).toHaveCSS('height', '36px')
  await expect(section).toHaveCSS('padding-left', '27px')
  await expect(section.locator('h3')).toHaveCSS('font-size', '18px')
  await page.evaluate(() => {
    const style = document.documentElement.style
    style.removeProperty('--lumi-theme-font-size')
    style.setProperty('--lumi-theme-radius', '12px')
    style.setProperty('--lumi-theme-font-control', '16px')
    style.setProperty('--lumi-theme-font-section', '20px')
    style.setProperty('--lumi-space-6', '28px')
    style.setProperty('--lumi-font-weight-semibold', '700')
  })
  for (const mode of ['light', 'dark']) {
    await page.evaluate(mode => document.documentElement.dataset.theme = mode, mode)
    await expect(input).toHaveCSS('font-size', '16px')
    await expect(input).toHaveCSS('border-top-left-radius', '12px')
    await expect(section).toHaveCSS('border-top-left-radius', '15px')
    await expect(section).toHaveCSS('padding-left', '28px')
    await expect(section.locator('h3')).toHaveCSS('font-size', '20px')
    await expect(section.locator('h3')).toHaveCSS('font-weight', '700')
  }
})

test('workbench keeps projects readable and fills the available width', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await login(page)
  await page.goto('/workbench')
  await expect(page.getByRole('heading', { name: 'Good evening, Ada', exact: true })).toBeVisible()
  await expect(page.locator('.lumi-metric-card')).toHaveCount(4)
  await expect(page.getByText('Recent activity', { exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Double 11 campaign prep progress', exact: true })).toHaveAttribute('value', '72')
  await expect(page.getByRole('link', { name: /^New product/ }).first()).toHaveAttribute('href', '/products/new')
  await expect(page.getByRole('link', { name: 'All projects', exact: true })).toHaveAttribute('href', '/projects/cards')
  // Ticking a task closes it and confirms with a toast.
  await page.getByRole('checkbox').first().click()
  await expect(page.getByRole('status').filter({ hasText: 'Task done' })).toBeVisible()
  await expect(page.getByText('NaN%', { exact: false })).toHaveCount(0)
  for (const width of [390, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 })
    const layout = await page.locator('.lumi-dashboard-content').evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const cards = Array.from(element.children, (card) => {
        const box = card.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top, width: box.width }
      })
      return {
        width: rect.width,
        cards,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        clippedNames: [...element.querySelectorAll('.lumi-record-list__name')].some(name => name.scrollWidth > name.clientWidth),
      }
    })
    expect(layout.overflow).toBe(false)
    expect(layout.clippedNames).toBe(false)
    // Paired cards share a row and a height on wide screens, and stack on a phone.
    // The first child is the full-width shortcut grid.
    const [, todo, schedule] = layout.cards
    if (width === 390) {
      expect(todo!.width).toBeCloseTo(layout.width, 0)
      expect(schedule!.top).toBeGreaterThan(todo!.top)
    }
    else {
      expect(schedule!.top).toBeCloseTo(todo!.top, 0)
      expect(todo!.width).toBeGreaterThan(layout.width * 0.45)
      expect(schedule!.right).toBeCloseTo(layout.cards.at(-1)!.right, 0)
    }
  }
  expect(errors).toEqual([])
})

for (const width of [320, 1440]) {
  test(`dashboard overview responds to period and width at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await login(page)
    await visit(page, '/', 'Operations overview')
    const chart = page.locator('.lumi-matrix-chart')
    const columns = chart.locator('.lumi-matrix-chart__column')
    await expect(chart).toHaveCount(1)
    await expect(columns).toHaveCount(28)
    await expect(page.locator('.lumi-chart')).toHaveCount(0)
    await expect(page.getByText('View data', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible()
    const flagged = page.locator('.lumi-dashboard-card', { has: page.getByText('Recent orders', { exact: true }) }).locator('tr[data-highlighted]')
    await expect(flagged).toHaveCount(3)
    await expect(flagged.first()).toContainText(/Overdue \d+h/)
    await expect(flagged.first()).toContainText('flagged by Agent')
    const dashboard = page.locator('.lumi-dashboard-page')
    const availableWidth = await dashboard.evaluate((element) => {
      const parent = element.parentElement!
      const style = getComputedStyle(parent)
      return parent.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
    })
    expect((await dashboard.boundingBox())!.width).toBeCloseTo(availableWidth, 0)
    const workspace = (await page.locator('[data-lumi-shell-main]').boundingBox())!
    const content = (await dashboard.boundingBox())!
    expect(content.x + content.width / 2).toBeCloseTo(workspace.x + workspace.width / 2, 0)
    await expect(page.locator('.lumi-metric-card')).toHaveCount(4)
    const trend = (await page.locator('.lumi-dashboard-card', { has: page.getByText('Daily trend', { exact: true }) }).boundingBox())!
    const orders = (await page.locator('.lumi-dashboard-card', { has: page.getByText('Recent orders', { exact: true }) }).boundingBox())!
    expect(trend.width).toBeCloseTo(availableWidth, 0)
    expect(orders.width).toBeCloseTo(trend.width, 0)
    expect(orders.x).toBeCloseTo(trend.x, 0)
    expect(orders.y).toBeGreaterThanOrEqual(trend.y + trend.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    for (const [label, days] of [['28 days', 28], ['7 days', 7], ['90 days', 90]] as const) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`days=${days}`))
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(columns).toHaveCount(days)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    }
    const revenue = page.getByRole('button', { name: 'Revenue', exact: true })
    const ordersSeries = page.getByRole('button', { name: 'Orders', exact: true })
    await expect(revenue).toHaveAttribute('aria-pressed', 'true')
    await expect(ordersSeries).toHaveAttribute('aria-pressed', 'false')
    await expect(chart.getByRole('list', { name: 'Daily revenue', exact: true })).toBeVisible()
    await ordersSeries.click()
    await expect(revenue).toHaveAttribute('aria-pressed', 'false')
    await expect(ordersSeries).toHaveAttribute('aria-pressed', 'true')
    await expect(chart.getByRole('list', { name: 'Daily orders', exact: true })).toBeVisible()
    await enableDarkMode(page, width)
    await expect(columns).toHaveCount(90)
    expect(errors).toEqual([])
  })

  test(`details use compact cards on the shared content axis at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await login(page)
    await visit(page, '/', 'Operations overview')
    const axis = (await page.locator('.lumi-dashboard-page').boundingBox())!
    for (const [path, title] of [['/products/1', 'Lumi Product 1'], ['/orders/1', 'ORD-00001']] as const) {
      await visit(page, path, title)
      const detail = page.locator('.lumi-detail-page')
      const box = (await detail.boundingBox())!
      expect(box.x).toBeCloseTo(axis.x, 0)
      expect(box.width).toBeCloseTo(axis.width, 0)
      const main = (await detail.locator('.lumi-detail-page__main').boundingBox())!
      const aside = (await detail.locator('.lumi-detail-page__aside').boundingBox())!
      if (box.width < 680) {
        expect(aside.x).toBeCloseTo(main.x, 0)
        expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height)
      }
      else {
        expect(aside.y).toBeCloseTo(main.y, 0)
        expect(aside.x).toBeGreaterThan(main.x + main.width)
      }
      // Short descriptions and activity must not grow with the viewport.
      const activityHeight = (await detail.locator('.lumi-detail-page__aside > :last-child').boundingBox())!.height
      expect(activityHeight).toBeLessThan(450)
      // A short description stays compact; the change history below it, up
      // to five entries, is bounded like the activity.
      if (path === '/products/1') {
        const [description, history] = await detail.locator('.lumi-detail-page__section').all()
        expect((await description!.boundingBox())!.height).toBeLessThan(180)
        expect((await history!.boundingBox())!.height).toBeLessThan(450)
      }
      const shell = page.locator('[data-lumi-shell-main]')
      expect(await shell.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    }
  })

  test(`page workspaces share a responsive content axis at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await login(page)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await visit(page, '/', 'Operations overview')
    const axis = (await page.locator('.lumi-dashboard-page').boundingBox())!
    expect(axis.width).toBeLessThanOrEqual(1280)

    for (const [path, title] of [
      ['/products/new', 'Create product'],
      ['/projects/new', 'New project'],
      ['/articles/new', 'Write article'],
      ['/settings/profile', 'Settings'],
    ] as const) {
      await visit(page, path, title)
      const workspace = page.locator('.lumi-form-page, .lumi-settings-page')
      const box = (await workspace.boundingBox())!
      expect(box.x).toBeCloseTo(axis.x, 0)
      expect(box.width).toBeCloseTo(axis.width, 0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      // Radix uses aria-hidden native inputs for form submission; their
      // offscreen geometry is not the visible control's layout.
      // Tabs scroll inside their own tablist, so that strip is measured as a whole below.
      const controls = workspace.locator('input:not([aria-hidden="true"]), textarea, [role="combobox"], button:not([role="tab"]):visible')
      for (const control of await controls.all()) {
        if (!await control.isVisible())
          continue
        const bounds = (await control.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(box.x - 1)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(box.x + box.width + 1)
      }

      for (const grid of await workspace.locator('.lumi-form-section__fields').all()) {
        const gridWidth = (await grid.boundingBox())!.width
        const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
        const inAside = await grid.evaluate(element => Boolean(element.closest('.lumi-form-page__aside')))
        expect(columns).toBe(inAside || gridWidth < 480 ? 1 : 2)
      }

      // The step form has no aside, so only the other forms split into columns.
      if (path === '/projects/new' || path === '/articles/new') {
        const columns = await workspace.locator('.lumi-form-page__publish').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
        expect(columns).toBe(box.width < 680 ? 1 : 2)
      }
      if (path === '/settings/profile') {
        const tablist = (await workspace.getByRole('tablist').boundingBox())!
        expect(tablist.x).toBeGreaterThanOrEqual(box.x - 1)
        expect(tablist.x + tablist.width).toBeLessThanOrEqual(box.x + box.width + 1)
        const measure = (await workspace.locator('.lumi-settings-page__top').boundingBox())!
        expect(measure.x).toBeCloseTo(axis.x, 0)
        expect(measure.width).toBeCloseTo(axis.width, 0)
        const row = (await workspace.locator('.lumi-settings-row').first().boundingBox())!
        expect(row.x).toBeCloseTo(measure.x, 0)
        expect(row.width).toBeCloseTo(measure.width, 0)
        await page.getByRole('tab', { name: 'Notifications', exact: true }).click()
        const content = (await workspace.locator('.lumi-settings-page__workspace').boundingBox())!
        expect(content.x).toBeCloseTo(measure.x, 0)
        // Preference groups save each change on their own: no footer, one status slot beside each heading.
        await expect(workspace.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
        await expect(workspace.locator('.lumi-settings-row__actions')).toHaveCount(0)
        await expect(workspace.locator('.lumi-settings-row__status')).toHaveCount(3)
        // The Agent panel carries its own switch, so count inside the workspace.
        await expect(workspace.getByRole('switch')).toHaveCount(6)
        for (const toggle of await page.locator('.lumi-settings-form__toggle').all()) {
          const copy = (await toggle.locator('label').boundingBox())!
          const control = (await toggle.getByRole('switch').boundingBox())!
          expect(copy.x + copy.width).toBeLessThanOrEqual(control.x)
          expect(control.x + control.width).toBeLessThanOrEqual(box.x + box.width)
        }
      }
    }
    expect(errors).toEqual([])
  })
}

for (const width of [320, 1440]) {
  test(`card lists remain readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await login(page)
    for (const [path, heading, label] of [
      ['/projects/cards', 'Project cards', 'Projects'],
      ['/articles/search', 'Search articles', 'Articles'],
    ] as const) {
      await visit(page, path, heading)
      const list = page.getByRole('list', { name: label, exact: true })
      await expect(list).toBeVisible()
      const workspace = (await page.locator('.lumi-list-page').boundingBox())!
      expect(workspace.width).toBeLessThanOrEqual(1280)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      for (const card of await list.getByRole('article').all()) {
        const bounds = (await card.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(workspace.x - 1)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(workspace.x + workspace.width + 1)
        expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      }
      if (path === '/projects/cards') {
        await expect(list.getByRole('progressbar')).toHaveCount(12)
        const columns = await list.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
        expect(columns).toBe(width === 320 ? 1 : width === 768 ? 2 : width === 1440 ? 3 : 4)
      }
    }
  })
}

test('card results recover from empty filters and request errors', async ({ page }) => {
  await login(page)
  await visit(page, '/projects/cards', 'Project cards')
  await page.getByPlaceholder('Search project…').fill('no-such-project-98765')
  await page.clock.fastForward(1000)
  await expect(page.getByRole('heading', { name: 'No projects found' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Atlas rollout', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Go to next page', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Atlas rollout', exact: true })).toHaveCount(0)

  await page.route('**/projects?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) }))
  await page.reload()
  await page.clock.fastForward(30_000)
  await expect(page.getByRole('heading', { name: 'Projects unavailable' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.unroute('**/projects?*')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Atlas rollout', exact: true })).toBeVisible()
})

/** Theme and sign-out live behind the shell's avatar menu. */
async function openAccountMenu(page: Page): Promise<void> {
  await page.getByTestId('admin-account').click()
  await expect(page.getByTestId('admin-logout')).toBeVisible()
}

/** Below 768px the rail folds away, so the account controls move to the drawer. */
async function enableDarkMode(page: Page, width: number): Promise<void> {
  if (width < 768) {
    await page.getByTestId('admin-mobile-navigation-trigger').click()
    const toggle = page.getByRole('button', { name: 'Toggle theme' })
    for (let attempt = 0; attempt < 2 && await toggle.getAttribute('data-state') !== 'dark'; attempt += 1)
      await toggle.click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('admin-mobile-navigation')).toHaveCount(0)
    return
  }
  await openAccountMenu(page)
  await page.getByTestId('admin-theme-dark').click()
}

async function readyForVisuals(page: Page): Promise<void> {
  // Component previews deliberately demonstrate perpetual loading states.
  await expect(page.locator('[aria-busy="true"]:visible:not(.lumi-preview-card *, .lumi-example *)')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
}

async function scanA11y(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(result.violations).toEqual([])
}

async function visit(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: heading, exact: false }).first()).toBeVisible()
  await expect(page.getByText(/Checking session|Loading Admin/)).toHaveCount(0)
  if (path === '/products') {
    await expect(page.getByRole('table')).toContainText('Lumi Product')
    await expect(page.locator('.lumi-filter-bar [aria-busy="true"]')).toHaveCount(0)
    await expect(page.locator('.lumi-stat-strip__item')).toHaveCount(4)
    await expect(page.locator('.lumi-stat-strip__spark')).toHaveCount(0)
    await expect(page.getByText('Visible in the storefront', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Sum of the current filter', { exact: true })).toHaveCount(0)
  }
  if (path === '/articles/new')
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible()
  if (path === '/projects/new')
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible()
  if (path === '/orders/1')
    await expect(page.getByRole('heading', { name: 'Items', exact: true })).toBeVisible()
  if (path === '/ui/buttons')
    await expect(page.getByRole('button', { name: 'Solid' })).toBeVisible()
  if (path === '/ui/overview')
    await expect(page.getByRole('article', { name: 'Button', exact: true })).toBeVisible()
  if (path.includes('drawer=edit-customer'))
    await expect(page.getByRole('textbox', { name: 'Customer name' })).toBeVisible()
  if (path.includes('drawer=customer-orders'))
    await expect(page.getByTestId('customer-orders-drawer')).toBeVisible()
  if (path === '/projects/cards')
    await expect(page.getByText('Atlas rollout', { exact: true })).toBeVisible()
  if (path === '/articles/search')
    await expect(page.getByText(/playbook/i).first()).toBeVisible()
}

test('settings cards save on their own without clearing other drafts', async ({ page }) => {
  await login(page)
  await visit(page, '/settings/profile', 'Settings')
  const identity = page.getByRole('region', { name: 'Personal information', exact: true })
  const access = page.getByRole('region', { name: 'Account access', exact: true })
  const putUser = () => page.waitForRequest(request => request.method() === 'PUT' && request.url().endsWith('/users/1'))
  await identity.getByRole('textbox', { name: 'Display name' }).fill('Ada Settings')
  await expect(access.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  const active = access.getByRole('switch', { name: 'Account active' })
  const accessRequest = putUser()
  await active.uncheck()
  expect((await accessRequest).postDataJSON()).toEqual({ active: false })
  await expect(access.getByText('Saved', { exact: true })).toBeVisible()
  await expect(identity.getByRole('textbox', { name: 'Display name' })).toHaveValue('Ada Settings')
  await expect(identity.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()

  // A failed save rolls the switch back, raises the error toast and offers Retry.
  await page.route('**/users/1', async (route) => {
    if (route.request().method() === 'PUT')
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Try again' }) })
    else
      await route.continue()
  })
  await active.check()
  await expect(access.getByRole('status')).toContainText('Save failed')
  await expect(active).not.toBeChecked()
  await expect(page.getByText('Try again', { exact: true })).toBeVisible()
  await page.unroute('**/users/1')
  const retried = putUser()
  await access.getByRole('button', { name: 'Retry', exact: true }).click()
  expect((await retried).postDataJSON()).toEqual({ active: true })
  await expect(active).toBeChecked()

  const identityRequest = putUser()
  await identity.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await identityRequest).postDataJSON()).toEqual({ name: 'Ada Settings', email: 'ada@lumi.test', bio: 'Building better operations, one small improvement at a time.' })
  await expect(identity.getByText('Profile saved successfully')).toBeVisible()
  await expect(identity.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(identity.getByRole('button', { name: 'Discard', exact: true })).toBeDisabled()
})

test('settings examples persist notification, region, workspace, and security preferences', async ({ page }) => {
  await login(page)
  await visit(page, '/settings/profile', 'Settings')
  await page.getByRole('tab', { name: 'Notifications', exact: true }).click()
  const delivery = page.getByRole('region', { name: 'Notification delivery', exact: true })
  const events = page.getByRole('region', { name: 'Activity updates', exact: true })
  // Each change is its own save; the next waits for the one in flight.
  const saved = async (change: () => Promise<void>): Promise<unknown> => {
    const response = page.waitForResponse(item => item.request().method() === 'PUT' && item.url().endsWith('/users/1'))
    await change()
    return (await response).request().postDataJSON()
  }
  expect(await saved(() => delivery.getByRole('switch', { name: 'Email notifications' }).uncheck())).toEqual({ emailUpdates: false, inApp: true, digest: false })
  expect(await saved(() => delivery.getByRole('switch', { name: 'Weekly digest' }).check())).toEqual({ emailUpdates: false, inApp: true, digest: true })
  await expect(delivery.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)

  // Typed values commit on blur or Enter; an invalid one stays unsent beside its error.
  const threshold = events.locator('input[name="lowStockThreshold"]')
  let sent = 0
  const count = (request: { method: () => string, url: () => string }): void => {
    if (request.method() === 'PUT' && request.url().endsWith('/users/1'))
      sent++
  }
  page.on('request', count)
  await threshold.fill('0')
  await threshold.blur()
  await expect(events.getByRole('alert')).toBeVisible()
  expect(sent).toBe(0)
  page.off('request', count)
  expect(await saved(async () => {
    await threshold.fill('35')
    await threshold.press('Enter')
  })).toEqual(expect.objectContaining({ lowStockThreshold: 35 }))
  await expect(events.getByRole('alert')).toHaveCount(0)
  await page.reload()
  await page.getByRole('tab', { name: 'Notifications', exact: true }).click()
  await expect(delivery.getByRole('switch', { name: 'Email notifications' })).not.toBeChecked()
  await expect(delivery.getByRole('switch', { name: 'Weekly digest' })).toBeChecked()
  await expect(threshold).toHaveValue('35')

  await page.getByRole('tab', { name: 'Preferences', exact: true }).click()
  const locale = page.getByRole('region', { name: 'Language & region', exact: true })
  await locale.getByRole('combobox', { name: 'Start of week' }).click()
  expect(await saved(() => page.getByRole('option', { name: 'Sunday', exact: true }).click())).toEqual(expect.objectContaining({ firstDay: 'Sunday' }))
  const workspace = page.getByRole('region', { name: 'Workspace preferences', exact: true })
  expect(await saved(() => workspace.getByRole('switch', { name: 'Restore open tabs' }).uncheck())).toEqual({ rememberTabs: false, confirmLeave: true })

  await page.getByRole('tab', { name: 'Security', exact: true }).click()
  const security = page.getByRole('region', { name: 'Security alerts', exact: true })
  expect(await saved(() => security.getByRole('switch', { name: 'Data export alerts' }).check())).toEqual(expect.objectContaining({ exportAlerts: true }))
  await expect(security.getByText('Saved', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: 'Security', exact: true }).click()
  await expect(security.getByRole('switch', { name: 'Data export alerts' })).toBeChecked()
  await page.getByRole('tab', { name: 'Preferences', exact: true }).click()
  await expect(locale.getByRole('combobox', { name: 'Start of week' })).toContainText('Sunday')
  await expect(workspace.getByRole('switch', { name: 'Restore open tabs' })).not.toBeChecked()
})

test('basic form saves a customer and records open from their lists', async ({ page }) => {
  await login(page)
  await visit(page, '/examples/forms/basic', 'Basic form')
  await page.getByRole('textbox', { name: 'Customer name' }).fill('Example customer')
  await page.getByRole('textbox', { name: 'Email address' }).fill('example@lumi.test')
  await page.getByRole('button', { name: 'Create customer', exact: true }).click()
  await expect(page.getByText(/Customer #\d+ created/)).toBeVisible()
  await visit(page, '/orders', 'Orders')
  await page.getByRole('table').getByRole('row').filter({ hasText: 'ORD-00001' }).click()
  await expect(page.getByRole('heading', { name: 'Order ORD-00001', exact: true }).or(page.getByRole('heading', { name: 'ORD-00001', exact: true }))).toBeVisible()
  await visit(page, '/account/center', 'Account center')
  await expect(page.getByRole('main').getByText('ada@lumi.test', { exact: true })).toBeVisible()
})

test('the CRUD guide page creates, edits and deletes customers through per-row buttons', async ({ page }) => {
  await login(page)
  await visit(page, '/customers/crud', 'Customers')
  const table = page.getByRole('table')
  const search = page.getByRole('textbox', { name: 'Search by name' })
  await search.fill('North')
  await expect(table.getByRole('row')).toHaveCount(2)
  await expect(table).toContainText('Northwind Studio')

  // Create: a taken name comes back as a field error and the dialog stays open.
  await page.getByRole('button', { name: 'New customer' }).click()
  const dialog = page.getByRole('dialog', { name: 'New customer' })
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Northwind Studio')
  await dialog.getByRole('textbox', { name: 'Email' }).fill('hi@lumen.test')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('A customer with this name already exists')).toBeVisible()
  // A failed save stops the array: the success toast after it never runs.
  await expect(page.getByText('Saved', { exact: true })).toHaveCount(0)
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Lumen Works')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await search.fill('Lumen')
  const row = table.getByRole('row').filter({ hasText: 'Lumen Works' })
  await expect(row).toContainText('Standard')

  // Edit: the row's own button opens the shared dialog with that row's values.
  await row.getByRole('button', { name: 'Edit' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit customer' })
  await expect(edit.getByRole('textbox', { name: 'Name' })).toHaveValue('Lumen Works')
  await edit.getByRole('combobox', { name: 'Tier' }).click()
  await page.getByRole('option', { name: 'Gold' }).click()
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(edit).toBeHidden()
  await expect(row).toContainText('Gold')

  // Delete: confirmed in place, then the list refetches without the row.
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Delete Lumen Works?')).toBeVisible()
  await page.getByRole('dialog').or(page.locator('[data-slot="popover-content"]')).getByRole('button', { name: 'Delete', exact: true }).last().click()
  await expect(page.getByText('Deleted', { exact: true })).toBeVisible()
  await expect(table.getByRole('row').filter({ hasText: 'Lumen Works' })).toHaveCount(0)
})

test('account center reads the signed-in user without requiring user administration access', async ({ page }) => {
  await login(page, 'manager')
  await visit(page, '/account/center', 'Account center')
  await expect(page.getByRole('main').getByText('mina@lumi.test', { exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByText('ada@lumi.test', { exact: true })).toHaveCount(0)
})

test('component overview opens a demo section in place and its example shows the native Spec', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await visit(page, '/ui/overview', 'Component overview')
  const tiles = page.getByRole('list', { name: 'Components', exact: true }).getByRole('article')
  const total = await tiles.count()
  await page.getByRole('group', { name: 'Component categories' }).getByRole('radio', { name: /^Form elements/ }).click()
  await expect(page).toHaveURL(/category=elements/)
  await expect.poll(() => tiles.count()).toBeLessThan(total)
  await page.getByRole('textbox', { name: 'Search components' }).fill('DatePicker')
  await expect(tiles).toHaveCount(1)
  // The miniature is a still picture: nothing in it takes focus or a click.
  await expect(tiles.first().locator('[inert][aria-hidden="true"]')).toHaveCount(1)
  await tiles.first().getByRole('link', { name: 'DatePicker', exact: true }).click()
  await expect(page).toHaveURL(/\/forms\/elements#date-and-time$/)
  const section = page.getByRole('region', { name: 'Date and time', exact: true })
  await expect(section).toBeInViewport()
  // Only the page scrolls to the anchor; the shell around it never moves.
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('.lumi-shell-frame, .lumi-shell-workspace'), element => element.scrollTop + element.scrollLeft))).toEqual([0, 0])
  await section.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(section.locator('[data-slot="code-block"] pre')).toContainText('"type": "DatePicker"')
  await section.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(section.getByText('Delivery date', { exact: true })).toBeVisible()

  await visit(page, '/ui/modals', 'Modals & drawers')
  await page.getByRole('button', { name: 'Open confirmation' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete product' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open side drawer' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit product' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await visit(page, '/ui/navigation', 'Tabs & steps')
  await page.getByRole('tab', { name: 'Beta', exact: true }).click()
  await expect(page.getByText('Beta tab content', { exact: true })).toBeVisible()
  await expect(page.getByText('Alpha tab content', { exact: true })).toHaveCount(0)
})

test('choice dropdowns search, select with the keyboard and restore focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await login(page)
  await visit(page, '/forms/elements', 'Form elements')
  for (const mode of ['light', 'dark']) {
    await page.evaluate(mode => document.documentElement.dataset.theme = mode, mode)
    for (const slot of ['radio-group-item', 'checkbox', 'switch']) {
      const checked = page.locator(`[data-slot="${slot}"][aria-checked="true"]:not(:disabled)`).first()
      const unchecked = page.locator(`[data-slot="${slot}"][aria-checked="false"]:not(:disabled)`).first()
      await expect.poll(async () => {
        const selectedColor = await checked.evaluate(element => getComputedStyle(element).backgroundColor)
        return selectedColor !== await unchecked.evaluate(element => getComputedStyle(element).backgroundColor)
      }).toBe(true)
    }
  }
  const single = page.getByRole('combobox', { name: 'Select with search', exact: true })
  await single.click()
  const search = page.getByRole('combobox', { name: 'Select with search search', exact: true })
  await expect(search).toBeFocused()
  await search.fill('jap')
  await expect(page.getByRole('option')).toHaveCount(1)
  await scanA11y(page)
  await search.press('Enter')
  await expect(single).toContainText('Japan')
  await expect(single).toBeFocused()
  await expect(page.getByRole('listbox')).toHaveCount(0)

  const multi = page.getByRole('combobox', { name: 'Notify by', exact: true })
  await multi.click()
  const push = page.getByRole('option', { name: 'Push', exact: true })
  await expect(push).toHaveAttribute('aria-selected', 'true')
  await push.click()
  await expect(push).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByRole('listbox')).toBeVisible()
  await scanA11y(page)
  await page.keyboard.press('Escape')
  await expect(multi).toBeFocused()
  await expect(multi).toContainText('Email')
  await expect(multi).not.toContainText('Push')
})

test('example grids keep examples apart and control state across views and widths', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 })
  await login(page)
  await visit(page, '/forms/elements', 'Form elements')
  const input = page.getByRole('textbox', { name: 'Input md', exact: true })
  await input.fill('Keep this edit')
  const expectGaps = async (): Promise<void> => {
    // No two examples overlap, and each sits at least the grid gap from its neighbours.
    await expect.poll(async () => page.locator('[data-slot="grid"] > section.lumi-example').evaluateAll((items) => {
      const boxes = items.map(item => item.getBoundingClientRect())
      return boxes.length > 1 && boxes.every((a, i) => boxes.every((b, j) => i === j || a.right + 15 <= b.left || b.right + 15 <= a.left || a.bottom + 15 <= b.top || b.bottom + 15 <= a.top))
    })).toBe(true)
  }
  await expectGaps()
  // The Code view takes the room the result had, so a tall card keeps its height.
  const validation = page.getByRole('region', { name: 'Validation states', exact: true })
  const height = (await validation.boundingBox())!.height
  await validation.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(validation.locator('[data-slot="code-block"] pre')).toContainText('"type": "FormField"')
  expect(Math.abs((await validation.boundingBox())!.height - height)).toBeLessThanOrEqual(2)
  await expectGaps()
  const sizes = page.getByRole('region', { name: 'Sizes', exact: true })
  await sizes.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(sizes.locator('[data-slot="code-block"] pre')).toContainText('"type": "Input"')
  await expectGaps()
  await sizes.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(input).toHaveValue('Keep this edit')
  await page.setViewportSize({ width: 390, height: 900 })
  await expectGaps()
  await expect(input).toHaveValue('Keep this edit')
  await page.setViewportSize({ width: 1920, height: 1100 })
  await expectGaps()
  await expect(input).toHaveValue('Keep this edit')
})

/** A Developer page example: the section named by its title, holding its code and its result. */
function example(page: Page, title: string): Locator {
  return page.getByRole('region', { name: title, exact: true })
}

test('native Specs bind state, run actions and refresh connected data; states recover', async ({ page }) => {
  await login(page)
  await visit(page, '/json/start', 'Getting started')
  // Rendered by the upstream JSONUIProvider and the Lumi UI registry alone.
  const native = example(page, 'Render with json-render alone')
  await native.getByRole('button', { name: 'Upgrade to Enterprise' }).click()
  await expect(native.getByText('Enterprise', { exact: true })).toBeVisible()
  await expect(example(page, 'Add Lumi data services').getByRole('table')).toContainText('Lumi Product 1')

  await visit(page, '/json/actions', 'Actions & requests')
  const hello = example(page, 'setState')
  await hello.getByRole('textbox', { name: 'Your name' }).fill('Ada')
  await hello.getByRole('button', { name: 'Run action' }).click()
  await expect(hello.getByText('Hello, Ada', { exact: true })).toBeVisible()
  await hello.getByRole('switch', { name: 'Show confirmation' }).uncheck()
  await expect(hello.getByText('Hello, Ada', { exact: true })).toHaveCount(0)

  await visit(page, '/json/query', 'Data queries')
  const list = example(page, 'A filtered list')
  await expect(list.getByRole('table')).toContainText('Lumi Product')
  await list.getByRole('combobox', { name: 'Product status' }).click()
  await page.getByRole('option', { name: 'Draft', exact: true }).click()
  await expect(list.getByRole('table')).toContainText('Draft')
  const refreshed = page.waitForResponse(response => response.url().includes('/products?') && response.request().method() === 'GET')
  await list.getByRole('button', { name: 'Refresh products' }).click()
  await refreshed
  await page.route('**/products?**', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Temporarily unavailable' }) }))
  await list.getByRole('button', { name: 'Refresh products' }).click()
  await expect(list.getByText('Products unavailable', { exact: true })).toBeVisible()
  await page.unroute('**/products?**')
  await list.getByRole('button', { name: 'Refresh products' }).click()
  await expect(list.getByText('Products unavailable', { exact: true })).toHaveCount(0)
  await expect(list.getByRole('table')).toContainText('Lumi Product')
  const detail = example(page, 'Master and detail')
  await expect(detail.getByText('No customer selected', { exact: true })).toBeVisible()
  await detail.getByRole('row').filter({ hasText: 'Blue Pine Retail' }).click()
  await expect(detail.getByText(/@/).first()).toBeVisible()
  await expect(detail.getByText('No customer selected', { exact: true })).toHaveCount(0)
  await visit(page, '/examples/states', 'State recovery')
  await page.getByRole('button', { name: 'Offline', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Service offline' })).toBeVisible()
  await page.getByRole('button', { name: 'Recover example' }).click()
  await expect(page.getByText('Records are available', { exact: true })).toBeVisible()
})

for (const [width, mode] of [[390, 'light'], [1440, 'dark']] as const) {
  test(`the additional demo pages are accessible and fit at ${width}px ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await withoutLiveStream(page)
    await login(page)
    if (mode === 'dark')
      await enableDarkMode(page, width)
    for (const [path, title] of [
      ['/forms/controls-plus', 'More form controls'],
      ['/examples/forms/basic', 'Basic form'],
      ['/examples/states', 'State recovery'],
      ['/json/state', 'State binding'],
      ['/account/center', 'Account center'],
    ]) {
      await visit(page, path!, title!)
      await readyForVisuals(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(width)
      await scanA11y(page)
    }
  })
}

test('mobile filters and notifications keep their contents readable', async ({ page }) => {
  await login(page)
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await visit(page, '/products', 'Products')
    await page.getByRole('button', { name: 'Advanced', exact: true }).click()
    const filters = page.locator('[data-slot="filters"]')
    const bounds = (await filters.boundingBox())!
    for (const control of await filters.locator('input:not([aria-hidden="true"]):visible, button:visible, summary:visible, [role="combobox"]:visible').all()) {
      const box = (await control.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1)
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
    }
    await page.getByRole('radio', { name: 'Draft', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Draft', exact: true })).toBeChecked()
    await filters.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'All', exact: true }).first()).toBeChecked()
    await page.getByTestId('admin-columns-menu').click()
    await expect(page.getByRole('menuitemcheckbox').first()).toBeVisible()
    const menu = (await page.getByRole('menu', { name: 'Columns', exact: true }).boundingBox())!
    expect(menu.x).toBeGreaterThanOrEqual(0)
    expect(menu.x + menu.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)

    await page.getByRole('button', { name: 'Notifications', exact: true }).click()
    const orders = page.getByRole('region', { name: 'Orders', exact: true })
    await expect(orders.locator('li').first()).toBeVisible()
    const rows = await orders.locator('li').evaluateAll(elements => elements.map((element) => {
      const identity = element.querySelector('.lumi-record-list__name')!.getBoundingClientRect()
      const customer = element.querySelector('.lumi-record-list__description')!
      const name = customer.getBoundingClientRect()
      return { nameBelowIdentity: name.y >= identity.bottom, fullName: customer.scrollWidth <= customer.clientWidth, overflow: element.scrollWidth > element.clientWidth }
    }))
    expect(rows.every(row => row.nameBelowIdentity && row.fullName && !row.overflow)).toBe(true)
    await scanA11y(page)
    await page.keyboard.press('Escape')
  }
})

test('JSON rendering pages run state, watch, actions, requests and validation from native Specs', { tag: '@smoke' }, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await login(page)

  await visit(page, '/json/state', 'State binding')
  const cascade = example(page, 'watch for dependent fields')
  const summary = cascade.getByRole('status').filter({ hasText: 'Summary' })
  await expect(summary).toContainText('Ship to shanghai (cn)')
  await cascade.getByRole('combobox', { name: 'Country' }).click()
  await page.getByRole('option', { name: 'Germany', exact: true }).click()
  // The watch clears the stale city; the Query reloads options for the new country.
  await expect(summary).toContainText('to  (de)')
  await cascade.getByRole('combobox', { name: 'City' }).click()
  await expect(page.getByRole('option', { name: 'Shanghai', exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: 'Munich', exact: true }).click()
  await expect(summary).toContainText('to munich (de)')
  const visibility = example(page, 'Conditional visibility')
  await expect(visibility.getByRole('textbox', { name: 'Gift message' })).toHaveCount(0)
  await visibility.getByRole('switch', { name: 'Gift wrap' }).click()
  await expect(visibility.getByRole('textbox', { name: 'Gift message' })).toBeVisible()
  // The result pane shows the StateStore the bindings write.
  await expect(visibility.getByTestId('live-state')).toContainText('"gift": true')
  const tasks = example(page, 'Lists with repeat')
  await expect(tasks.getByText('Done', { exact: true })).toHaveCount(1)
  await tasks.getByRole('checkbox', { name: 'Book the courier' }).check()
  await expect(tasks.getByText('Done', { exact: true })).toHaveCount(2)
  await scanA11y(page)

  await visit(page, '/json/actions', 'Actions & requests')
  const tags = example(page, 'pushState and removeState')
  await tags.getByRole('textbox', { name: 'New tag' }).fill('Repeat buyer')
  await tags.getByRole('button', { name: 'Add tag' }).click()
  await expect(tags.getByTestId('live-state')).toContainText('"tags": ["VIP", "Wholesale", "Repeat buyer"]')
  const notes = example(page, 'delete and invalidate').getByRole('table')
  await expect(notes).toContainText('Review the Chengdu backlog')
  const form = example(page, 'submitForm')
  // Native field checks block the submit before any request is made.
  await form.getByRole('button', { name: 'Create note', exact: true }).click()
  await expect(form.getByRole('textbox', { name: 'Title' })).toHaveAttribute('aria-invalid', 'true')
  await expect(form.getByText('Title is required', { exact: true })).toBeVisible()
  await expect(form.getByText('Saved', { exact: true })).toHaveCount(0)
  // A backend rejection reaches the Spec through onError.
  await form.getByRole('textbox', { name: 'Title' }).fill('SERVER_ERROR')
  await form.getByRole('button', { name: 'Create note', exact: true }).click()
  await expect(form.getByText('Backend rejected the save', { exact: true })).toBeVisible()
  await form.getByRole('textbox', { name: 'Title' }).fill('E2E JSON note')
  await form.getByRole('button', { name: 'Create note', exact: true }).click()
  await expect(form.getByText('Saved', { exact: true })).toBeVisible()
  await expect(form.getByRole('textbox', { name: 'Title' })).toHaveValue('')
  await expect(form.getByText('Backend rejected the save', { exact: true })).toHaveCount(0)
  // The save invalidated notes, so the list in the example above refetched.
  const created = notes.getByRole('row').filter({ hasText: 'E2E JSON note' })
  await expect(created).toHaveCount(1)
  await created.getByRole('button', { name: /^Row actions/ }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(created).toHaveCount(0)
  const request = example(page, 'request')
  await request.getByRole('button', { name: 'GET /orders/stats', exact: true }).click()
  await expect(request.getByText('Awaiting payment', { exact: true })).toBeVisible()
  // onSuccess raised toasts; scan the page once they have closed.
  await expect(page.locator('[data-slot="toast"]')).toHaveCount(0, { timeout: 10_000 })
  await scanA11y(page)

  await visit(page, '/json/catalog', 'Catalog validation')
  const validate = example(page, 'Validate a Spec')
  const issues = validate.getByRole('table')
  await expect(issues).toContainText('/elements/chart/type')
  await expect(issues).toContainText('/elements/save/on/press/action')
  await validate.getByRole('button', { name: 'Load valid sample', exact: true }).click()
  await expect(validate.getByText('Spec is valid', { exact: true })).toBeVisible()
  const catalog = example(page, 'Assemble the Catalog')
  await catalog.getByRole('button', { name: 'Actions', exact: true }).click()
  await expect(catalog.getByRole('table')).toContainText('submitForm')
  await expect(example(page, 'lumi-check in CI').getByTestId('check-output')).toContainText('error /elements/chart/type unknown_component')
  await expect(example(page, 'Custom components').getByText('Valid against the extended Catalog', { exact: true })).toBeVisible()
  await scanA11y(page)

  await visit(page, '/json/playground', 'Playground')
  const playground = example(page, 'Spec editor')
  await expect(playground.getByRole('button', { name: 'Create note', exact: true })).toBeVisible()
  await playground.getByRole('button', { name: 'Broken', exact: true }).click()
  await expect(playground.getByRole('table')).toContainText('/elements/chart/type')
  // The last Spec that validated stays on screen while the source is broken.
  await expect(playground.getByRole('button', { name: 'Create note', exact: true })).toBeVisible()
  await playground.getByRole('button', { name: 'List', exact: true }).click()
  await expect(playground.getByRole('table')).toContainText('Lumi Product')
  await scanA11y(page)
  expect(pageErrors).toEqual([])
})

test('form elements is a JSON page served from public/pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const spec = page.waitForResponse(response => response.url().endsWith('/pages/form-elements.json'))
  await login(page)
  await visit(page, '/forms/elements', 'Form elements')
  expect((await spec).ok()).toBe(true)
  await expect(page.getByRole('radiogroup', { name: 'Plan', exact: true }).getByRole('radio', { name: 'Pro' })).toBeChecked()
  await expect(page.getByRole('textbox', { name: 'Readonly' })).toHaveValue('LUMI-2026-0817')
  await expect(page.getByText('Enter a full email address, like name@example.com', { exact: true })).toBeVisible()
  await scanA11y(page)
  expect(pageErrors).toEqual([])
})

test('interface pages are JSON files: every variant renders and overlays open from page state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => message.type() === 'error' && pageErrors.push(message.text()))
  await login(page)
  for (const [path, title, file] of [
    ['/ui/buttons', 'Buttons', 'buttons.json'],
    ['/ui/badges', 'Badges & avatars', 'badges.json'],
    ['/ui/typography', 'Typography', 'typography.json'],
    ['/ui/alerts', 'Alerts & progress', 'alerts.json'],
    ['/ui/toasts', 'Toasts & notifications', 'toasts.json'],
    ['/ui/menus', 'Menus, tooltips & accordion', 'menus.json'],
    ['/ui/modals', 'Modals & drawers', 'modals.json'],
    ['/ui/cards', 'Cards', 'cards.json'],
    ['/ui/navigation', 'Tabs & steps', 'navigation.json'],
    ['/ui/tables', 'Tables', 'tables.json'],
    ['/ui/lists', 'Lists & timeline', 'lists.json'],
    ['/ui/ai', 'AI components', 'ai-components.json'],
    ['/dashboards/sales', 'Sales analytics', 'dashboard-sales.json'],
    ['/dashboards/projects', 'Project overview', 'dashboard-projects.json'],
  ] as const) {
    const spec = page.waitForResponse(response => response.url().endsWith(`/pages/${file}`))
    await visit(page, path, title)
    expect((await spec).ok(), file).toBe(true)
    await scanA11y(page)
  }
  await visit(page, '/ui/buttons', 'Buttons')
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add', exact: true })).not.toContainText('Add')
  // Example buttons demonstrate a press with a toast instead of leaving the page.
  for (const [label, toast] of [['Open orders', 'Opens Orders'], ['Read the docs', 'Opens the docs']] as const) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: toast })).toBeVisible()
    await expect(page).toHaveURL(/\/ui\/buttons$/)
  }

  await visit(page, '/ui/modals', 'Modals & drawers')
  await page.getByRole('button', { name: 'Open confirmation' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete product' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open side drawer' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit product' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await visit(page, '/ui/navigation', 'Tabs & steps')
  await page.getByRole('tab', { name: 'Beta', exact: true }).click()
  await expect(page.getByText('Beta tab content', { exact: true })).toBeVisible()
  await expect(page.getByText('Alpha tab content', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.getByText('1,284 orders this month', { exact: true })).toBeVisible()

  // JSON dashboards read live rows through a Query element.
  await visit(page, '/dashboards/sales', 'Sales analytics')
  // Charts carry a screen-reader table of their data; the orders table is the visible one.
  await expect(page.locator('table[data-slot="table"]')).toContainText('ORD-01086')
  await visit(page, '/dashboards/projects', 'Project overview')
  await expect(page.getByRole('table').first()).toContainText('Atlas rollout')
  expect(pageErrors).toEqual([])
})

test('backend contract pages render a served Spec and surface the wire contract', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await login(page)

  await visit(page, '/backend/spec', 'Served pages')
  const served = example(page, 'The backend returns the Spec')
  const queue = served.getByRole('table').first()
  await expect(queue).toContainText('ORD-')
  await served.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'Shipped', exact: true }).click()
  await expect(queue.getByText('shipped').first()).toBeVisible()
  // The raw response of GET /pages/order-queue sits beside the handler that serves it.
  await served.getByRole('tab', { name: 'GET /pages/order-queue' }).click()
  await expect(served.getByRole('tabpanel')).toContainText('"root"')
  await expect(example(page, 'An invalid Spec never renders').getByRole('alert')).toContainText('/elements/chart/type')
  await scanA11y(page)

  await visit(page, '/backend/data', 'Data API')
  const list = example(page, 'A list with filters, sorting and pages')
  await list.getByRole('button', { name: 'List with filter, sort and page', exact: true }).click()
  await expect(list.getByText('GET /orders?status=paid&total[gte]=100&sort=-total&page=1&pageSize=3', { exact: true })).toBeVisible()
  const writes = example(page, 'Create, update and delete')
  await writes.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(writes.getByText('201 Created', { exact: true })).toBeVisible()
  await writes.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(writes.getByText(/^DELETE \/notes\/\d+$/)).toBeVisible()
  await scanA11y(page)

  await visit(page, '/backend/errors', 'Error handling')
  const fields = example(page, '422 with field errors')
  const title = fields.getByRole('textbox', { name: 'Note title' })
  await fields.getByRole('button', { name: 'Save note', exact: true }).click()
  await expect(title).toHaveAttribute('aria-invalid', 'true')
  await expect(fields.getByText('A note with this title already exists', { exact: true })).toBeVisible()
  await title.fill('E2E backend note')
  await fields.getByRole('button', { name: 'Save note', exact: true }).click()
  await expect(fields.getByText('Saved', { exact: true })).toBeVisible()
  await expect(title).toHaveAttribute('aria-invalid', 'false')
  await expect(example(page, '401 ends the session').getByText('401 Unauthorized', { exact: true })).toBeVisible()
  await example(page, '403, 5xx and timeouts').getByRole('button', { name: '403 Forbidden', exact: true }).click()
  await expect(page.getByText('DataProviderError 403', { exact: true })).toBeVisible()
  const outage = example(page, 'Failures inside a Spec')
  await expect(outage.getByRole('table')).toContainText('ORD-')
  await outage.getByRole('switch', { name: 'Answer with 500' }).click()
  await expect(outage.getByText('Orders unavailable', { exact: true })).toBeVisible()
  await outage.getByRole('switch', { name: 'Answer with 500' }).click()
  await expect(outage.getByRole('table')).toContainText('ORD-')
  await scanA11y(page)

  await visit(page, '/backend/auth', 'Auth API')
  const session = example(page, 'Restore the session')
  await session.getByRole('button', { name: 'GET /me', exact: true }).click()
  await expect(session.getByText('GET /me', { exact: true }).last()).toBeVisible()
  await expect(example(page, 'Permissions').getByText('Allowed', { exact: true })).toHaveCount(4)
  await scanA11y(page)
  expect(pageErrors).toEqual([])
})

test.describe('React Admin M3 pages', () => {
  test('runs Dashboard, real filtering and pagination, Detail, Form dirty/save, and Settings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await login(page)
    await visit(page, '/', 'Operations overview')
    await expect(page.locator('.lumi-metric-card').first()).toContainText('$131.5')
    await expect(page.getByRole('link', { name: 'View all', exact: true })).toHaveAttribute('href', '/orders')
    await expect(page.locator('.lumi-matrix-chart__column')).toHaveCount(28)

    await visit(page, '/products', 'Products')
    let table = page.getByRole('table')
    await expect(table).toContainText('Lumi Product 1')
    // Chips live in the advanced panel, which the toolbar's Advanced control opens.
    await page.getByRole('button', { name: 'Advanced', exact: true }).click()
    const activeStatus = page.getByRole('radio', { name: 'Active', exact: true })
    const draftStatus = page.getByRole('radio', { name: 'Draft', exact: true })
    await activeStatus.click()
    await expect(activeStatus).toBeChecked()
    await expect(draftStatus).not.toBeChecked()
    await draftStatus.click()
    await expect(draftStatus).toBeChecked()
    await expect(activeStatus).not.toBeChecked()
    // The design carries no "conditions in force" chip row, so a single field is
    // put back through the All that leads its own row.
    await page.getByRole('radio', { name: 'All', exact: true }).first().click()
    await expect(activeStatus).not.toBeChecked()
    await expect(draftStatus).not.toBeChecked()

    await table.getByRole('button', { name: 'Sort ID ascending' }).click()
    await expect(table.getByRole('button', { name: 'Sort ID descending' })).toBeVisible()
    await table.getByRole('button', { name: 'Sort ID descending' }).click()
    await expect(table).toContainText('Lumi Product 32')
    await table.getByRole('button', { name: 'Sort ID ascending' }).click()
    await expect(table).toContainText('Lumi Product 1')

    await table.getByRole('button', { name: 'Row actions 1', exact: true }).click()
    await page.getByLabel('Actions for row 1', { exact: true }).getByRole('button', { name: 'View' }).click()
    await expect(page).toHaveURL(/\/products\/1$/)
    await visit(page, '/products', 'Products')
    table = page.getByRole('table')
    const firstRow = table.getByLabel('Open row 1', { exact: true })
    await firstRow.focus()
    await firstRow.press('Enter')
    await expect(page).toHaveURL(/\/products\/1$/)
    await visit(page, '/products', 'Products')
    table = page.getByRole('table')

    const search = page.getByRole('textbox', { name: 'Search products' })
    await search.fill('Product 2')
    await expect(table).toContainText('Lumi Product 2')
    await expect(table).not.toContainText('Lumi Product 1')
    await search.clear()
    await expect(table).toContainText('Lumi Product 1')
    const next = page.getByLabel('Results pagination').getByRole('link', { name: /next/i })
    await next.click()
    await expect(table).toContainText('Lumi Product 11')
    // The page is in the address: a reload and the way back from a record keep it.
    await expect(page).toHaveURL(/\/products\?page=2$/)
    // The tab carries the route's menu label.
    await expect(page).toHaveTitle('Standard list · Lumi')
    await page.reload()
    await expect(table).toContainText('Lumi Product 11')
    await table.getByRole('row').filter({ hasText: 'Lumi Product 11' }).click()
    await expect(page).toHaveURL(/\/products\/11$/)
    await expect(page.getByRole('heading', { name: 'Lumi Product 11' })).toBeVisible()
    // The detail page names its record in the tab.
    await expect(page).toHaveTitle('Lumi Product 11 · Lumi')
    await page.goBack()
    await expect(page).toHaveURL(/\/products\?page=2$/)
    await expect(table).toContainText('Lumi Product 11')
    await table.getByRole('row').filter({ hasText: 'Lumi Product 11' }).click()
    await expect(page.getByRole('heading', { name: 'Lumi Product 11' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible()
    await expect(page.getByText('Catalog record updated')).toBeVisible()

    await visit(page, '/products/new', 'Create product')
    const name = page.getByRole('textbox', { name: 'Name' })
    const sku = page.getByRole('textbox', { name: 'SKU' })
    await name.fill('M3 product')
    await sku.fill('M3-001')
    await expect(page.getByText('Unsaved', { exact: true })).toBeVisible()
    await page.getByTestId('module-data').click()
    const leaveDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' })
    await expect(leaveDialog).toBeVisible()
    await leaveDialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(/\/products\/new$/)
    await expect(name).toHaveValue('M3 product')
    await page.getByTestId('module-data').click()
    await leaveDialog.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(page).toHaveURL(/\/products$/)

    await visit(page, '/products/new', 'Create product')
    await page.getByRole('textbox', { name: 'Name' }).fill('Saved M3 product')
    await page.getByRole('textbox', { name: 'SKU' }).fill('M3-002')
    await expect(page.getByText('Step 1 of 2')).toBeVisible()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Step 2 of 2')).toBeVisible()
    await page.getByRole('textbox', { name: 'Description' }).fill('A long but readable product description saved through the live create endpoint.')
    await page.getByRole('button', { name: 'Create product' }).click()
    await expect(page.getByText('Changes saved')).toBeVisible()
    await expect(page.getByText(/Created product #/)).toBeVisible()
    await expect(page.getByText('Unsaved', { exact: true })).toBeHidden()

    await visit(page, '/settings/profile', 'Settings')
    await expect(page.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Security' })).toBeEnabled()
    const displayName = page.getByRole('textbox', { name: 'Display name' })
    await displayName.fill('Unsaved section change')
    await page.getByTestId('module-overview').click()
    await expect(leaveDialog).toBeVisible()
    await leaveDialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(/\/settings\/profile$/)
    await page.getByRole('tab', { name: 'Notifications' }).click()
    await expect(leaveDialog).toBeVisible()
    await leaveDialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: 'Notifications' }).click()
    await leaveDialog.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(page.getByRole('region', { name: 'Notification delivery', exact: true })).toBeVisible()
    // Leaving the tab dropped the draft, so nothing is left to guard.
    await page.getByTestId('module-overview').click()
    await expect(leaveDialog).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible()

    await visit(page, '/settings/profile', 'Settings')
    const savedDisplayName = page.getByRole('textbox', { name: 'Display name' })
    await savedDisplayName.fill('Ada Admin M3')
    await page.getByRole('button', { name: 'Save', exact: true }).first().click()
    await expect(page.getByText('Profile saved successfully')).toBeVisible()
    await savedDisplayName.fill('Ada Admin edited again')
    await expect(page.getByText('Unsaved', { exact: true })).toBeVisible()
    await expect(page.getByText('Profile saved successfully')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

  test('renders loading, empty, error, offline, timeout, disabled, and permission states with next steps', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)

    await page.goto('/products?state=loading')
    await expect(page.locator('.lumi-data-grid[aria-busy="true"]')).toBeVisible()
    await expect(page.locator('.lumi-data-grid tbody tr')).toHaveCount(5)
    await expect(page.locator('.lumi-data-grid__scroll button, .lumi-data-grid__scroll a, .lumi-data-grid__scroll input, .lumi-data-grid__scroll [tabindex]')).toHaveCount(0)
    const disabledPaginationLinks = page.locator('.lumi-data-grid__pagination a[aria-disabled="true"]')
    await expect(disabledPaginationLinks).not.toHaveCount(0)
    expect(await disabledPaginationLinks.evaluateAll(links => links.every(link => (link as HTMLElement).tabIndex === -1))).toBe(true)
    // Saved views take the well's leading slot, so the page keeps a spoken
    // title rather than a written one.
    await expect(page.getByRole('heading', { name: 'Products', exact: true, level: 1 })).toBeAttached()

    await page.goto('/products?state=empty')
    await expect(page.getByText('No records match the current view.')).toBeVisible()
    await expect(page.getByText('Adjust the filters or create a new record.')).toBeVisible()

    for (const [state, title, nextStep] of [
      ['error', 'Products could not load', 'Retry the request'],
      ['offline', 'Service offline', 'Check the connection and retry the request'],
      ['timeout', 'Request timed out', 'Retry now or narrow the current filters'],
    ] as const) {
      await page.goto(`/products?state=${state}`)
      await expect(page.getByText(title)).toBeVisible()
      await expect(page.getByText(nextStep, { exact: false })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled()
    }

    await visit(page, '/settings/profile', 'Settings')
    await expect(page.getByRole('textbox', { name: 'Role' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled()
    await expect(page.getByRole('region', { name: 'Personal information', exact: true }).getByText('All changes saved', { exact: true })).toBeVisible()

    await openAccountMenu(page)
    await page.getByTestId('admin-logout').click()
    await expect(page.getByTestId('admin-login-form')).toBeVisible()
    await login(page, 'support')
    await page.goto('/products/new')
    await expect(page).toHaveURL(/\/products\/new$/)
    await expect(page.getByText('Permission required')).toBeVisible()
    await expect(page.getByText('Ask an administrator for the required permission')).toBeVisible()
  })

  for (const { viewport, mode } of visualRuns) {
    test(`${viewport.name} ${mode} has accessible pages and responsive table behavior`, async ({ page }) => {
      // Every page is scanned for accessibility at every viewport and mode;
      // screenshots follow the reduced matrix in react-admin-visual-matrix.ts.
      test.setTimeout(60_000)
      await page.setViewportSize(viewport)
      await withoutLiveStream(page)
      await login(page)
      if (mode === 'dark')
        await enableDarkMode(page, viewport.width)
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
      const shell = page.locator('[data-lumi-shell]')
      const shellBox = await shell.boundingBox()
      expect(shellBox?.x).toBe(0)
      expect(shellBox?.width).toBe(viewport.width)
      expect(await shell.evaluate(element => getComputedStyle(element).padding)).toBe(viewport.width < 768 ? '0px' : '8px 8px 8px 0px')

      for (const [name, path, heading] of visualPages) {
        await visit(page, path, heading)
        if (name === 'modal') {
          await page.getByRole('button', { name: 'New category' }).click()
          await expect(page.getByRole('dialog', { name: 'New category' })).toBeVisible()
        }
        // The pointer is still parked where the login button was, which lands
        // on a table row and bakes one hovered row into the baseline.
        await page.mouse.move(0, 0)
        await readyForVisuals(page)
        expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(viewport.width)
        await page.clock.fastForward(1000)
        await scanA11y(page)
        if (capturesVisual(name, viewport.name))
          await expect(page).toHaveScreenshot(visualSnapshotName(name, viewport.name, mode), { ...screenshotOptions, mask: [page.getByTestId('demo-coverage')] })
        if (name === 'settings') {
          for (const section of settingsSections) {
            await page.getByRole('tab', { name: section, exact: true }).click()
            await page.mouse.move(0, 0)
            await scanA11y(page)
            if (capturesSettingsSection(viewport.name))
              await expect(page).toHaveScreenshot(visualSnapshotName(`settings-${section.toLowerCase()}`, viewport.name, mode), { ...screenshotOptions, mask: [page.getByTestId('demo-coverage')] })
          }
        }
      }

      await page.goto('/products')
      const scroll = page.locator('.lumi-data-grid__scroll')
      await expect(scroll).toBeVisible()
      if (viewport.width === 390) {
        expect(await scroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
        const newProduct = page.getByRole('button', { name: 'New product', exact: true })
        const box = await newProduct.boundingBox()
        expect(box?.height).toBeGreaterThanOrEqual(44)
        await page.keyboard.press('Tab')
        await expect(page.locator(':focus')).not.toHaveCount(0)
      }
    })
  }
})

test.describe('React Admin overlays and list variants', () => {
  test('opens the category modal, customer drawers, and card/search lists', { tag: '@smoke' }, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)

    await visit(page, '/articles', 'Articles')
    await page.getByRole('button', { name: 'New category' }).click()
    const category = page.getByRole('dialog', { name: 'New category' })
    await expect(category).toBeVisible()
    await expect(category.getByRole('textbox', { name: 'Name' })).toHaveValue('Accessories')
    await category.getByRole('button', { name: 'Cancel' }).click()
    await expect(category).toHaveCount(0)

    await page.getByRole('button', { name: 'Row actions 1', exact: true }).click()
    await page.getByLabel('Actions for row 1', { exact: true }).getByRole('button', { name: 'Unpublish' }).click()
    const danger = page.getByRole('dialog', { name: /Unpublish/ })
    await expect(danger).toBeVisible()
    await danger.getByRole('button', { name: 'Keep published' }).click()
    await expect(danger).toHaveCount(0)

    await visit(page, '/customers', 'Customers')
    await page.getByRole('table').getByLabel('Open row 1', { exact: true }).click()
    await expect(page).toHaveURL(/\/customers\?drawer=edit-customer&record=1/)
    const edit = page.getByRole('dialog', { name: 'Edit customer' })
    await expect(edit).toBeVisible()
    await expect(edit.getByRole('textbox', { name: 'Customer name' })).toHaveValue('Northwind Studio')
    await edit.getByRole('textbox', { name: 'Customer name' }).fill('Northwind Studio edited')
    await expect(edit.getByText('Unsaved', { exact: true })).toBeVisible()
    await edit.getByRole('button', { name: 'Cancel' }).click()
    const leave = page.getByRole('dialog', { name: 'Discard unsaved changes?' })
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(/drawer=edit-customer/)
    await edit.getByRole('button', { name: 'Cancel' }).click()
    await leave.getByRole('button', { name: 'Discard and leave' }).click()
    await expect(page).toHaveURL(/\/customers$/)

    await page.getByRole('button', { name: 'Row actions 2', exact: true }).click()
    await page.getByLabel('Actions for row 2', { exact: true }).getByRole('button', { name: 'Orders' }).click()
    await expect(page).toHaveURL(/\/customers\?drawer=customer-orders&record=2/)
    const orders = page.getByRole('dialog', { name: /Orders ·/ })
    await expect(orders).toBeVisible()
    await expect(orders.getByRole('table')).toContainText('ORD-')
    await page.goto('/customers?drawer=customer-orders&record=1')
    await expect(page.getByRole('dialog', { name: /Orders · Northwind Studio/ })).toBeVisible()

    await visit(page, '/projects/cards', 'Project cards')
    await expect(page.getByText('Atlas rollout', { exact: true })).toBeVisible()
    await visit(page, '/articles/search', 'Search articles')
    await expect(page.getByText(/playbook/i).first()).toBeVisible()
  })

  test('stacks a select opened inside a popover above the popover', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)
    await visit(page, '/ui/overlays-media', 'Overlays & media')
    await page.getByRole('button', { name: 'Quick filter' }).click()
    const popover = page.locator('[data-lumi-popover="panel"]')
    await popover.getByRole('combobox', { name: 'Status' }).click()
    const options = page.getByRole('listbox').getByRole('option')
    await expect(options).toHaveCount(3)
    // Each option must be the topmost element at its own centre, not the panel
    // behind it. An open Select turns off pointer events outside itself, which
    // hides that panel from hit-testing, so they are restored for the probe.
    const covered = await options.evaluateAll((rows) => {
      const probe = document.createElement('style')
      probe.textContent = '* { pointer-events: auto !important }'
      document.head.append(probe)
      const hidden = rows.filter((row) => {
        const box = row.getBoundingClientRect()
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return !hit || !row.contains(hit)
      }).map(row => row.textContent)
      probe.remove()
      return hidden
    })
    expect(covered).toEqual([])
    await page.getByRole('option', { name: 'Paid', exact: true }).click()
    await expect(popover.getByRole('combobox', { name: 'Status' })).toHaveText('Paid')
    await expect(popover).toBeVisible()
  })
})

test('access, project and article records complete their create/edit workflows', { tag: '@smoke' }, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await visit(page, '/users', 'Users')
  await page.getByRole('button', { name: 'New user', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'New user' })
  await expect(create).toBeVisible()
  await create.getByRole('textbox', { name: 'Full name' }).fill('Quinn Reviewer')
  await create.getByRole('textbox', { name: 'Email' }).fill('quinn@lumi.test')
  await create.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(create).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Search users' }).fill('Quinn')
  const quinn = page.getByRole('table').getByRole('row').filter({ hasText: 'Quinn Reviewer' })
  await expect(quinn).toContainText('Active')
  await quinn.getByRole('button', { name: /Row actions/ }).click()
  await page.getByRole('button', { name: 'Suspend or reactivate', exact: true }).click()
  await page.getByRole('dialog', { name: 'Suspend Quinn Reviewer?' }).getByRole('button', { name: 'Suspend', exact: true }).click()
  await expect(quinn).toContainText('Suspended')

  await visit(page, '/roles', 'Roles')
  await page.getByRole('table').getByLabel('Open row 3', { exact: true }).click()
  const role = page.getByRole('dialog', { name: 'Edit role' })
  await expect(role.getByRole('textbox', { name: 'Role name' })).toHaveValue('Support')
  await role.getByRole('group', { name: 'Notes' }).getByRole('checkbox', { name: 'List' }).check()
  await role.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(role).toHaveCount(0)
  await expect(page.getByRole('table').getByRole('row').filter({ hasText: 'support' })).toContainText('11 permissions')

  await visit(page, '/projects/cards', 'Project cards')
  // The Shell routes library links client-side: a marker on window survives it.
  await page.evaluate(() => {
    (window as unknown as { lumiNoReload: boolean }).lumiNoReload = true
  })
  await page.getByRole('link', { name: 'Atlas rollout', exact: true }).click()
  await expect(page).toHaveURL(/\/projects\/\d+\/edit$/)
  await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Atlas rollout')
  await page.getByRole('textbox', { name: 'Project name' }).fill('Atlas rollout phase 2')
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByRole('table')).toContainText('Atlas rollout phase 2')
  expect(await page.evaluate(() => (window as unknown as { lumiNoReload?: boolean }).lumiNoReload)).toBe(true)

  await visit(page, '/articles', 'Articles')
  const first = page.getByRole('table').getByLabel('Open row 1', { exact: true })
  await expect(first).toContainText('Published')
  await page.getByRole('button', { name: 'Row actions 1', exact: true }).click()
  await page.getByLabel('Actions for row 1', { exact: true }).getByRole('button', { name: 'Unpublish', exact: true }).click()
  await page.getByRole('dialog', { name: /Unpublish/ }).getByRole('button', { name: 'Unpublish', exact: true }).click()
  await expect(first).toContainText('Draft')
  await first.click()
  await expect(page).toHaveURL(/\/articles\/1\/edit$/)
  await expect(page.getByRole('heading', { name: 'Edit article', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Title' })).not.toHaveValue('')
  await expect(page.getByRole('button', { name: 'Featured image', exact: true }).first()).toBeVisible()
})

test('page sections and card contents never touch their neighbours', async ({ page }) => {
  // This traverses the whole directory, rather than one route, on shared CI CPUs.
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  // Every capability page, so a new page cannot ship with sections stacked flush.
  for (const path of CAPABILITIES.map(item => item.path)) {
    await page.goto(path)
    await expect(page.locator('.lumi-admin-page, .lumi-dashboard-page, .lumi-form-page').first()).toBeVisible()
    await expect(page.getByText(/Checking session|Loading Admin/)).toHaveCount(0)
    const touching = await page.evaluate(() => {
      const found: string[] = []
      // Page roots plus the containers a Spec drops children into directly.
      for (const root of document.querySelectorAll('.lumi-admin-page, .lumi-dashboard-content, .lumi-form-page, .lumi-list-page, [data-slot=card-content], [data-slot=field-group], [data-slot=stack], [data-slot=fragment]')) {
        const kids = [...root.children].filter(kid => kid.getBoundingClientRect().height > 0 && getComputedStyle(kid).position !== 'absolute')
        for (let index = 1; index < kids.length; index++) {
          const above = kids[index - 1]!.getBoundingClientRect()
          const below = kids[index]!.getBoundingClientRect()
          // Padding counts as space only on boxes with no visible edge of their own.
          const inset = (element: Element, side: 'paddingBottom' | 'paddingTop'): number => {
            const style = getComputedStyle(element)
            const surfaced = style.borderTopWidth !== '0px' || style.borderBottomWidth !== '0px' || style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.boxShadow !== 'none'
            return surfaced ? 0 : Number.parseFloat(style[side])
          }
          const space = below.top - above.bottom + inset(kids[index - 1]!, 'paddingBottom') + inset(kids[index]!, 'paddingTop')
          if (below.top >= above.bottom - 1 && space < 8)
            found.push(`${kids[index - 1]!.className} / ${kids[index]!.className}`)
        }
      }
      return found
    })
    expect(touching, path).toEqual([])
  }
})

test('selecting a tab or segment never shifts its neighbours', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  const cases = [
    { path: '/projects/new', options: '.lumi-form-page__tab' },
    { path: '/', options: '.lumi-segmented__option' },
    { path: '/orders', options: '.lumi-preset-tabs button' },
    { path: '/ui/navigation', options: '[data-slot=tabs-list][data-variant=default] > [data-slot=tabs-trigger]:not([disabled])' },
  ]
  for (const { path, options } of cases) {
    await page.goto(path)
    const items = page.locator(options)
    await expect(items.first(), path).toBeVisible()
    const edges = async (): Promise<number[]> => items.evaluateAll(nodes => nodes.flatMap((node) => {
      const box = node.getBoundingClientRect()
      return [Math.round(box.left * 2) / 2, Math.round(box.width * 2) / 2]
    }))
    const before = await edges()
    await items.last().click()
    await expect.poll(() => items.last().evaluate(node => node.hasAttribute('data-active') || node.getAttribute('aria-selected') === 'true' || node.getAttribute('aria-pressed') === 'true'), path).toBe(true)
    expect(await edges(), path).toEqual(before)
  }
})

test('the account menu switches language and remembers the choice', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/orders')
  await expect(page.locator('[data-slot=pagination-total]')).toContainText('total')
  await openAccountMenu(page)
  await expect(page.getByTestId('admin-locale-en-US')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('admin-locale-zh-CN').click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('[data-slot=pagination-total]')).toContainText('共')
  await expect(page.getByRole('link', { name: '下一页' }).or(page.getByRole('link', { name: '转到下一页' })).first()).toBeVisible()
  await expect(page.getByTestId('module-data')).toHaveAttribute('aria-label', '数据')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('[data-slot=pagination-total]')).toContainText('共')

  await openAccountMenu(page)
  await expect(page.getByTestId('admin-locale-zh-CN')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('admin-locale-en-US').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await expect(page.locator('[data-slot=pagination-total]')).toContainText('total')
})

test.describe('React Admin Shell regressions', () => {
  test('searches navigation, toggles theme, and signs out', { tag: '@smoke' }, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page)
    await page.getByTestId('admin-menu-search').fill('chart')
    await expect(page.getByTestId('module-data')).toBeVisible()
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0)
    await page.getByTestId('admin-menu-search').fill('')
    await openAccountMenu(page)
    await page.getByTestId('admin-theme-dark').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('lumi:lumi-admin:shell:preferences'))).toBe(JSON.stringify({ collapsed: false, colorMode: 'dark', assistant: false }))
    await openAccountMenu(page)
    await page.getByTestId('admin-logout').click()
    await expect(page.getByTestId('admin-login-form')).toBeVisible()
  })

  test('keeps tablet and mobile navigation focus behavior', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await login(page)
    await expect(page.getByRole('complementary', { name: 'Modules' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Navigation' })).toBeHidden()
    const trigger = page.getByTestId('admin-mobile-navigation-trigger')
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await expect(dialog.getByRole('button', { name: 'Close navigation' })).toBeFocused()
    await scanA11y(page)
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()

    await page.setViewportSize({ width: 390, height: 844 })
    await trigger.click()
    await expect(dialog.getByRole('button', { name: 'Close navigation' })).toBeFocused()
    const focusable = dialog.locator('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    await page.keyboard.press('Shift+Tab')
    await expect(focusable.last()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(focusable.first()).toBeFocused()
  })
})

test('platform pages run uploads, access checks and a served dashboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await login(page)

  await visit(page, '/forms/upload', 'Upload')
  const file = { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('89504e47', 'hex') }
  await page.locator('input[type=file]').first().setInputFiles(file)
  // A finished row names the server URL it committed to state.
  const uploaded = page.getByRole('list', { name: 'Files' }).first().locator('[data-status="done"] [data-slot="upload-file-name"]')
  await expect(uploaded).toHaveAttribute('title', /\/uploads\/.*a\.png/, { timeout: 10_000 })
  await page.locator('input[type=file]').nth(1).setInputFiles({ ...file, name: 'manual.pdf', mimeType: 'application/pdf' })
  await expect(page.getByText('File exceeds the 1 MB server limit').first()).toBeVisible()
  await scanA11y(page)

  await visit(page, '/auth/permissions', 'Route & action access')
  await expect(page.getByRole('button', { name: 'Edit roles', exact: true })).toBeEnabled()
  await expect(page.getByRole('table')).toContainText('Administrator')
  await scanA11y(page)

  await visit(page, '/ui/stats', 'Stats & metrics')
  await page.getByRole('button', { name: 'Bars', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Bars', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await scanA11y(page)
  expect(pageErrors).toEqual([])
})

test('a support account sees denied actions and no role matrix', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page, 'support')
  await visit(page, '/auth/permissions', 'Route & action access')
  await expect(page.getByRole('button', { name: 'Edit order', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Delete product', exact: true })).toBeDisabled()
  await expect(page.getByText('Roles are not visible to this account', { exact: true })).toBeVisible()
})

test('AI components run from page state and the assistant asks before acting', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await login(page)

  await visit(page, '/ui/ai', 'AI components')
  const chat = page.locator('[data-slot="card"]').filter({ hasText: 'Chat thread' }).first()
  const thread = chat.getByRole('list', { name: 'Conversation', exact: true })
  await thread.getByRole('button', { name: 'Approve (3)' }).click()
  await expect(thread.locator('[data-slot="approval"]')).toHaveAttribute('data-status', 'approved')
  await expect(thread).toContainText('the Chengdu warehouse has the reminders')
  await thread.getByRole('button', { name: 'Why is Chengdu slower?' }).click()
  const draft = chat.getByRole('textbox', { name: 'Message', exact: true })
  await expect(draft).toHaveValue('Why is Chengdu slower?')
  await draft.press('Enter')
  await expect(draft).toHaveValue('')
  await chat.getByRole('button', { name: 'Stop generating' }).click()
  await expect(thread).toContainText('Stopped. No model is connected here')
  await page.locator('[data-slot="tool-call"]').filter({ hasText: 'courier.track' }).getByRole('button').click()
  await expect(page.getByText('Courier API timed out after 2 seconds', { exact: true })).toBeVisible()
  await scanA11y(page)

  // The Shell's panel talks to the mock agent, with the page being viewed as context.
  if (!(await page.getByTestId('admin-assistant').isVisible()))
    await page.getByTestId('admin-assistant-toggle').click()
  const panel = page.getByTestId('admin-assistant')
  await expect(panel.getByTestId('assistant-context')).toContainText('AI components')
  const message = panel.getByRole('textbox', { name: 'Message' })
  await message.fill('Show the late orders')
  await message.press('Enter')
  await expect(message).toHaveValue('')
  await expect(panel.getByText(/^From AI components: Three orders are past their ship date/)).toBeVisible()
  await expect(panel.locator('[data-slot="tool-call"], [data-slot="agent-activity"]').first()).toBeVisible()
  // Reminders wait for approval, then the reply goes on. A second send waits for the first reply to end.
  await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
  await message.fill('Remind the late customers')
  await message.press('Enter')
  const reminders = panel.locator('[data-slot="approval"]')
  await reminders.getByRole('button', { name: /^Approve/ }).click()
  await expect(panel.getByText('Done — all three customers have been reminded.', { exact: true })).toBeVisible()
  await expect(reminders).toHaveAttribute('data-status', 'approved')
  await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
  await scanA11y(page)
  expect(pageErrors).toEqual([])
})

test('AI pages validate model output and answer the author commands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await login(page)

  await visit(page, '/ai/agent', 'Agent panel')
  const output = example(page, 'Check model output before it renders')
  await expect(output.getByText('Validated', { exact: true })).toBeVisible()
  await expect(output.getByRole('table').last()).toContainText('ORD-')
  await output.getByRole('button', { name: 'Hallucinated answer', exact: true }).click()
  await expect(output.getByText('Rejected before rendering', { exact: true })).toBeVisible()
  const issues = output.getByRole('table').last()
  await expect(issues).toContainText('SmartTable')
  // zod messages survive the production bundle (sideEffects: false drops its locale setup).
  await expect(issues).toContainText('Unrecognized key: "format"')
  await expect(issues).toContainText('orders.remind')
  await expect(example(page, 'A system prompt from the Catalog').getByTestId('system-prompt')).toContainText('submitForm')
  await scanA11y(page)

  const openPanel = page.getByRole('button', { name: 'Open Agent panel', exact: true })
  if (await openPanel.isVisible())
    await openPanel.click()
  const panel = page.getByRole('button', { name: 'Conversation history' })
  await page.getByRole('button', { name: 'New conversation' }).click()
  await panel.click()
  // Earlier conversations come from the agent-sessions resource.
  const assistant = page.getByTestId('admin-assistant')
  await assistant.getByRole('button', { name: 'Late orders this week' }).click()
  await expect(assistant.getByRole('list', { name: 'Conversation' })).toContainText('Three orders are past their ship date')
  await page.getByRole('button', { name: 'Close assistant' }).click()

  await visit(page, '/ai/commands', 'Author commands')
  await expect(example(page, 'lumi-check catalog').getByTestId('command-output')).toContainText('"name": "submitForm"')
  const describe = example(page, 'lumi-check describe')
  await describe.getByRole('button', { name: 'Run lumi-check describe', exact: true }).click()
  await expect(describe.getByTestId('command-output')).toContainText('"type": "Table"')
  const validate = example(page, 'lumi-check page.json --json')
  await validate.getByRole('button', { name: 'Run lumi-check', exact: true }).click()
  await expect(validate.getByTestId('command-output')).toContainText('unknown_component')
  await scanA11y(page)
  expect(pageErrors).toEqual([])
})

test('the assistant fills and points on the page through the agent bridge, leaving writes to the reader and backend', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const bodies: Record<string, any>[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/agent/chat'))
      bodies.push(request.postDataJSON())
  })
  await login(page)
  await visit(page, '/ui/tables', 'Tables')
  if (!(await page.getByTestId('admin-assistant').isVisible()))
    await page.getByTestId('admin-assistant-toggle').click()
  const panel = page.getByTestId('admin-assistant')
  const message = panel.getByRole('textbox', { name: 'Message' })
  const say = async (text: string): Promise<void> => {
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await message.fill(text)
    await message.press('Enter')
  }

  // Every request carries the page as the bridge reads it, with nothing declared per component.
  await say('search 1042')
  await expect(panel.getByText('The list is filtered.', { exact: false })).toBeVisible()
  expect(bodies[0]).toMatchObject({ approvalMode: 'ask', ui: { route: { path: '/ui/tables', title: 'Tables' } } })
  expect(bodies[0]!.ui.page.elements).toContainEqual(expect.objectContaining({ id: 'filters-demo', type: 'Filters', bind: { value: '/tableFilters' } }))
  expect(bodies[0]!.clientTools.map((tool: { name: string }) => tool.name)).toEqual(['ui_navigate', 'ui_set_state', 'ui_highlight', 'ui_trigger'])
  await expect(page.getByPlaceholder('Search orders…').first()).toHaveValue('1042')

  // Selected rows go into the conversation with their fields, and the agent can point at rows.
  await page.locator('[data-slot="selection-bar"] [data-extra="agent-reference"]').first().click()
  await expect(panel.getByRole('button', { name: 'Remove Lumi Shade' })).toBeVisible()
  await say('what are these')
  await expect(panel.getByText('You referenced 1 record: Lumi Shade.')).toBeVisible()
  const cited = bodies.at(-1)!.messages.at(-1).parts.find((part: { type: string }) => part.type === 'context').items
  expect(cited).toContainEqual(expect.objectContaining({ label: 'Lumi Shade', kind: 'record', data: expect.objectContaining({ sku: 'SKU-0002' }) }))
  expect(bodies.at(-1)!.ui.workspace).toMatchObject({ value: expect.any(String) })
  await say('highlight 3')
  await expect(page.locator('[data-agent-highlight]').first()).toContainText('SKU-0003')

  // Opening a route waits for its page, so the reply already sees it.
  await say('open toasts')
  await expect(page).toHaveURL(/\/ui\/toasts$/)
  await expect(panel.getByText('You are on /ui/toasts now.', { exact: false })).toBeVisible()
  expect(bodies.at(-1)).toMatchObject({ trigger: 'tool-output', ui: { route: { path: '/ui/toasts' } } })
  expect(bodies.at(-1)!.ui.page.elements.length).toBeGreaterThan(0)

  // Light events run at once. A button that changes data stays the reader's:
  // the snapshot lists it under `writes`, and the agent points at it instead.
  await say('click success')
  await expect(page.getByText('Order shipped', { exact: true })).toBeVisible()
  await expect(panel.getByText('Done, it ran on the page.')).toBeVisible()
  expect(bodies.at(-1)!.ui.page.elements).toContainEqual(expect.objectContaining({ id: 'notice-sync-ok', writes: ['press'] }))
  await say('click sync drafts')
  await expect(panel.getByText('changes data, so it is yours to press', { exact: false })).toBeVisible()
  await expect(page.locator('[data-agent-flash]')).toContainText('Sync drafts')
  await expect(panel.getByText('It is flashing on the page.')).toBeVisible()
  await expect(page.getByText('Drafts synced', { exact: true })).toHaveCount(0)
  await expect(panel.locator('[data-slot="approval"]')).toHaveCount(0)

  // The approval mode governs backend tools: with full access the backend acts without its card.
  await panel.locator('[data-slot="prompt-approval-mode"]').click()
  await page.getByRole('menuitemradio', { name: /Full access/ }).click()
  await expect(panel.locator('[data-slot="prompt-approval-mode"]')).toHaveAttribute('data-mode', 'auto')
  await say('remind late customers')
  await expect(panel.getByText('Done — I reminded the customers', { exact: false })).toBeVisible()
  await expect(panel.locator('[data-slot="approval"]')).toHaveCount(0)
  expect(bodies.at(-1)).toMatchObject({ approvalMode: 'auto' })
  expect(await page.evaluate(() => localStorage.getItem('lumi:agent:approval-mode'))).toBe('auto')
  await scanA11y(page)
  expect(pageErrors).toEqual([])
})

test('the sidebar workspace is the tenant every request carries, refetched on switch and kept on reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const tenants: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/products')
      tenants.push(request.headers()['x-tenant'] ?? '')
  })
  await login(page)
  await page.evaluate(() => localStorage.removeItem('lumi:admin:tenant'))
  await visit(page, '/products?search=header', 'Products')
  await expect.poll(() => tenants.at(-1)).toBe('showcase')
  const before = tenants.length
  await page.getByTestId('admin-workspace').click()
  await page.getByTestId('admin-workspace-retail').click()
  await expect(page.getByTestId('admin-workspace')).toContainText('Dux Retail')
  await expect.poll(() => tenants.slice(before)).toContain('retail')
  expect(tenants.slice(before)).not.toContain('showcase')
  await page.reload()
  await expect(page.getByTestId('admin-workspace')).toContainText('Dux Retail')
  await expect.poll(() => tenants.at(-1)).toBe('retail')
  await page.evaluate(() => localStorage.removeItem('lumi:admin:tenant'))
})

test('a change pushed on the live stream refetches the list on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  let lists = 0
  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/products')
      lists++
  })
  const stream = page.waitForRequest(request => new URL(request.url()).pathname === '/live')
  await login(page)
  await visit(page, '/products', 'Products')
  expect((await stream).headers()['x-tenant']).toBeTruthy()
  await expect.poll(() => lists).toBeGreaterThan(0)
  const before = lists
  // Another reader changes a product: the backend pushes it, nobody reloads.
  const response = await page.request.post('http://127.0.0.1:3002/__live', { data: { resource: 'products', type: 'updated', ids: [1] } })
  expect((await response.json()).listeners).toBeGreaterThan(0)
  await expect.poll(() => lists).toBeGreaterThan(before)
})

test('products export to a CSV of the filtered list and import from one, reporting refused rows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await visit(page, '/products', 'Products')
  const table = page.getByRole('table')
  await page.getByRole('textbox', { name: 'Search products' }).fill('Product 2')
  await expect(table).not.toContainText('Lumi Product 1')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('products.csv')
  const csv = await readFile(await file.path(), 'utf8')
  const [header, ...lines] = csv.replace(/^\uFEFF/, '').trim().split('\r\n')
  expect(header).toBe('ID,Product name,SKU,Category,Price,Status')
  // Every matching product, not only the page on screen.
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.every(line => line.includes('Lumi Product 2'))).toBe(true)

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await (await chooser).setFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Product name,SKU,Price,Status\nImported Lamp,IMP-1,19.5,draft\nSERVER_ERROR,IMP-2,1,draft\nImported Shade,IMP-3,7,active\n'),
  })
  await expect(page.getByText('Imported 2 of 3, 1 refused')).toBeVisible()
  await expect(page.getByText('Row 2: server rejected record')).toBeVisible()
  await page.getByRole('textbox', { name: 'Search products' }).fill('Imported')
  await expect(table).toContainText('Imported Lamp')
  await expect(table).toContainText('Imported Shade')
})

test('a write on the product page is recorded with who did it and shows in its change history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await visit(page, '/products/5', 'Lumi Product 5')
  const history = page.locator('section.lumi-detail-page__section', { has: page.getByRole('heading', { name: 'Change history' }) })
  await expect(history).toContainText('No changes recorded yet')
  const logged = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/audit-logs')
  const publish = page.getByRole('button', { name: 'Publish', exact: true })
  await (await publish.isVisible() ? publish : page.getByRole('button', { name: 'Move to draft', exact: true })).click()
  expect((await logged).postDataJSON()).toMatchObject({ action: 'update', resource: 'products', ids: [5], recordId: '5', data: { status: expect.any(String) } })
  // The server adds who; the log reads again once the entry exists.
  await expect(history).toContainText('Ada Admin updated status')
})

test('shell pages expose live shell state and a scoped theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await login(page)

  await visit(page, '/shell/layout', 'Layout, menu & badges')
  await page.getByText('Collapse sidebar', { exact: true }).click()
  await expect(page.getByTestId('admin-sidebar-toggle')).toHaveAttribute('aria-label', 'Expand sidebar')
  await page.getByText('Expand sidebar', { exact: true }).click()
  await scanA11y(page)

  await visit(page, '/shell/theme', 'Theme & dark mode')
  const preview = page.getByTestId('theme-preview')
  await page.getByRole('group', { name: 'Preview mode' }).getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(preview).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.getByRole('textbox', { name: 'Brand colour' }).fill('blue')
  await expect(page.getByText('Invalid theme', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Brand colour' }).fill('#2d5bff')
  await expect(preview).toHaveAttribute('style', /--lumi-theme-brand: #2d5bff/)
  await scanA11y(page)
  expect(pageErrors).toEqual([])
})

test('agent workspace streams a reply, waits for approval and keeps the conversation in the second column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/assistant')
  const column = page.getByTestId('admin-context-panel')
  const workspace = page.locator('[data-slot=agent-workspace]')
  // The conversations take the shell's second column in place of the module menu.
  await expect(column.getByRole('button', { name: /Late orders this week/ })).toBeVisible()
  await expect(page.getByTestId('admin-sidebar')).toHaveCount(0)
  await expect(workspace.getByText('What can I help with?')).toBeVisible()

  const box = workspace.getByRole('textbox', { name: 'Message' })
  await box.fill('Remind the late customers')
  await box.press('Enter')
  await expect(box).toHaveValue('')
  await expect(workspace.getByRole('button', { name: 'Stop generating' })).toBeVisible()
  await expect(workspace.getByText('I found 3 overdue orders. Shall I email their customers?')).toBeVisible()
  await expect(page).toHaveURL(/\/assistant\?session=[\w-]+$/)
  const approve = workspace.getByRole('button', { name: /^Approve/ })
  await expect(approve).toBeVisible()
  await approve.click()
  await expect(workspace.getByText('Done — all three customers have been reminded.')).toBeVisible()
  await expect(workspace.locator('[data-slot=approval][data-status=approved]')).toBeVisible()
  // The new conversation is listed and named after its first message.
  await expect(column.getByRole('button', { name: /Remind the late customers/ })).toHaveAttribute('aria-current', 'true')

  // A reload opens the same conversation from the DataProvider.
  await page.reload()
  await expect(workspace.getByText('Done — all three customers have been reminded.')).toBeVisible()

  await column.getByRole('button', { name: 'New chat' }).click()
  await expect(page).toHaveURL(/\/assistant$/)
  await expect(workspace.getByText('What can I help with?')).toBeVisible()

  // Leaving the page gives the column back to the menu.
  await page.goto('/ui/ai')
  await expect(page.getByTestId('admin-sidebar')).toBeVisible()
})
