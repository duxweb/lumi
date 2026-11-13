import { createStateStore, defineCatalog } from '@json-render/core'
import { JSONUIProvider, Renderer, useStateStore } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { uiComponentDefinitions } from '../../../ui/src/catalog/index.js'
import { uiRegistry } from '../../../ui/src/react/registry.js'
import {
  lumiActionDefinitions,
  lumiComponentDefinitions,
} from '../../src/catalog/index.js'
import {
  createLumi,
  createLumiHandlers,
  validateDocument,
} from '../../src/index.js'
import { LumiProvider, lumiRegistry, LumiSpecPage, useForm } from '../../src/react/index.js'

const catalog = defineCatalog(schema, {
  components: { ...uiComponentDefinitions, ...lumiComponentDefinitions },
  actions: lumiActionDefinitions,
})
const roots: ReturnType<typeof createRoot>[] = []
afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach(root => root.unmount())
  })
  document.body.replaceChildren()
})
function mount(node: React.ReactNode) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push(root)
  return { host, root, render: () => act(async () => root.render(node)) }
}
function provider() {
  return {
    getList: vi.fn(async () => ({
      data: [{ id: 1, name: 'Order' }],
      total: 1,
    })),
    getOne: vi.fn(),
    create: vi.fn(async ({ variables }) => ({ data: variables })),
    update: vi.fn(),
    deleteOne: vi.fn(),
    custom: vi.fn(async () => ({ data: 'loaded' })),
  }
}

