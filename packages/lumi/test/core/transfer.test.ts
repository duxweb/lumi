import type { NotificationParams } from '../../src/core/providers/notification.js'
import type { TransferFile } from '../../src/core/transfer.js'
import { createStateStore } from '@json-render/core'
import { QueryClient } from '@tanstack/query-core'
import { describe, expect, it, vi } from 'vitest'
import { exportListParamsSchema } from '../../src/catalog/index.js'
import { createLumiHandlers } from '../../src/core/actions.js'
import { createLumi } from '../../src/core/context.js'
import { createSimpleDataProvider } from '../../src/core/data/simpleDataProvider.js'
import { createHttpClient } from '../../src/core/http.js'
import { createTenantProvider } from '../../src/core/providers/tenant.js'
import { downloadExport, exportFile, fetchAllRecords, importRecords, parseCsv, readRecords, runExport, toCsv } from '../../src/core/transfer.js'

const products = Array.from({ length: 23 }, (_, index) => ({ id: index + 1, name: `Lamp ${index + 1}`, price: index * 10, tags: { color: 'red' } }))

function provider(options: { createMany?: boolean, refuse?: (row: Record<string, unknown>) => boolean } = {}) {
  const created: Record<string, unknown>[] = []
  const getList = vi.fn(async ({ pagination }: { pagination: { page: number, pageSize: number } }) => {
    const start = (pagination.page - 1) * pagination.pageSize
    return { data: products.slice(start, start + pagination.pageSize), total: products.length }
  })
  const create = vi.fn(async ({ variables }: { variables: Record<string, unknown> }) => {
    if (options.refuse?.(variables))
      throw new Error('SKU taken')
    created.push(variables)
    return { data: variables }
  })
  const createMany = vi.fn(async ({ variables }: { variables: Record<string, unknown>[] }) => {
    if (variables.some(row => options.refuse?.(row)))
      throw new Error('Batch refused')
    created.push(...variables)
    return { data: variables }
  })
  return { created, getList, create, createMany, dataProvider: { getList, getOne: vi.fn(), create, update: vi.fn(), deleteOne: vi.fn(), ...(options.createMany ? { createMany } : {}) } }
}

describe('csv', () => {
  it('writes headers, quotes what needs it and neutralizes spreadsheet formulas', () => {
    const csv = toCsv([
      { id: 1, name: 'Desk, oak', note: 'say "hi"', formula: '=SUM(A1)', price: -3, nested: { a: 1 } },
    ], [{ field: 'id', label: 'ID' }, { field: 'name' }, { field: 'note' }, { field: 'formula' }, { field: 'price' }, { field: 'nested.a', label: 'A' }])
    expect(csv).toBe('\uFEFFID,name,note,formula,price,A\r\n1,"Desk, oak","say ""hi""",\'=SUM(A1),-3,1\r\n')
  })

  it('reads quoted fields, line breaks inside quotes, CRLF and a BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","line\nbreak"\r\n"q""q",\n\n')).toEqual([['a', 'b'], ['x, y', 'line\nbreak'], ['q"q', '']])
  })

  it('maps headers by field or label, converts types and ignores unsafe headers', () => {
    const records = readRecords({ name: 'p.csv', content: 'Name,price,active,__proto__,extra\nLamp,12.5,yes,bad,ignored\n' }, [
      { field: 'name', label: 'Name' },
      { field: 'price', type: 'number' },
      { field: 'active', type: 'boolean' },
      { field: '__proto__' },
    ])
    expect(records).toEqual([{ name: 'Lamp', price: 12.5, active: true }])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(readRecords({ name: 'p.csv', content: 'meta.color,name\nred,Lamp' })).toEqual([{ meta: { color: 'red' }, name: 'Lamp' }])
    expect(readRecords({ name: 'p.json', content: '[{"name":"Lamp"}]' })).toEqual([{ name: 'Lamp' }])
  })

  it('round-trips an exported file', () => {
    const columns = [{ field: 'id', type: 'number' as const }, { field: 'name' }, { field: 'tags.color' }]
    const file = exportFile(products.slice(0, 2), { filename: 'products.csv', columns })
    expect(file.name).toBe('products.csv')
    expect(readRecords(file, columns)).toEqual([{ id: 1, name: 'Lamp 1', tags: { color: 'red' } }, { id: 2, name: 'Lamp 2', tags: { color: 'red' } }])
    expect(JSON.parse(exportFile(products.slice(0, 1), { format: 'json', columns: [{ field: 'name' }] }).content)).toEqual([{ name: 'Lamp 1' }])
  })
})

