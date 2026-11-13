// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { AdminExtension } from '../src/react/extensions'
import { describe, expect, it, vi } from 'vitest'

const mounted = vi.hoisted(() => ({ calls: [] as AdminExtension[], http: { baseUrl: '/api' } }))

vi.mock('../src/react/mountAdmin.js', async (original) => {
  const actual = await original<typeof import('../src/react/mountAdmin')>()
  return {
    ...actual,
    // The base hands its modules the mount's context: the config and the signed client.
    mountAdmin: vi.fn(async (config: never, extensions: (context: unknown) => Promise<AdminExtension>) => {
      mounted.calls.push(await extensions({ config, http: mounted.http }))
      return { unmount: () => {} }
    }),
  }
})
vi.mock('@duxweb/lumi-ui/style.css', () => ({}))
vi.mock('@duxweb/lumi-admin/style.css', () => ({}))

describe('prebuilt base page setup', () => {
  it('takes every LumiAdminSetup entry and later LumiAdmin.use() calls into one mount, in order', async () => {
    const order: string[] = []
    const provider = (name: string) => ({ getList: vi.fn(async () => ({ data: [{ name }], total: 1 })) }) as never
    window.LumiAdminConfig = { data: { url: '/api' }, panels: { manifest: { app: { id: 'shop' }, routes: [] } } } as never
    window.LumiAdminSetup = [
      { dataProviders: { strapi: provider('first') }, onWorkspaceChange: () => order.push('setup') },
      (runtime, { http }) => ({ dataProviders: { cms: provider(`${typeof runtime.lumi.createLumi} ${http.baseUrl}`) } }),
    ]
    await import('../src/base')
    window.LumiAdmin!.use({ dataProviders: { strapi: provider('used') }, onWorkspaceChange: () => order.push('use') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await vi.waitFor(() => expect(mounted.calls).toHaveLength(1), { timeout: 10_000 })
    const [extensions] = mounted.calls
    expect(Object.keys(extensions!.dataProviders ?? {})).toEqual(['strapi', 'cms'])
    await expect((extensions!.dataProviders!.cms as DataProvider).getList({ resource: 'x' })).resolves.toEqual({ data: [{ name: 'function /api' }], total: 1 })
    extensions!.onWorkspaceChange!('retail')
    expect(order).toEqual(['setup', 'use'])
    await vi.waitFor(() => expect(window.LumiAdmin!.current).toBeDefined())
    window.LumiAdmin!.use({})
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('after mount has no effect'))
    warn.mockRestore()
  }, 30_000)
})
