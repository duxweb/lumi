import type { NotificationParams } from '../../src/core/index.js'
import { QueryClient } from '@tanstack/query-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLumi, listQueryKey, MutationUndoneError, oneQueryKey, runMutationMode } from '../../src/core/index.js'

const rows = [{ id: 1, name: 'Lamp' }, { id: 2, name: 'Shade' }]

function setup(notices = true) {
  const opened: NotificationParams[] = []
  const closed: string[] = []
  const context = createLumi({
    dataProvider: { getList: async () => ({ data: [], total: 0 }) } as never,
    ...(notices
      ? { notificationProvider: {
          open: (params: NotificationParams) => {
            opened.push(params)
            return params.key ?? ''
          },
          close: (key: string) => {
            closed.push(key)
          },
        } }
      : {}),
  })
  const client = new QueryClient()
  const list = listQueryKey('products', {})
  const one = oneQueryKey('products', 1)
  const aggregate = ['lumi', 'default', 'products', 'aggregate', {}]
  client.setQueryData(list, { data: rows, total: 2 })
  client.setQueryData(one, { data: rows[0] })
  client.setQueryData(aggregate, { data: { count: 2 } })
  client.setQueryData(['lumi', 'default', 'products', 'infiniteList', {}], { pages: [{ data: rows, total: 2 }], pageParams: [1] })
  return { context, client, list, one, aggregate, opened, closed }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('mutation modes', () => {
  it('waits for the server in pessimistic mode', async () => {
    const { context, client, list } = setup()
    let seen: unknown
    await runMutationMode(context, client, {
      target: { resource: 'products' },
      change: { kind: 'delete', ids: [1] },
      request: async () => {
        seen = client.getQueryData(list)
        return {}
      },
    })
    expect(seen).toEqual({ data: rows, total: 2 })
  })

  it('shows an update at once in lists, pages and the record, and rolls it back on failure', async () => {
    const { context, client, list, one, aggregate } = setup()
    let during: unknown[] = []
    await expect(runMutationMode(context, client, {
      mode: 'optimistic',
      target: { resource: 'products' },
      change: { kind: 'update', ids: ['1'], values: { name: 'Lamp II' } },
      request: async () => {
        during = [client.getQueryData(list), client.getQueryData(one), client.getQueryData(['lumi', 'default', 'products', 'infiniteList', {}]), client.getQueryData(aggregate)]
        throw new Error('refused')
      },
    })).rejects.toThrow('refused')
    expect(during).toEqual([
      { data: [{ id: 1, name: 'Lamp II' }, rows[1]], total: 2 },
      { data: { id: 1, name: 'Lamp II' } },
      { pages: [{ data: [{ id: 1, name: 'Lamp II' }, rows[1]], total: 2 }], pageParams: [1] },
      // Aggregates are left for the refetch.
      { data: { count: 2 } },
    ])
    expect(client.getQueryData(list)).toEqual({ data: rows, total: 2 })
    expect(client.getQueryData(one)).toEqual({ data: rows[0] })
  })

  it('removes deleted rows and lowers the total', async () => {
    const { context, client, list } = setup()
    let during: unknown
    await runMutationMode(context, client, {
      mode: 'optimistic',
      target: { resource: 'products' },
      change: { kind: 'delete', ids: [2] },
      request: async () => {
        during = client.getQueryData(list)
        return {}
      },
    })
    expect(during).toEqual({ data: [rows[0]], total: 1 })
  })

  it('waits with an Undo notice in undoable mode, then sends', async () => {
    vi.useFakeTimers()
    const { context, client, list, opened, closed } = setup()
    const request = vi.fn(async () => ({ ok: true }))
    const done = runMutationMode(context, client, { mode: 'undoable', undoableTimeout: 3000, target: { resource: 'products' }, change: { kind: 'delete', ids: [1, 2] }, request })
    await vi.advanceTimersByTimeAsync(0)
    expect(client.getQueryData(list)).toEqual({ data: [], total: 0 })
    expect(opened[0]).toMatchObject({ title: '2 deleted', description: 'Undo within 3 seconds.', duration: 3000, actions: [{ label: 'Undo' }] })
    await vi.advanceTimersByTimeAsync(2999)
    expect(request).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(done).resolves.toEqual({ ok: true })
    expect(request).toHaveBeenCalledTimes(1)
    expect(closed).toEqual([opened[0]!.key])
  })

  it('puts everything back and sends nothing when the reader presses Undo', async () => {
    vi.useFakeTimers()
    const { context, client, list, opened } = setup()
    const request = vi.fn(async () => ({}))
    const done = runMutationMode(context, client, { mode: 'undoable', target: { resource: 'products' }, change: { kind: 'update', ids: [1], values: { name: 'X' } }, request })
    const undone = expect(done).rejects.toBeInstanceOf(MutationUndoneError)
    await vi.advanceTimersByTimeAsync(0)
    opened[0]!.actions![0]!.onPress()
    await undone
    await vi.advanceTimersByTimeAsync(10_000)
    expect(request).not.toHaveBeenCalled()
    expect(client.getQueryData(list)).toEqual({ data: rows, total: 2 })
  })

  it('behaves as optimistic without a way to offer Undo', async () => {
    const { context, client } = setup(false)
    const request = vi.fn(async () => ({}))
    await runMutationMode(context, client, { mode: 'undoable', target: { resource: 'products' }, change: { kind: 'delete', ids: [1] }, request })
    expect(request).toHaveBeenCalledTimes(1)
  })
})
