// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { embeddableUrl, LumiEmbedProvider, LumiIframe } from '../src/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: Array<() => void> = []
afterEach(() => {
  roots.splice(0).forEach(stop => stop())
})

async function render(node: React.ReactNode) {
  const host = document.createElement('div')
  const root = createRoot(host)
  await act(async () => root.render(node))
  roots.push(() => act(() => root.unmount()))
  return host
}

describe('embeddableUrl', () => {
  it('passes this site and https, and refuses every other scheme', () => {
    const own = new URL('/reports/a', location.href).href
    expect(embeddableUrl('/reports/a')).toBe(own)
    expect(embeddableUrl('https://bi.test/sales')).toBe('https://bi.test/sales')
    for (const refused of ['http://bi.test/sales', 'javascript:alert(1)', 'data:text/html,<p>x</p>', 'blob:https://bi.test/1', 'file:///etc/hosts', ''])
      expect(embeddableUrl(refused), refused).toBeUndefined()
  })

  it('keeps to the listed origins, this site always included', () => {
    const origins = ['https://bi.test', 'https://old.test/anything']
    expect(embeddableUrl('https://bi.test/sales', origins)).toBe('https://bi.test/sales')
    expect(embeddableUrl('https://old.test/x', origins)).toBe('https://old.test/x')
    expect(embeddableUrl('https://evil.test/x', origins)).toBeUndefined()
    expect(embeddableUrl('/reports/a', [])).toBe(new URL('/reports/a', location.href).href)
  })
})

describe('lumiIframe', () => {
  it('shows the page in a titled, sandboxed, lazy frame of the given height', async () => {
    const host = await render(<LumiIframe src="https://bi.test/sales" title="Sales report" height={600} allowFullscreen />)
    const frame = host.querySelector('iframe')!
    expect(frame.getAttribute('src')).toBe('https://bi.test/sales')
    expect(frame.title).toBe('Sales report')
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts')
    expect(frame.getAttribute('allow')).toBe('fullscreen')
    expect(frame.getAttribute('loading')).toBe('lazy')
    expect((host.firstElementChild as HTMLElement).style.height).toBe('600px')
  })

  it('lifts the sandbox only when asked', async () => {
    const host = await render(<LumiIframe src="/legacy" title="Legacy" sandbox={false} />)
    expect(host.querySelector('iframe')!.hasAttribute('sandbox')).toBe(false)
  })

  it('shows a notice instead of a refused address or a site outside the list', async () => {
    const scripted = await render(<LumiIframe src="javascript:alert(1)" title="x" />)
    expect(scripted.querySelector('iframe')).toBeNull()
    expect(scripted.querySelector('[role="alert"]')?.textContent).toBe('This address cannot be shown here')
    const outside = await render(<LumiEmbedProvider origins={['https://bi.test']}><LumiIframe src="https://evil.test" title="x" /></LumiEmbedProvider>)
    expect(outside.querySelector('iframe')).toBeNull()
  })
})
