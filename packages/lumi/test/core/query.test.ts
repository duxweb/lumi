import { describe, expect, it } from 'vitest'
import { aggregateQueryKey, createQueryKey, customQueryKey, dataProviderQueryKey, isOneQueryKeyForIds, listQueryKey, lumiQueryKey, normalizeCustomParams, oneQueryKey, resourceQueryKey } from '../../src/core/query.js'

describe('query keys', () => {
  it('creates a resource prefix shared by every resource query shape', () => {
    expect(lumiQueryKey()).toEqual(['lumi'])
    expect(dataProviderQueryKey('api')).toEqual(['lumi', 'api'])
    const prefix = resourceQueryKey('posts', 'api')
    expect(prefix).toEqual(['lumi', 'api', 'posts'])
    expect(createQueryKey({ dataProviderName: 'api', resource: 'posts', action: 'many' }).slice(0, prefix.length)).toEqual(prefix)
  })

  it('keeps one framework-neutral key shape', () => {
    expect(createQueryKey({ action: 'custom' })).toEqual(['lumi', 'default', '', 'custom', {}])
    expect(listQueryKey('posts', { page: 2 }, 'secondary')).toEqual(['lumi', 'secondary', 'posts', 'list', { page: 2 }])
    expect(aggregateQueryKey('posts', { filters: [] }, 'secondary')).toEqual(['lumi', 'secondary', 'posts', 'aggregate', { filters: [] }])
    expect(oneQueryKey('posts', 7, { locale: 'zh-CN' })).toEqual([
      'lumi',
      'default',
      'posts',
      'one',
      { id: 7, meta: { locale: 'zh-CN' } },
    ])
    expect(customQueryKey({ url: '/stats', query: { range: 'week' } }, 'reporting')).toEqual([
      'lumi',
      'reporting',
      '',
      'custom',
      { url: '/stats', query: { range: 'week' } },
    ])
    expect(normalizeCustomParams({ url: '/stats', method: undefined })).toEqual({ url: '/stats' })
  })

  it('identifies one-query keys for deleted records', () => {
    expect(isOneQueryKeyForIds(oneQueryKey('orders', 42), [41, 42])).toBe(true)
    // A route parameter is a string; the record is the same.
    expect(isOneQueryKeyForIds(oneQueryKey('orders', '42'), [42])).toBe(true)
    expect(isOneQueryKeyForIds(oneQueryKey('orders', '43'), [42])).toBe(false)
    expect(isOneQueryKeyForIds(listQueryKey('orders', {}), [42])).toBe(false)
  })
})

describe('resource names', () => {
  it('treat leading and trailing slashes as the same resource for caches, live events and permissions', async () => {
    const { createSimpleAuthProvider, normalizeResource, resolveDataTarget, createLumi, resourceChannel } = await import('@duxweb/lumi')
    expect(['/shop/orders', 'shop/orders/', ' shop/orders '].map(normalizeResource)).toEqual(['shop/orders', 'shop/orders', 'shop/orders'])
    expect(listQueryKey('/shop/orders', {})).toEqual(listQueryKey('shop/orders', {}))
    expect(resourceQueryKey('shop/orders/')).toEqual(resourceQueryKey('shop/orders'))
    expect(resourceChannel('/shop/orders')).toBe('resources/shop/orders')
    const context = createLumi({ dataProvider: { getList: async () => ({ data: [], total: 0 }) } as never })
    expect(resolveDataTarget(context, { resource: '/shop/orders' }).resource).toBe('shop/orders')
    expect(() => resolveDataTarget(context, { resource: '/' })).toThrow('resource must not be empty')
    const auth = createSimpleAuthProvider({ apiUrl: '/api' })
    auth.getSession().permissions = ['shop:orders:delete']
    await expect(auth.accessProvider.can({ resource: '/shop/orders', action: 'delete' })).resolves.toEqual({ can: true })
  })
})
