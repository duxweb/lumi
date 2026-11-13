// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import { createStateStore } from '@json-render/core'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { uiRegistry } from '../src/react/index.js'

const spec: Spec = {
  root: 'table',
  state: { rows: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Lin' }], row: null, opened: null, clicked: null },
  elements: {
    table: {
      type: 'Table',
      props: {
        rows: { $state: '/rows' },
        columns: [{ field: 'name', label: 'Name' }, { field: 'actions', kind: 'actions' }],
        activeRow: { $bindState: '/row' },
      },
      slots: { rowActions: ['edit', 'remove'] },
      on: { rowClick: { action: 'setState', params: { statePath: '/clicked', value: true } } },
    },
    edit: {
      type: 'Button',
      props: { label: 'Edit', appearance: 'ghost', size: 'sm' },
      on: { press: { action: 'setState', params: { statePath: '/opened', value: { $state: '/row/id' } } } },
    },
    remove: {
      type: 'Button',
      props: { label: { $item: 'name' }, appearance: 'ghost', size: 'sm' },
      on: { press: { action: 'remove', params: { id: { $state: '/row/id' }, index: { $index: true } } } },
    },
  },
} as Spec

describe('table rowActions slot', () => {
  it('draws the slot in every row, and each control runs its own action with that row', async () => {
    const store = createStateStore(spec.state)
    const remove = vi.fn(async () => {})
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(
      <JSONUIProvider registry={uiRegistry} store={store} handlers={{ remove }}>
        <Renderer spec={spec} registry={uiRegistry} />
      </JSONUIProvider>,
    ))
    const buttons = (label: string): HTMLButtonElement[] => [...container.querySelectorAll('button')].filter(button => button.textContent?.trim() === label)
    expect(buttons('Edit')).toHaveLength(2)
    expect(buttons('Lin')).toHaveLength(1)
    await act(async () => buttons('Edit')[1]!.click())
    expect(store.get('/opened')).toBe(2)
    // A control in the row does not also open the row.
    expect(store.get('/clicked')).toBeNull()
    await act(async () => buttons('Ada')[0]!.click())
    expect(remove).toHaveBeenCalledWith({ id: 1, index: 0 })
    await act(async () => root.unmount())
    container.remove()
  })
})