describe('transfer', () => {
  it('loads every page until the total, and stops at maxItems', async () => {
    const { dataProvider, getList } = provider()
    const context = createLumi({ dataProvider: dataProvider as never })
    const progress: number[] = []
    const rows = await fetchAllRecords(context, undefined, { resource: 'products', pageSize: 10, onProgress: value => progress.push(value.loaded) })
    expect(rows).toHaveLength(23)
    expect(progress).toEqual([10, 20, 23])
    expect(getList).toHaveBeenCalledTimes(3)
    expect(await fetchAllRecords(context, undefined, { resource: 'products', pageSize: 10, maxItems: 15 })).toHaveLength(15)
  })

  it('imports in batches through createMany and counts a refused batch as failed rows', async () => {
    const { dataProvider, createMany, created } = provider({ createMany: true, refuse: row => row.name === 'bad' })
    const context = createLumi({ dataProvider: dataProvider as never })
    const records = [{ name: 'a' }, { name: 'b' }, { name: 'bad' }, { name: 'c' }, { name: 'd' }]
    const result = await importRecords(context, undefined, records, { resource: 'products', batchSize: 2 })
    expect(createMany).toHaveBeenCalledTimes(3)
    expect(created.map(row => row.name)).toEqual(['a', 'b', 'd'])
    expect(result).toMatchObject({ total: 5, processed: 5, succeeded: 3, failed: 2, errors: [{ row: 3, message: 'Batch refused' }, { row: 4, message: 'Batch refused' }] })
  })

  it('creates one by one without a batch size, going on past a refused row', async () => {
    const { dataProvider, create, createMany } = provider({ createMany: true, refuse: row => row.name === 'bad' })
    const context = createLumi({ dataProvider: dataProvider as never })
    const result = await importRecords(context, undefined, [{ name: 'a' }, { name: 'bad' }, { name: 'c' }], { resource: 'products' })
    expect(createMany).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ succeeded: 2, failed: 1, errors: [{ row: 2, message: 'SKU taken' }] })
  })

  it('runs exportList and importList from JSON through the host, with progress and result in state', async () => {
    const { dataProvider, created } = provider({ refuse: row => row.name === 'bad' })
    const notices: NotificationParams[] = []
    const toasts: unknown[] = []
    const context = createLumi({
      dataProvider: dataProvider as never,
      notificationProvider: { open: (params) => {
        notices.push(params)
        return ''
      } },
      toastProvider: { open: (params) => {
        toasts.push(params)
        return ''
      } },
    })
    const saved: TransferFile[] = []
    const pick = vi.fn(async () => ({ name: 'in.csv', content: 'Name,Price\nLamp,3\nbad,4\n' }))
    const store = createStateStore({})
    const client = new QueryClient()
    const handlers = createLumiHandlers(context, client, store, { files: { save: file => saved.push(file), pick } })

    await handlers.exportList!({ resource: 'products', filename: 'all', columns: [{ field: 'id' }, { field: 'name', label: 'Name' }], pageSize: 10, progressPath: '/export' })
    expect(saved[0]!.name).toBe('all.csv')
    expect(saved[0]!.content.split('\r\n')).toHaveLength(25)
    expect(store.get('/export')).toEqual({ loading: false, loaded: 23, total: 23 })

    const columns = [{ field: 'name', label: 'Name' }, { field: 'price', label: 'Price', type: 'number' }]
    await handlers.importList!({ resource: 'products', columns, progressPath: '/import', resultPath: '/imported' })
    expect(pick).toHaveBeenCalledWith('.csv,.json,text/csv,application/json')
    expect(created).toEqual([{ name: 'Lamp', price: 3 }])
    expect(store.get('/import')).toEqual({ loading: false, total: 2, processed: 2, succeeded: 1, failed: 1 })
    expect(store.get('/imported')).toMatchObject({ succeeded: 1, failed: 1, errors: [{ row: 2, message: 'SKU taken' }] })
    expect(notices[0]).toMatchObject({ tone: 'warning', title: 'Imported 1 of 2, 1 refused', description: 'Row 2: SKU taken' })

    // Closing the picker does nothing.
    pick.mockResolvedValueOnce(undefined as never)
    await expect(handlers.importList!({ resource: 'products' })).resolves.toBeUndefined()
    expect(toasts).toEqual([])
  })
})

