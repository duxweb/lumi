import process from 'node:process'
import { expect, test } from '@playwright/test'
import { normalizeBase, withBase } from '../apps/site/paths.mjs'

const siteBase = normalizeBase(process.env.LUMI_SITE_BASE ?? '/lumi/')
const sitePath = (path: string): string => withBase(path, siteBase)

test.describe('official site', () => {
  test('the header reaches every section', { tag: '@smoke' }, async ({ page }) => {
    await page.goto(sitePath('/'))
    const nav = page.locator('.nav__links')
    for (const href of ['/guide/', '/components/', '/api/', '/ai/', '/playground/', '/demo/'])
      await expect(nav.locator(`a[href="${sitePath(href)}"]`)).toBeVisible()
  })

  test('a component page shows a live preview over its Markdown reference', { tag: '@smoke' }, async ({ page }) => {
    await page.goto(sitePath('/components/ui/button/'))
    await expect(page.locator('[data-component-preview="Button"]').getByRole('button', { name: 'Continue' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '示例' })).toBeVisible()
    await expect(page.locator('.prose table code').filter({ hasText: '"sm" | "md" | "lg"' }).first()).toBeVisible()
    await expect(page.locator(`a[href^="${sitePath('/playground/')}#schema="]`)).toBeVisible()
  })

  test('the component overview links every component by purpose', async ({ page }) => {
    await page.goto(sitePath('/components/'))
    await expect(page.getByRole('heading', { name: '数据录入' })).toBeVisible()
    await page.locator(`.prose a[href="${sitePath('/components/ui/cascader/')}"]`).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Cascader' })).toBeVisible()
  })

  test('the playground validates, renders and opens shared pages', async ({ page }) => {
    await page.goto(sitePath('/playground/'))
    await expect(page.getByText('校验通过')).toBeVisible()
    await expect(page.locator('.pg__stage').getByText('订单概览')).toBeVisible()

    const broken = { root: 'x', elements: { x: { type: 'Missing', props: {}, children: [] } } }
    await page.goto(`${sitePath('/playground/')}#schema=${encodeURIComponent(JSON.stringify(broken))}`)
    await expect(page.getByText(/个问题/u)).toBeVisible()
    await expect(page.locator('.pg__issues code').first()).toHaveText('/elements/x/type')

    const shared = { root: 'a', elements: { a: { type: 'Alert', props: { message: 'Shared page' }, children: [] } } }
    await page.goto(`${sitePath('/playground/')}#schema=${encodeURIComponent(JSON.stringify(shared))}`)
    await expect(page.locator('.pg__stage').getByText('Shared page')).toBeVisible()
  })

  test('the playground reads in-browser data through Query', async ({ page }) => {
    await page.goto(sitePath('/playground/'))
    await page.getByRole('navigation', { name: '选择示例' }).getByRole('button', { name: '读取远程数据' }).click()
    await expect(page.locator('.pg__stage').getByText('ORD-2018')).toBeVisible()
  })

  test('the playground opens a component\'s demo from the first column', async ({ page }) => {
    await page.goto(sitePath('/playground/'))
    const list = page.getByRole('navigation', { name: '选择示例' })
    await list.getByLabel('搜索示例和组件').fill('timeline')
    await expect(list.getByRole('button')).toHaveCount(1)
    await list.getByRole('button', { name: 'Timeline', exact: true }).click()
    await expect(page.getByText('校验通过')).toBeVisible()
    await expect(page.locator('.pg__stage [data-slot="timeline"], .pg__stage ol, .pg__stage ul').first()).toBeVisible()
    // The header spans the window with the page.
    const header = await page.locator('header.nav').boundingBox()
    expect(header!.width).toBeGreaterThan(page.viewportSize()!.width - 2)
  })

  test('the demo is the full admin, signed in, with its data in the browser', { tag: '@smoke' }, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(sitePath('/demo/'))
    await expect(page.getByRole('navigation').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a demo deep link opens its page and the showcase photos load under /demo/', async ({ page }) => {
    await page.goto(sitePath('/demo/ui/overlays-media'))
    await expect(page).toHaveURL(/\/demo\/ui\/overlays-media$/u)
    const photo = page.locator(`img[src="${sitePath('/demo/media/lake.svg')}"]`).first()
    await photo.scrollIntoViewIfNeeded()
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  })

  test('the header leaves the homepage even with the live demo mounted', async ({ page }) => {
    await page.goto(sitePath('/'))
    await expect(page.locator('.window__app').getByRole('navigation').first()).toBeVisible()
    await page.locator(`.nav__links a[href="${sitePath('/guide/')}"]`).click()
    await expect(page).toHaveURL(/\/guide\/$/u)
  })

  test('an unknown address shows the site 404 page', async ({ page }) => {
    await page.goto(sitePath('/no-such-page/'))
    await expect(page.getByRole('heading', { level: 1, name: '页面不存在' })).toBeVisible()
  })

  test('docs pages do not scroll sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const path of ['/', '/guide/getting-started/', '/components/ui/table/', '/playground/']) {
      await page.goto(sitePath(path))
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390)
    }
  })
})
