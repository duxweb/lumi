// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { LumiCodeExample } from '../src/react/pages/LumiCodeExample.js'

async function render(children: ReactNode): Promise<{ container: HTMLElement, cleanup: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(children))
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

describe('code example', () => {
  it('names the section and its result after the title, with the code always rendered', async () => {
    const { container, cleanup } = await render(
      <LumiCodeExample title="setState" description="Writes state." code={<pre>source</pre>} preview={<button type="button">Run</button>} previewLabel="Result" previewActions={<button type="button">Reset</button>} />,
    )
    const section = container.querySelector('section')!
    expect(section.dataset.layout).toBe('split')
    expect(document.getElementById(section.getAttribute('aria-labelledby')!)?.textContent).toBe('setState')
    const result = container.querySelector('[role="region"]')!
    const name = result.getAttribute('aria-labelledby')!.split(' ').map(id => document.getElementById(id)?.textContent).join(' ')
    expect(name).toBe('Result setState')
    expect(container.querySelector('.lumi-code-example__code')?.textContent).toBe('source')
    expect(container.querySelector('details')).toBeNull()
    await cleanup()
  })

  it('gives code without a result the full width and captions code that has no header', async () => {
    const { container, cleanup } = await render(<LumiCodeExample title="Contract" layout="stack" codeLabel="page.json" code={<pre>source</pre>} />)
    expect(container.querySelector('section')?.dataset.layout).toBe('code')
    expect(container.querySelector('[role="region"]')).toBeNull()
    expect(container.querySelector('.lumi-code-example__code .lumi-code-example__bar-label')?.textContent).toBe('page.json')
    await cleanup()
  })
})
