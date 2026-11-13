import { expect, test } from '@playwright/test'

// The base script and JSON files only: menus, messages, pages and a plain
// JavaScript extension module, served without any bundler.
test('boots a complete Admin from the prebuilt base and JSON', { tag: '@smoke' }, async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await page.getByTestId('admin-login-username').fill('admin')
  await page.getByTestId('admin-login-password').fill('admin')
  await page.getByTestId('admin-login-submit').click()

  // Menu labels come from locales/zh-CN.json through labelKey.
  await expect(page.getByRole('link', { name: '首页' }).first()).toBeVisible()
  await expect(page.getByText('Served without a build')).toBeVisible()

  // A component registered by ext/order-summary.js reads orders with useList.
  await page.getByRole('link', { name: '订单' }).first().click()
  await expect(page.getByText('Latest orders')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'ORD-00001' })).toBeVisible()
  expect(await page.evaluate(() => Object.keys((window as unknown as { LumiAdmin: { runtime: object } }).LumiAdmin.runtime))).toEqual(['React', 'jsx', 'lumi', 'ui', 'admin', 'jsonRender', 'z'])

  // pages/report.js: a page written as a plain JavaScript module, given the runtime.
  await page.getByRole('link', { name: '报表' }).first().click()
  await expect(page.getByText('Order report')).toBeVisible()
  await expect(page.getByText(/^\d+ orders in total$/)).toBeVisible()
  await page.goto('/report?period=2026-10')
  await expect(page.getByText('Period 2026-10')).toBeVisible()
  expect(errors).toEqual([])
})

// The same JSON with `auth.mode: "cookie"`: the server keeps the session
// in a cookie, the page stores no token, and writes echo the CSRF cookie.
test('signs in with a cookie session from config.json alone', { tag: '@smoke' }, async ({ page }) => {
  await page.route('**/config.json', async (route) => {
    const response = await route.fetch()
    const config = await response.json() as { auth: Record<string, unknown> }
    config.auth = { mode: 'cookie', csrf: { cookie: 'XSRF-TOKEN', header: 'X-XSRF-TOKEN' } }
    await route.fulfill({ response, json: config })
  })
  const signed: Array<{ authorization?: string, cookie: boolean }> = []
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:3002/orders'))
      void request.allHeaders().then(headers => signed.push({ authorization: headers.authorization, cookie: Boolean(headers.cookie?.includes('lumi_session=')) }))
  })
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await page.getByTestId('admin-login-username').fill('admin')
  await page.getByTestId('admin-login-password').fill('admin')
  await page.getByTestId('admin-login-submit').click()
  await expect(page.getByRole('link', { name: '首页' }).first()).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('lumi_base_token'))).toBeNull()

  await page.getByRole('link', { name: '订单' }).first().click()
  await expect(page.getByRole('cell', { name: 'ORD-00001' })).toBeVisible()
  await expect.poll(() => signed.length).toBeGreaterThan(0)
  expect(signed.every(item => item.cookie && !item.authorization)).toBe(true)

  // A reload restores the session through `me`, with nothing stored in the page.
  await page.reload()
  await expect(page.getByRole('cell', { name: 'ORD-00001' })).toBeVisible()
})
