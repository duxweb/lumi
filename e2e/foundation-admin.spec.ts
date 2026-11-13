import { expect, test } from '@playwright/test'

test.describe('compiled foundation delivery', () => {
  test('loads remote manifest, page schema, and theme JSON', { tag: '@smoke' }, async ({ page }) => {
    const requests: string[] = []
    page.on('request', request => requests.push(new URL(request.url()).pathname))

    await page.goto('/')
    await expect(page.getByText('Remote foundation is running')).toBeVisible()
    await expect(page.getByText('One Spec, independently deployed')).toBeVisible()
    expect(requests).toEqual(expect.arrayContaining(['/theme.json', '/manifest.json', '/pages/home.json']))
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lumi-theme-primary').trim())).toBe('#2563eb')
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lumi-theme-font-body').trim())).toBe('15px')
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lumi-theme-radius').trim())).toBe('0.875rem')
  })

  test('renders a precompiled host component referenced by remote JSON', async ({ page }) => {
    await page.goto('/workflow')
    await expect(page.getByTestId('workflow-designer')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Purchase approval' })).toBeVisible()
    await expect(page.getByText('Workflow #42: Request → Review → Approved')).toBeVisible()
    await expect(page.getByText('Approved')).toBeVisible()
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lumi-theme-primary').trim())).toBe('#2563eb')
  })
})
