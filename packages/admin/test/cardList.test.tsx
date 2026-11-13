// @vitest-environment jsdom
import type { ComponentRegistry } from '@json-render/react'
import type { ReactNode } from 'react'
import { createLumi, createSimpleDataProvider, LumiProvider } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { LumiCardList, LumiRecordCard } from '../src/react/pages/LumiCardList.js'

const testComponents = {
  Card: ({ children, className }: { children?: ReactNode, className?: string }) => <div className={className}>{children}</div>,
  Button: ({ label, onClick }: { label?: string, onClick?: () => void }) => <button onClick={onClick}>{label}</button>,
}
const registry: ComponentRegistry = Object.fromEntries(Object.entries(testComponents).map(([name, Component]) => [name, ({ element }) => <Component {...element.props as any} />]))

async function render(children: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<LumiProvider context={createLumi({ dataProvider: createSimpleDataProvider({ apiUrl: 'https://example.test' }) })} registry={registry}>{children}</LumiProvider>))
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

describe('card result composition', () => {
  it('renders keyed semantic results with readable metadata and progress', async () => {
    const view = await render(
      <LumiCardList
        items={[{ id: 'a', title: 'Atlas' }, { id: 'b', title: 'Beacon' }]}
        getKey={item => item.id}
        ariaLabel="Projects"
        renderItem={item => (
          <LumiRecordCard title={item.title} description="Delivery plan" meta={<span>Active</span>} fields={[{ key: 'budget', label: 'Budget', value: '$20,000' }]} progress={{ label: 'Delivery progress', value: 42 }} />
        )}
      />,
    )
    expect(view.container.querySelector('ul')?.getAttribute('aria-label')).toBe('Projects')
    expect(view.container.querySelectorAll('li')).toHaveLength(2)
    expect(view.container.querySelector('h2')?.textContent).toBe('Atlas')
    expect(view.container.querySelector('dt')?.textContent).toBe('Budget')
    expect(view.container.querySelector('dd')?.textContent).toBe('$20,000')
    expect(view.container.querySelector('progress')?.value).toBe(42)
    expect(view.container.querySelector('progress')?.getAttribute('aria-label')).toBe('Atlas: Delivery progress')
    await view.cleanup()
  })

  it('provides a recoverable empty state without removing list chrome', async () => {
    const reset = vi.fn()
    const view = await render(<LumiCardList items={[]} getKey={String} renderItem={String} empty={{ title: 'No projects', reason: 'No matches.', nextStep: 'Change the filters.', actionLabel: 'Clear filters', onAction: reset }} />)
    expect(view.container.textContent).toContain('No projects')
    const empty = view.container.querySelector<HTMLElement>('[data-slot="empty"]')!
    expect(empty.dataset.size).toBe('md')
    expect(empty.dataset.tone).toBe('neutral')
    expect(empty.querySelector('[role="heading"][aria-level="2"]')?.textContent).toBe('No projects')
    expect(empty.querySelector('[data-slot="empty-description"]')?.textContent).toBe('No matches.Change the filters.')
    expect(view.container.querySelector('ul')).toBeNull()
    await act(async () => view.container.querySelector('button')?.click())
    expect(reset).toHaveBeenCalledOnce()
    await view.cleanup()
  })

  it('does not render stale actionable cards while loading or after failure', async () => {
    const item = vi.fn(() => <button>Open record</button>)
    for (const state of [
      { kind: 'loading', label: 'Loading projects' },
      { kind: 'error', title: 'Projects unavailable', reason: 'Service failed.', nextStep: 'Retry.' },
    ] as const) {
      const view = await render(<LumiCardList items={['a']} getKey={String} renderItem={item} state={state} />)
      expect(item).not.toHaveBeenCalled()
      expect(view.container.querySelector('button')).toBeNull()
      expect(view.container.querySelector('[role="status"], [role="alert"]')).not.toBeNull()
      if (state.kind === 'error')
        expect(view.container.querySelector('[data-slot="empty"][role="alert"]')?.getAttribute('data-tone')).toBe('danger')
      await view.cleanup()
    }
  })

  it('keeps optional regions absent and percent values within a meaningful range', async () => {
    const view = await render(<LumiRecordCard title="Atlas" progress={{ label: 'Progress', value: 150 }} />)
    expect(view.container.querySelector('dl')).toBeNull()
    expect(view.container.querySelector('footer')).toBeNull()
    expect(view.container.querySelector('progress')?.value).toBe(100)
    expect(view.container.textContent).toContain('100%')
    await view.cleanup()
  })
})