describe('export paging', () => {
  const rows = Array.from({ length: 230 }, (_, index) => ({ id: index + 1 }))
  const listing = (answer: (page: number, pageSize: number) => { data: unknown[], total: number }) => {
    const getList = vi.fn(async ({ pagination }: { pagination: { page: number, pageSize: number } }) => answer(pagination.page, pagination.pageSize))
    return { getList, context: createLumi({ dataProvider: { getList, getOne: vi.fn(), create: vi.fn(), update: vi.fn(), deleteOne: vi.fn() } as never }) }
  }

  it('reads on past a short page when the backend caps the page size and the total says more', async () => {
    const { getList, context } = listing((page) => {
      const start = (page - 1) * 50
      return { data: rows.slice(start, start + 50), total: rows.length }
    })
    const progress: Array<{ loaded: number, total?: number }> = []
    await expect(fetchAllRecords(context, undefined, { resource: 'orders', onProgress: value => progress.push(value) })).resolves.toHaveLength(230)
    expect(getList).toHaveBeenCalledTimes(5)
    expect(progress.at(-1)).toEqual({ loaded: 230, total: 230 })
  })

  it('reads every full page when the backend sends no total', async () => {
    const { getList, context } = listing((page, pageSize) => {
      const start = (page - 1) * pageSize
      // What the simple provider answers for a body without `meta.total`.
      return { data: rows.slice(start, start + pageSize), total: 0 }
    })
    const progress: Array<{ loaded: number, total?: number }> = []
    await expect(fetchAllRecords(context, undefined, { resource: 'orders', onProgress: value => progress.push(value) })).resolves.toHaveLength(230)
    expect(getList).toHaveBeenCalledTimes(3)
    expect(progress.at(-1)).toEqual({ loaded: 230 })
  })

  it('stops on an empty page even when the total claims more', async () => {
    const { getList, context } = listing(page => ({ data: page === 1 ? rows.slice(0, 100) : [], total: 500 }))
    await expect(fetchAllRecords(context, undefined, { resource: 'orders' })).resolves.toHaveLength(100)
    expect(getList).toHaveBeenCalledTimes(2)
  })
})

