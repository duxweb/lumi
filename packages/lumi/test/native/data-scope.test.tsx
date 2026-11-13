// @vitest-environment jsdom
import type { ActionHandler } from '@json-render/core'
import { createLumi } from '@duxweb/lumi'
import { createStateStore } from '@json-render/core'
import { useActions } from '@json-render/react'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { LumiDataProviderScope, LumiProvider, useList } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function provider(rows: { id: number, name: string }[]) {
  return {
    getList: vi.fn(async () => ({ data: rows, total: rows.length })),
    getOne: vi.fn(),
    create: vi.fn(async ({ variables }: { variables: object }) => ({ data: { id: 9, ...variables } })),
    update: vi.fn(),
    deleteOne: vi.fn(),
  }
}

describe('data provider scope', () => {
  it('sends unnamed reads and actions to the scope, keeps explicit names, and caches each provider apart', async () => {
    const main = provider([{ id: 1, name: 'main' }])
    const cms = provider([{ id: 1, name: 'cms' }])
    const context = createLumi({ dataProvider: { default: main as never, cms: cms as never } })
    const client = new QueryClient()
    const seen: Record<string, string | undefined> = {}
    let run: ActionHandler | undefined
    function Read({ label, name }: { label: string, name?: string }): null {
      const list = useList<{ name: string }>({ resource: 'posts', ...(name ? { dataProviderName: name } : {}) })
      seen[label] = list.data?.data[0]?.name
      return null
    }
    function Act(): null {
      run = useActions().handlers.create
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(
      <LumiDataProviderScope name="cms">
        <LumiProvider context={context} queryClient={client} registry={{}} store={createStateStore({})}>
          <Read label="scoped" />
          <Read label="explicit" name="default" />
          <Act />
        </LumiProvider>
      </LumiDataProviderScope>,
    ))
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)))
    expect(seen).toEqual({ scoped: 'cms', explicit: 'main' })
    expect(client.getQueryCache().findAll({ queryKey: ['lumi', 'cms', 'posts'] })).toHaveLength(1)
    expect(client.getQueryCache().findAll({ queryKey: ['lumi', 'default', 'posts'] })).toHaveLength(1)

    await act(async () => {
      await run!({ resource: 'posts', values: { name: 'new' } })
    })
    expect(cms.create).toHaveBeenCalledTimes(1)
    expect(main.create).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })
})
