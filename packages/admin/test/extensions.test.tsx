// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { adminManifestSchema } from '../src/config'
import { composeAdminExtensions, createAssistantContextRegistry, mergeAssistantAdditions, useAssistantContext } from '../src/react/index'

;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('extension composition', () => {
  it('keeps every module\'s event and workspace listener, in order, past one that throws', async () => {
    const heard: string[] = []
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const merged = composeAdminExtensions([
      { onEvent: ({ name }) => { heard.push(`a:${name}`) }, onWorkspaceChange: value => heard.push(`a:${value}`) },
      { onEvent: () => { throw new Error('broken') } },
      { onEvent: async ({ name }) => { heard.push(`c:${name}`) }, onWorkspaceChange: value => heard.push(`c:${value}`) },
    ])
    await merged.onEvent!({ name: 'assistant.command', payload: {} })
    merged.onWorkspaceChange!('retail')
    expect(heard).toEqual(['a:assistant.command', 'c:assistant.command', 'a:retail', 'c:retail'])
    expect(error).toHaveBeenCalledWith('[lumi-admin] an onEvent listener failed on "assistant.command"', expect.any(Error))
    error.mockRestore()
  })

  it('joins assistant commands and @ tabs, and reports an action two modules register', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const merged = composeAdminExtensions([
      { handlers: { archive: vi.fn() }, assistantCommands: [{ value: 'late', label: 'Late' }], assistantMentions: { types: [{ value: 'orders', label: 'Orders' }], sources: { orders: { resource: 'orders' } } } },
      { handlers: { archive: vi.fn() }, assistantCommands: [{ value: 'report', label: 'Report' }], assistantMentions: { types: [{ value: 'customers', label: 'Customers' }], sources: { customers: { resource: 'customers' } } } },
    ])
    expect(merged.assistantCommands?.map(command => command.value)).toEqual(['late', 'report'])
    expect(merged.assistantMentions?.types?.map(type => type.value)).toEqual(['orders', 'customers'])
    expect(Object.keys(merged.assistantMentions?.sources ?? {})).toEqual(['orders', 'customers'])
    expect(warn).toHaveBeenCalledWith('[lumi-admin] two extensions register the "archive" action; the later one is used')
    const reports = { getList: vi.fn() } as never
    const providers = composeAdminExtensions([{ dataProviders: { reports } }, { dataProviders: { legacy: reports } }])
    expect(Object.keys(providers.dataProviders ?? {})).toEqual(['reports', 'legacy'])
    warn.mockRestore()
  })

  it('merges upload and agent options field by field, de-duplicates @ options by kind, and reports a replaced component', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const headers = (): Record<string, string> => ({ 'X-Module': 'a' })
    const merged = composeAdminExtensions([
      { upload: { headers }, agent: { endpoint: '/a' }, assistantMentions: { options: [{ value: 1, label: 'Order 1', type: 'orders' }] } },
      { upload: { fieldName: 'file' }, assistantMentions: { options: [{ value: 1, label: 'Customer 1', type: 'customers' }, { value: 1, label: 'Order 1 (new)', type: 'orders' }] } },
      { components: { Button: { render: () => null } } },
    ])
    expect(merged.upload).toEqual({ headers, fieldName: 'file' })
    expect(merged.agent).toEqual({ endpoint: '/a' })
    expect(merged.assistantMentions?.options?.map(option => option.label)).toEqual(['Order 1 (new)', 'Customer 1'])
    expect(warn).toHaveBeenCalledWith('[lumi-admin] an extension registers the "Button" component again; the later one is used')
    warn.mockRestore()
  })
})

describe('manifest assistant', () => {
  it('validates app.assistant and adds module commands after the manifest\'s, the later one winning by value', () => {
    const manifest = adminManifestSchema.parse({
      app: {
        id: 'shop',
        assistant: {
          endpoint: '/agent/chat',
          mentions: { types: [{ value: 'orders', label: 'Orders' }], sources: { orders: { resource: 'orders', labelField: 'number' } } },
          commands: [{ value: 'late', label: 'Late orders', prompt: 'Which orders are late?' }],
        },
      },
      routes: [],
    })
    const { commands, mentions } = mergeAssistantAdditions(manifest.app.assistant!, {
      commands: [{ value: 'late', label: 'Late (module)' }, { value: 'open', label: 'Open' }],
      mentions: { types: [{ value: 'customers', label: 'Customers' }], sources: { customers: { resource: 'customers' } } },
    })
    expect(commands).toEqual([{ value: 'late', label: 'Late (module)' }, { value: 'open', label: 'Open' }])
    expect(mentions?.types?.map(type => type.value)).toEqual(['orders', 'customers'])
    expect(Object.keys(mentions?.sources ?? {})).toEqual(['orders', 'customers'])
    expect(() => adminManifestSchema.parse({ app: { id: 'shop', assistant: { title: 'No endpoint' } }, routes: [] })).toThrow()
  })
})

describe('assistant context', () => {
  it('lists what mounted components register, once by id, and drops it when they unmount or clear it', async () => {
    const registry = createAssistantContextRegistry()
    const { AssistantContextProvider } = await import('../src/react/assistant-context')
    function Page({ items }: { items: { id: string, label: string }[] }): null {
      useAssistantContext(items)
      return null
    }
    const root = createRoot(document.createElement('div'))
    const render = (node: ReactNode): Promise<void> => act(async () => root.render(<AssistantContextProvider registry={registry}>{node}</AssistantContextProvider>))
    await render(
      <>
        <Page items={[{ id: 'orders:1', label: 'ORD-1' }]} />
        <Page items={[{ id: 'orders:1', label: 'ORD-1' }, { id: 'customers:2', label: 'Ada' }]} />
      </>,
    )
    expect(registry.getSnapshot().map(item => item.id)).toEqual(['orders:1', 'customers:2'])
    await render(<Page items={[]} />)
    expect(registry.getSnapshot()).toEqual([])
    await act(async () => root.unmount())
  })
})

describe('extension actions', () => {
  it('puts every extension action in the catalog, checking params only where a definition is given', async () => {
    const { validateDocument } = await import('@duxweb/lumi')
    const { z } = await import('zod')
    const merged = composeAdminExtensions([{
      handlers: { approve: vi.fn(), ping: vi.fn() },
      actions: { approve: { params: z.strictObject({ id: z.number() }), description: 'Approve a request.' } },
    }])
    const page = (action: string, params: Record<string, unknown>) => ({
      root: 'button',
      elements: { button: { type: 'Button', props: { label: 'Go' }, on: { press: { action, params } }, children: [] } },
    })
    expect(validateDocument(page('approve', { id: 1 }), merged.catalog!).valid).toBe(true)
    expect(validateDocument(page('approve', { id: 'x' }), merged.catalog!).valid).toBe(false)
    expect(validateDocument(page('ping', { anything: true }), merged.catalog!).valid).toBe(true)
    expect(validateDocument(page('missing', {}), merged.catalog!).valid).toBe(false)
  })
})