describe('import through the simple provider', () => {
  it('counts what the server really created when a row in a batch is refused', async () => {
    const created: unknown[] = []
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const row = JSON.parse(String(init?.body)) as { sku: string }
      if (row.sku === 'bad')
        return new Response(JSON.stringify({ message: 'SKU taken' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
      created.push(row)
      return new Response(JSON.stringify({ data: row }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    const dataProvider = createSimpleDataProvider({ apiUrl: 'https://api.test', http: createHttpClient({ fetcher }) })
    // It has no bulk create, so `batchSize` cannot misreport a half-created batch.
    expect(dataProvider.createMany).toBeUndefined()
    const result = await importRecords(createLumi({ dataProvider }), undefined, [{ sku: 'a' }, { sku: 'b' }, { sku: 'bad' }, { sku: 'c' }], { resource: 'products', batchSize: 4 })
    expect(created).toHaveLength(3)
    expect(result).toMatchObject({ total: 4, succeeded: 3, failed: 1, errors: [{ row: 3, message: 'SKU taken' }] })
  })
})

describe('csv round trip', () => {
  it('reads back what it wrote for values that look like formulas', () => {
    const rows = [{ phone: '+8613800000000', note: '=SUM(A1)', handle: '@lumi', delta: '-5 units', quoted: '\'kept' }]
    const file = exportFile(rows, { format: 'csv' })
    expect(file.content).toContain('\'+8613800000000')
    expect(readRecords(file)).toEqual(rows)
  })

  it('reads a blank number as nothing and keeps text that is not a number', () => {
    const records = readRecords({ name: 'p.csv', content: 'name,price\nA, \nB,"1,234"\nC,N/A\nD,12.5\n' }, [{ field: 'name' }, { field: 'price', type: 'number' }])
    // Never NaN, which JSON would send as null without a word.
    expect(records).toEqual([{ name: 'A', price: null }, { name: 'B', price: '1,234' }, { name: 'C', price: 'N/A' }, { name: 'D', price: 12.5 }])
  })
})

describe('export built by the backend', () => {
  function served(answer: () => Response) {
    const sent: Array<{ url: string, method: string, body: unknown, authorization: string | null }> = []
    const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      sent.push({ url: String(input), method: String(init.method), body: init.body ? JSON.parse(String(init.body)) : undefined, authorization: new Headers(init.headers).get('Authorization') })
      return answer()
    }) as typeof fetch
    const authProvider = { login: async () => ({ success: true }), logout: vi.fn(async () => ({ success: true })), check: async () => ({ authenticated: true }), authorizeRequest: () => ({ headers: { Authorization: 'Bearer reader' } }) }
    const http = createHttpClient({ fetcher, authProvider })
    return { sent, context: createLumi({ authProvider, http, dataProvider: createSimpleDataProvider({ apiUrl: 'https://api.test', http }) }) }
  }
  const chunked = (parts: string[], headers: Record<string, string>): Response => new Response(new ReadableStream({
    start(controller) {
      parts.forEach(part => controller.enqueue(new TextEncoder().encode(part)))
      controller.close()
    },
  }), { headers })

  it('sends the filters to the endpoint, follows the stream and saves the file under the server\'s name', async () => {
    const { sent, context } = served(() => chunked(['PK-part-1', 'part-2'], {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Length': '15',
      'Content-Disposition': 'attachment; filename="fallback.xlsx"; filename*=UTF-8\'\'%E8%AE%A2%E5%8D%95.xlsx',
    }))
    const progress: Array<{ loaded: number, total?: number }> = []
    const saved: Array<{ name: string, type: string }> = []
    const file = await runExport(context, undefined, {
      resource: 'orders',
      url: '/orders/export',
      format: 'xlsx',
      filters: [{ field: 'status', operator: 'eq', value: 'paid' }],
      sorters: [{ field: 'id', order: 'desc' }],
      meta: { tenant: 'a' },
      onProgress: value => progress.push(value),
    }, value => saved.push(value))
    expect(sent).toEqual([{
      url: 'https://api.test/orders/export',
      method: 'POST',
      body: { tenant: 'a', filters: [{ field: 'status', operator: 'eq', value: 'paid' }], sorters: [{ field: 'id', order: 'desc' }], format: 'xlsx' },
      authorization: 'Bearer reader',
    }])
    expect(file.name).toBe('订单.xlsx')
    expect(await (file.content as Blob).text()).toBe('PK-part-1part-2')
    expect(saved).toHaveLength(1)
    expect(progress).toEqual([{ loaded: 0, total: 15 }, { loaded: 9, total: 15 }, { loaded: 15, total: 15 }])
  })

  it('asks with GET through the query, and names the file itself when the server does not', async () => {
    const { sent, context } = served(() => chunked(['a,b'], {}))
    const file = await downloadExport(context, undefined, { resource: 'orders', url: '/orders/export', method: 'GET', filename: 'orders.csv', filters: [{ field: 'q', operator: 'contains', value: 'x' }] }, () => {})
    expect(sent[0]).toMatchObject({ method: 'GET', url: `https://api.test/orders/export?filters=${encodeURIComponent('[{"field":"q","operator":"contains","value":"x"}]')}` })
    expect(file).toMatchObject({ name: 'orders.csv', type: 'application/octet-stream' })
  })

  it('reports a refusal with the backend\'s message and saves nothing', async () => {
    const { context } = served(() => new Response(JSON.stringify({ message: 'Too many rows' }), { status: 422, headers: { 'Content-Type': 'application/json' } }))
    const save = vi.fn()
    await expect(runExport(context, undefined, { resource: 'orders', url: '/orders/export' }, save)).rejects.toMatchObject({ status: 422, message: 'Too many rows' })
    expect(save).not.toHaveBeenCalled()
  })

  it('needs the backend for formats the browser cannot write', async () => {
    const { context } = served(() => new Response(''))
    await expect(runExport(context, undefined, { resource: 'orders', format: 'xlsx' }, () => {})).rejects.toThrow('built by the backend')
    expect(exportListParamsSchema.safeParse({ resource: 'orders', format: 'xlsx' }).success).toBe(false)
    expect(exportListParamsSchema.safeParse({ resource: 'orders', format: 'xlsx', url: '/orders/export' }).success).toBe(true)
  })
})

describe('import performed by the backend', () => {
  class ImportXhr {
    static last: ImportXhr | undefined
    static answer = { status: 200, text: JSON.stringify({ data: { total: 5, succeeded: 3, failed: 2, errors: [{ row: 2, message: 'SKU taken' }, { row: 4, message: 'No price' }] } }) }
    method = ''
    url = ''
    withCredentials = false
    headers: Record<string, string> = {}
    body?: FormData
    status = 0
    statusText = ''
    responseText = ''
    upload: { onprogress?: (event: ProgressEvent) => void } = {}
    onload?: () => void
    constructor() {
      ImportXhr.last = this
    }

    open(method: string, url: string): void {
      this.method = method
      this.url = url
    }

    getAllResponseHeaders(): string {
      return 'content-type: application/json\r\n'
    }

    setRequestHeader(key: string, value: string): void {
      this.headers[key] = value
    }

    send(body: FormData): void {
      this.body = body
      this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 } as ProgressEvent)
      this.upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 2 } as ProgressEvent)
      this.status = ImportXhr.answer.status
      this.responseText = ImportXhr.answer.text
      this.onload?.()
    }
  }

  function setup() {
    vi.stubGlobal('XMLHttpRequest', ImportXhr)
    const notices: NotificationParams[] = []
    const toasts: unknown[] = []
    const getList = vi.fn(async () => ({ data: [], total: 0 }))
    const authProvider = { login: async () => ({ success: true }), logout: async () => ({ success: true }), check: async () => ({ authenticated: true }), authorizeRequest: () => ({ headers: { Authorization: 'Bearer reader' } }) }
    const http = createHttpClient({ authProvider })
    const context = createLumi({
      authProvider,
      http,
      dataProvider: { ...createSimpleDataProvider({ apiUrl: 'https://api.test', http }), getList } as never,
      toastProvider: { open: (params: unknown) => void toasts.push(params) } as never,
      notificationProvider: { open: (params: NotificationParams) => void notices.push(params) } as never,
    })
    const client = new QueryClient()
    const store = createStateStore({})
    const file = new File(['PK-binary'], 'products.xlsx')
    const pickFile = vi.fn(async () => file)
    const handlers = createLumiHandlers(context, client, store, { files: { save: vi.fn(), pick: vi.fn(), pickFile } })
    return { handlers, store, pickFile, notices, toasts, file }
  }

  it('uploads the chosen file as it is and reads the outcome from the answer', async () => {
    const { handlers, store, pickFile, notices, file } = setup()
    const result = await handlers.importList!({ resource: 'products', url: '/products/import', accept: '.xlsx', meta: { mode: 'upsert' }, progressPath: '/import/progress', resultPath: '/import/result' })
    expect(pickFile).toHaveBeenCalledWith('.xlsx')
    expect(ImportXhr.last).toMatchObject({ method: 'POST', url: 'https://api.test/products/import', headers: { Authorization: 'Bearer reader' } })
    expect(ImportXhr.last!.body!.get('file')).toMatchObject({ name: file.name, size: file.size })
    expect(ImportXhr.last!.body!.get('mode')).toBe('upsert')
    expect(result).toMatchObject({ total: 5, succeeded: 3, failed: 2, errors: [{ row: 2, message: 'SKU taken' }, { row: 4, message: 'No price' }] })
    expect(store.get('/import/result')).toEqual(result)
    expect(store.get('/import/progress')).toEqual({ loading: false, total: 5, processed: 5, succeeded: 3, failed: 2, uploaded: 100 })
    expect(notices[0]).toMatchObject({ tone: 'warning' })
    vi.unstubAllGlobals()
  })

  it('takes a bare acceptance as done, and reports a refusal as the request\'s failure', async () => {
    const first = setup()
    ImportXhr.answer = { status: 200, text: '{}' }
    await expect(first.handlers.importList!({ resource: 'products', url: '/products/import' })).resolves.toMatchObject({ total: 0, failed: 0, errors: [] })
    expect(first.toasts).toHaveLength(1)
    ImportXhr.answer = { status: 422, text: JSON.stringify({ message: 'Not a spreadsheet' }) }
    await expect(setup().handlers.importList!({ resource: 'products', url: '/products/import' })).rejects.toMatchObject({ status: 422, message: 'Not a spreadsheet' })
    vi.unstubAllGlobals()
  })
})

it('import must not send later rows to another tenant', async () => {
  const tenant = createTenantProvider({ initial: 'A' })
  const writes: string[] = []
  const context = createLumi({ tenantProvider: tenant, dataProvider: { getList: async () => ({ data: [], total: 0 }), create: async () => {
    writes.push(tenant.get()!)
    tenant.set('B')
    return { data: {} }
  } } as never })
  await expect(importRecords(context, undefined, [{ id: 1 }, { id: 2 }], { resource: 'orders' })).rejects.toThrow('session changed')
  expect(writes).toEqual(['A'])
})
