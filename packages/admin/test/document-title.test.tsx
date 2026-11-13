// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { AdminDocumentTitle, formatDocumentTitle, useDocumentTitle } from '../src/react/index'

;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('document title', () => {
  it('formats the page and app, and drops the separator without a page', () => {
    expect(formatDocumentTitle('{page} · {app}', { page: 'Products', app: 'Lumi' })).toBe('Products · Lumi')
    expect(formatDocumentTitle('{page} · {app}', { app: 'Lumi' })).toBe('Lumi')
    expect(formatDocumentTitle('{app} | {page}', { app: 'Lumi' })).toBe('Lumi')
    expect(formatDocumentTitle('{page}', { app: 'Lumi' })).toBe('Lumi')
  })

  it('names the route, lets a page replace it while mounted, and leaves it alone when off', async () => {
    function Detail({ name }: { name?: string }): null {
      useDocumentTitle(name)
      return null
    }
    const root = createRoot(document.createElement('div'))
    const render = (node: React.ReactNode): Promise<void> => act(async () => root.render(node))
    await render(<AdminDocumentTitle page="Product · 11" app="Lumi" />)
    expect(document.title).toBe('Product · 11 · Lumi')
    await render(<AdminDocumentTitle page="Product · 11" app="Lumi"><Detail name="Desk lamp" /></AdminDocumentTitle>)
    expect(document.title).toBe('Desk lamp · Lumi')
    await render(<AdminDocumentTitle page="Products" app="Lumi" />)
    expect(document.title).toBe('Products · Lumi')
    await render(<AdminDocumentTitle page="Orders" app="Lumi" template={false} />)
    expect(document.title).toBe('Products · Lumi')
    await act(async () => root.unmount())
  })
})
