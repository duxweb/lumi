import { QueryClient } from '@tanstack/query-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLumi, createTenantProvider, MutationUndoneError, oneQueryKey, runMutationMode } from '../../src/core/index'
import { readMany } from '../../src/core/providers/data'

afterEach(() => {
  vi.useRealTimers()
})

describe('undoable writes', () => {
  it('drops a write whose tenant changed during the wait instead of sending it to the new tenant', async () => {
    vi.useFakeTimers()
    const tenantProvider = createTenantProvider({ initial: 'a' })
    const context = createLumi({
      dataProvider: { getList: vi.fn(), getOne: vi.fn(), create: vi.fn(), update: vi.fn(), deleteOne: vi.fn() } as never,
      tenantProvider,
      notificationProvider: { open: vi.fn(), close: vi.fn() },
    })
    const client = new QueryClient()
    client.setQueryData(oneQueryKey('orders', 7), { data: { id: 7, name: 'kept' } })
    const request = vi.fn(async () => ({ data: { id: 7 } }))
    const pending = runMutationMode(context, client, {
      mode: 'undoable',
      undoableTimeout: 1000,
      target: { resource: 'orders' },
      change: { kind: 'delete', ids: [7] },
      request,
    })
    const settled = expect(pending).rejects.toBeInstanceOf(MutationUndoneError)
    tenantProvider.set('b')
    await vi.advanceTimersByTimeAsync(1000)
    await settled
    expect(request).not.toHaveBeenCalled()
    expect(client.getQueryData(oneQueryKey('orders', 7))).toEqual({ data: { id: 7, name: 'kept' } })
  })
})

describe('reading several records', () => {
  it('falls back to one getOne per id when the provider has no getMany', async () => {
    const getOne = vi.fn(async ({ id }: { id: number }) => ({ data: { id } }))
    const result = await readMany({ getOne } as never, { resource: 'orders', ids: [1, 2] })
    expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }] })
    expect(getOne).toHaveBeenCalledTimes(2)
  })
})