describe('native json-render integration', () => {
  it('accepts native bindings, rejects unknown props/actions and cycles', () => {
    const spec = {
      root: 'input',
      elements: {
        input: {
          type: 'Input',
          props: { value: { $bindState: '/name' } },
          children: [],
          on: {
            change: {
              action: 'setState',
              params: { statePath: '/changed', value: true },
            },
          },
        },
      },
    }
    expect(validateDocument(spec, catalog)).toMatchObject({ valid: true })
    expect(
      validateDocument(
        {
          ...spec,
          elements: {
            input: { ...spec.elements.input, props: { unknown: true } },
          },
        },
        catalog,
      ).valid,
    ).toBe(false)
    expect(
      validateDocument(
        {
          ...spec,
          elements: {
            input: {
              ...spec.elements.input,
              on: { change: { action: 'missing' } },
            },
          },
        },
        catalog,
      ).valid,
    ).toBe(false)
    expect(
      validateDocument(
        {
          ...spec,
          elements: { input: { ...spec.elements.input, children: ['input'] } },
        },
        catalog,
      ).issues.some(issue => issue.code === 'cyclic_reference'),
    ).toBe(true)
    const notice = (actions: unknown[]) => ({
      ...spec,
      elements: { input: { ...spec.elements.input, on: { change: { action: 'notify', params: { title: 'Archived', actions } } } } },
    })
    expect(validateDocument(notice([{ label: 'Undo', action: 'toast', params: { message: 'Restored' } }]), catalog)).toMatchObject({ valid: true })
    expect(validateDocument(notice([{ label: 'Undo', action: 'missing' }]), catalog).issues).toContainEqual(
      expect.objectContaining({ code: 'unknown_action', path: '/elements/input/on/change/params/actions/0/action' }),
    )
    expect(validateDocument(notice([{ label: 'Undo', action: 'toast', params: {} }]), catalog).valid).toBe(false)
  })

  it('supports a custom single-component Catalog and dynamic values', () => {
    const custom = defineCatalog(schema, {
      components: {
        Title: { props: z.strictObject({ text: z.string() }), slots: [] },
      },
      actions: {},
    })
    expect(
      validateDocument(
        {
          root: 'title',
          elements: {
            title: {
              type: 'Title',
              props: { text: { $state: '/title' } },
              children: [],
            },
          },
        },
        custom,
      ).valid,
    ).toBe(true)
    expect(
      validateDocument(
        {
          root: 'title',
          elements: {
            title: { type: 'Title', props: { text: 123 }, children: [] },
          },
        },
        custom,
      ).valid,
    ).toBe(false)
  })

  it('accepts expressions inside a union branch and still rejects a branch that fails elsewhere', () => {
    const table = (empty: unknown) => ({
      root: 'table',
      elements: { table: { type: 'Table', props: { columns: [{ field: 'name' }], rows: [], empty }, children: [] } },
    })
    expect(validateDocument(table({ $t: 'No orders yet' }), catalog).valid).toBe(true)
    expect(validateDocument(table({ title: { $t: 'No records' }, description: { $state: '/hint' }, icon: 'search' }), catalog).valid).toBe(true)
    expect(validateDocument(table({ title: { $t: 'No records' }, description: 3 }), catalog).issues).toContainEqual(
      expect.objectContaining({ code: 'invalid_union', path: '/elements/table/props/empty' }),
    )
    expect(validateDocument(table({ description: { $t: 'Clear the filters.' } }), catalog).valid).toBe(false)
  })

  it('works under the upstream Provider without Lumi services and emits after binding writes', async () => {
    const store = createStateStore({ name: 'before' })
    const read = vi.fn()
    const spec = {
      root: 'input',
      elements: {
        input: {
          type: 'Input',
          props: { value: { $bindState: '/name' }, ariaLabel: 'Name' },
          children: [],
          on: {
            change: { action: 'read', params: { name: { $state: '/name' } } },
          },
        },
      },
    }
    const view = mount(
      <JSONUIProvider registry={uiRegistry} store={store} handlers={{ read }}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    await view.render()
    const input = view.host.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, 'after')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(store.get('/name')).toBe('after')
    expect(read).toHaveBeenCalledWith({ name: 'after' })
  })

  it('loads a Query on mount and uses the same state for linked display components', async () => {
    const data = provider()
    const context = createLumi({ dataProvider: data })
    const registry = { ...uiRegistry, ...lumiRegistry }
    const store = createStateStore({ result: { data: null } })
    const spec = {
      root: 'query',
      elements: {
        query: {
          type: 'Query',
          props: { resource: 'orders', resultPath: '/result' },
          children: ['badge', 'table'],
        },
        table: {
          type: 'Table',
          props: { columns: [{ field: 'name', label: 'Name' }], rows: { $state: '/result/data' }, loading: { $state: '/result/loading' } },
        },
        badge: {
          type: 'Badge',
          props: { label: { $state: '/result/data/0/name' } },
          children: [],
        },
      },
    }
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: 0 } },
    })
    const view = mount(
      <LumiProvider
        context={context}
        queryClient={client}
        registry={registry}
        store={store}
      >
        <Renderer registry={registry} spec={spec} />
      </LumiProvider>,
    )
    await view.render()
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30))
    })
    expect(data.getList).toHaveBeenCalledTimes(1)
    expect(view.host.textContent).toContain('Order')
    expect(store.get('/result/total')).toBe(1)
    client.clear()
  })

  it('awaits async validation, prevents duplicate saves and never closes an invalid form', async () => {
    const data = provider()
    let resolve!: (value: any[]) => void
    const context = createLumi({
      dataProvider: data,
      validator: {
        validate: () =>
          new Promise((done) => {
            resolve = done
          }),
      },
    })
    const store = createStateStore({ form: { name: '' }, open: true })
    const client = new QueryClient()
    const handlers = createLumiHandlers(context, client, store)
    const params = {
      resource: 'orders',
      valuesPath: '/form',
      successState: { '/open': false },
    }
    const first = Promise.resolve(handlers.submitForm!(params))
    await expect(handlers.submitForm!(params)).rejects.toThrow(
      'already submitting',
    )
    resolve([{ path: 'name', code: 'required', message: 'Required' }])
    await expect(first).rejects.toThrow('validation failed')
    expect(data.create).not.toHaveBeenCalled()
    expect(store.get('/open')).toBe(true)
    client.clear()
  })
  it('preserves native uncontrolled state updates and onStateChange callbacks', async () => {
    const changes = vi.fn()
    const data = provider()
    const context = createLumi({ dataProvider: data })
    const spec = {
      root: 'input',
      elements: {
        input: {
          type: 'Input',
          props: { value: { $bindState: '/name' } },
          children: [],
        },
      },
    }
    const view = mount(
      <LumiProvider
        context={context}
        registry={uiRegistry}
        initialState={{ name: 'First' }}
        onStateChange={changes}
      >
        <Renderer registry={uiRegistry} spec={spec} />
      </LumiProvider>,
    )
    await view.render()
    await act(async () => {
      const input = view.host.querySelector('input')!
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, 'Edited')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(changes).toHaveBeenLastCalledWith([
      { path: '/name', value: 'Edited' },
    ])
    await act(async () =>
      view.root.render(
        <LumiProvider
          context={context}
          registry={uiRegistry}
          initialState={{ name: 'Updated' }}
          onStateChange={changes}
        >
          <Renderer registry={uiRegistry} spec={spec} />
        </LumiProvider>,
      ),
    )
    expect(view.host.querySelector('input')!.value).toBe('Updated')
  })

  it('preserves existing native form values and shares duplicate-save protection with JSON handlers', async () => {
    let resolve!: (value: { data: unknown }) => void
    const data = provider()
    data.create = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    ) as any
    const store = createStateStore({ form: { name: 'Native initial value' } })
    const context = createLumi({ dataProvider: data })
    const client = new QueryClient()
    let form!: ReturnType<typeof useForm>
    let native!: ReturnType<typeof useStateStore>
    function Probe() {
      native = useStateStore()
      form = useForm({ resource: 'orders', valuesPath: '/form' })
      return null
    }
    const view = mount(
      <LumiProvider
        context={context}
        registry={uiRegistry}
        store={store}
        queryClient={client}
      >
        <Probe />
      </LumiProvider>,
    )
    await view.render()
    expect(form.values.name).toBe('Native initial value')
    expect(form.isDirty).toBe(false)
    let saving!: Promise<unknown>
    await act(async () => {
      saving = form.submit()
      await Promise.resolve()
    })
    await expect(
      createLumiHandlers(context, client, native).submitForm!({
        resource: 'orders',
        valuesPath: '/form',
      }),
    ).rejects.toThrow('already submitting')
    await act(async () => {
      resolve({ data: form.values })
      await saving
    })
    expect(data.create).toHaveBeenCalledTimes(1)
    client.clear()
  })
  it('names the failing paths when a loaded Spec is rejected', async () => {
    const catalog = defineCatalog(schema, { components: uiComponentDefinitions, actions: {} })
    const view = mount(
      <LumiSpecPage
        catalog={catalog}
        context={createLumi({ dataProvider: provider() })}
        registry={uiRegistry}
        spec={{ root: 'button', elements: { button: { type: 'Button', props: { label: 'Go', appearance: 'glow' }, children: [] } } } as never}
      />,
    )
    await view.render()
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const alert = view.host.querySelector('[role="alert"]')!
    expect(alert.textContent).toContain('Lumi document validation failed')
    expect(alert.querySelector('li code')?.textContent).toBe('/elements/button/props/appearance')
  })
})
