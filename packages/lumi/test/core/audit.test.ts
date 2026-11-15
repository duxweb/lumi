import type { AuditLogEvent } from '../../src/core/providers/audit.js'
import type { NotificationParams } from '../../src/core/providers/notification.js'
import { createStateStore } from '@json-render/core'
import { QueryClient } from '@tanstack/query-core'
import { describe, expect, it, vi } from 'vitest'
import { createLumiHandlers } from '../../src/core/actions.js'
import { createLumi } from '../../src/core/context.js'
import { createDataAuditLogProvider } from '../../src/core/providers/audit.js'
import { importRecords } from '../../src/core/transfer.js'

function setup(options: { failLog?: boolean, notices?: NotificationParams[] } = {}) {
  const events: AuditLogEvent[] = []
  const dataProvider = {
    getList: vi.fn(async () => ({ data: [], total: 0 })),
    getOne: vi.fn(),
    create: vi.fn(async ({ variables }: { variables: Record<string, unknown> }) => ({ data: { id: 41, ...variables } })),
    update: vi.fn(async ({ id, variables }: { id: number, variables: Record<string, unknown> }) => ({ data: { id, ...variables } })),
    deleteOne: vi.fn(async ({ id }: { id: number }) => ({ data: { id } })),
  }
  const context = createLumi({
    dataProvider: dataProvider as never,
    auditLogProvider: {
      create: async (event) => {
        if (options.failLog)
          throw new Error('log down')
        events.push(event)
      },
    },
    ...(options.notices
      ? { notificationProvider: { open: (params: NotificationParams) => {
          options.notices!.push(params)
          return params.key ?? ''
        } } }
      : {}),
  })
  const handlers = createLumiHandlers(context, new QueryClient(), createStateStore({}))
  return { events, context, handlers, dataProvider }
}

const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

describe('audit log', () => {
  it('records accepted writes from JSON actions, naming a created record by its new id', async () => {
    const { events, handlers } = setup()
    await handlers.create!({ resource: 'products', values: { name: 'Lamp' } })
    await handlers.update!({ resource: 'products', id: 7, values: { price: 9 }, meta: { reason: 'sale' } })
    await handlers.delete!({ resource: 'products', id: 7 })
    await settle()
    expect(events).toEqual([
      { action: 'create', resource: 'products', ids: [41], data: { name: 'Lamp' } },
      { action: 'update', resource: 'products', ids: [7], data: { price: 9 }, meta: { reason: 'sale' } },
      { action: 'delete', resource: 'products', ids: [7] },
    ])
  })

  it('records nothing for a refused write, and a failing log does not fail the write', async () => {
    const refused = setup()
    refused.dataProvider.update.mockRejectedValueOnce(new Error('nope'))
    await expect(refused.handlers.update!({ resource: 'products', id: 1, values: {} })).rejects.toThrow('nope')
    await settle()
    expect(refused.events).toEqual([])

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = setup({ failLog: true })
    await expect(broken.handlers.update!({ resource: 'products', id: 1, values: { a: 1 } })).resolves.toBeTruthy()
    await settle()
    expect(warn).toHaveBeenCalledWith('[lumi] The audit log refused an event.', expect.any(Error))
    warn.mockRestore()
  })

  it('records nothing for a write the reader undid', async () => {
    vi.useFakeTimers()
    const notices: NotificationParams[] = []
    const { events, handlers } = setup({ notices })
    const done = handlers.delete!({ resource: 'products', id: 3, mutationMode: 'undoable' })
    const undone = expect(done).rejects.toMatchObject({ name: 'MutationUndoneError' })
    await vi.advanceTimersByTimeAsync(0)
    notices[0]!.actions![0]!.onPress()
    await undone
    await vi.advanceTimersByTimeAsync(10_000)
    expect(events).toEqual([])
    vi.useRealTimers()
  })

  it('records an import as one event with its counts', async () => {
    const { events, context } = setup()
    await importRecords(context, undefined, [{ name: 'a' }, { name: 'b' }], { resource: 'products' })
    await settle()
    expect(events).toEqual([{ action: 'import', resource: 'products', data: { total: 2, succeeded: 2, failed: 0 } }])
  })

  it('keeps the log as a resource: one record by recordId, newest first', async () => {
    const create = vi.fn(async () => ({ data: {} }))
    const getList = vi.fn(async () => ({ data: [{ id: 1, action: 'update', resource: 'orders' }], total: 1 }))
    const log = createDataAuditLogProvider({ dataProvider: { getList, create } as never })
    await log.create!({ action: 'update', resource: 'orders', ids: [9], data: { status: 'paid' } })
    await log.create!({ action: 'deleteMany', resource: 'orders', ids: [1, 2] })
    expect(create.mock.calls.map(([params]) => params)).toEqual([
      { resource: 'audit-logs', variables: { action: 'update', resource: 'orders', ids: [9], data: { status: 'paid' }, recordId: '9' } },
      { resource: 'audit-logs', variables: { action: 'deleteMany', resource: 'orders', ids: [1, 2] } },
    ])
    await expect(log.get!({ resource: 'orders', id: 9 })).resolves.toEqual({ data: [{ id: 1, action: 'update', resource: 'orders' }], total: 1 })
    expect(getList).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'audit-logs',
      filters: [{ field: 'resource', operator: 'eq', value: 'orders' }, { field: 'recordId', operator: 'eq', value: '9' }],
      sorters: [{ field: 'createdAt', order: 'desc' }],
    }))
  })
})
