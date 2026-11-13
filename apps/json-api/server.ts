import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { DynamicRow, Store, User } from './src/data.ts'
import { Buffer } from 'node:buffer'
import http from 'node:http'
import process from 'node:process'
import { cloneSeed } from './src/data.ts'

/** Parsed request JSON. Primitives are not rejected: reading a field off one yields undefined. */
type JsonBody = Record<string, unknown> | null
/** A query value after coercion to the type of the field it filters. */
type FilterValue = string | number | boolean
/** A row as returned to clients, with the password field removed. */
type PublicRow<T> = Omit<T & { password?: unknown }, 'password'>

interface StatusCount {
  status: string
  count: number
}
interface ListResult {
  data: (PublicRow<DynamicRow> | null)[]
  meta: { total: number, page: number, pageSize: number }
}
interface DashboardResult {
  data: {
    totals: { products: number, orders: number, customers: number, revenue: number }
    deltas: { revenue: number, orders: number, customers: number, products: number }
    permissions: string[]
    status: Record<string, number>
    charts: {
      status: StatusCount[]
      revenue: { date: string, revenue: number }[]
      products: StatusCount[]
    }
    rankings: { segments: { segment: string, orders: number, revenue: string }[] }
  }
}
interface UploadResult {
  url: string
  name: string
  size: number
  type: string
  contentType: string | undefined
}

const PORT = Number(process.env.PORT) || 3003
const RESET_TOKEN = process.env.LUMI_RESET_TOKEN
const BEARER_PREFIX_RE = /^Bearer\s+/i
// A filter key is `field` or `field[operator]`.
const FILTER_KEY_RE = /^(.*)\[(ne|lt|lte|gt|gte|like|nlike|in|nin|between|null|nnull)\]$/
const UPLOAD_FILENAME_RE = /filename="([^"]+)"/
const UPLOAD_CONTENT_TYPE_RE = /Content-Type:\s*([^\r\n]+)/i
const UNSAFE_FILENAME_CHARS_RE = /[^\w.-]+/g
const sessions = new Map<string, number>()
let stores = cloneSeed()
let userSeq = stores.users.nextId

function json(res: ServerResponse, status: number, body?: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Lumi-Reset-Token' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}
const error = (res: ServerResponse, status: number, message: string, code: string | number = status): void => json(res, status, { code, message })
function read(req: IncomingMessage): Promise<JsonBody> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      }
      catch {
        resolve(null)
      }
    })
  })
}
function readRaw(req: IncomingMessage): Promise<Buffer> {
  return new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}
const number = (value: string | undefined): string | number | undefined => value === '' || value === undefined ? value : Number.isNaN(Number(value)) ? value : Number(value)
function filterValue(current: unknown, value: string): FilterValue {
  if (typeof current === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? value : parsed
  }
  if (typeof current === 'boolean')
    return value === 'true' ? true : value === 'false' ? false : value
  return value
}
const permissions = (user: User | null | undefined): string[] => stores.roles.rows.find(role => role.code === user?.role)?.permissions ?? []
const publicUser = <T extends object>(user: T | null | undefined): PublicRow<T> | null => user ? (({ password: _password, ...safe }: T & { password?: unknown }) => safe)(user as T & { password?: unknown }) : null
function tokenUser(req: IncomingMessage): { token?: string, user?: number } {
  const token = req.headers.authorization?.replace(BEARER_PREFIX_RE, '')
  return token ? { token, user: sessions.get(token) } : {}
}
const can = (user: User, resource: string, action: string): boolean => permissions(user).some(item => item === '*:*' || item === `${resource}:*` || item === `${resource}:${action}`)

function compareFilter(current: unknown, operator: string, values: FilterValue[]): boolean {
  const expected = values[0]
  // Rows hold arbitrary client JSON; the comparisons below keep JavaScript's coercion for it.
  const value = current as FilterValue
  if (operator === 'like')
    return String(current ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
  if (operator === 'nlike')
    return !String(current ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
  if (operator === 'in')
    return values.includes(value)
  if (operator === 'nin')
    return !values.includes(value)
  if (operator === 'between')
    return value >= values[0]! && value <= values[1]!
  if (operator === 'null')
    return current === null || current === undefined
  if (operator === 'nnull')
    return current !== null && current !== undefined
  if (operator === 'ne')
    return current !== expected
  if (operator === 'lt')
    return value < expected!
  if (operator === 'lte')
    return value <= expected!
  if (operator === 'gt')
    return value > expected!
  if (operator === 'gte')
    return value >= expected!
  return current === expected
}

function list(store: Store<DynamicRow>, query: URLSearchParams): ListResult {
  let rows = store.rows.slice()
  const ids = query.getAll('ids[]').concat(query.getAll('ids')).map(number).filter(Number.isFinite)
  if (ids.length)
    rows = rows.filter(row => ids.includes(Number(row.id)))
  const processedFilters = new Set<string>()
  for (const [rawKey, raw] of query.entries()) {
    if (['page', 'pageSize', 'ids[]', 'ids', 'sort'].includes(rawKey) || raw === '' || processedFilters.has(rawKey))
      continue
    processedFilters.add(rawKey)
    const key = rawKey.endsWith('[]') ? rawKey.slice(0, -2) : rawKey
    const match = FILTER_KEY_RE.exec(key)
    const field = match?.[1] ?? key
    const operator = match?.[2] ?? (rawKey.endsWith('[]') ? 'in' : 'eq')
    if (!rows.some(row => Object.hasOwn(row, field)))
      continue
    rows = rows.filter((row) => {
      const current = row[field]
      const values = query.getAll(rawKey).map(value => filterValue(current, value))
      return compareFilter(current, operator, values)
    })
  }
  const sorters = (query.get('sort') ?? '').split(',').flatMap((value) => {
    // `-field` sorts descending.
    const name = value.trim()
    const field = name.startsWith('-') ? name.slice(1) : name
    return field && rows.some(row => Object.hasOwn(row, field))
      ? [{ field, order: name.startsWith('-') ? 'desc' : 'asc' }]
      : []
  })
  if (sorters.length) {
    rows.sort((left, right) => {
      for (const sorter of sorters) {
        const leftValue = left[sorter.field] as FilterValue
        const rightValue = right[sorter.field] as FilterValue
        const result = leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0
        if (result)
          return result * (sorter.order === 'asc' ? 1 : -1)
      }
      return 0
    })
  }
  const total = rows.length
  const page = Math.max(1, Number(query.get('page')) || 1)
  const paginated = query.has('page') || query.has('pageSize')
  const pageSize = paginated ? Math.min(100, Math.max(1, Number(query.get('pageSize')) || 10)) : total
  const data = paginated ? rows.slice((page - 1) * pageSize, page * pageSize) : rows
  return { data: data.map(publicUser), meta: { total, page, pageSize } }
}

function dashboard(user: User): DashboardResult {
  const { rows: orders } = stores.orders
  const { rows: products } = stores.products
  return { data: { totals: { products: products.length, orders: orders.length, customers: stores.customers.rows.length, revenue: orders.reduce((sum, row) => sum + Number(row.total || 0), 0) }, deltas: { revenue: 12.5, orders: 8.2, customers: 6.7, products: -3.1 }, permissions: permissions(user), status: Object.fromEntries(['pending', 'paid', 'shipped'].map(status => [status, orders.filter(order => order.status === status).length])), charts: { status: ['pending', 'paid', 'packed', 'shipped', 'cancelled'].map(status => ({ status, count: orders.filter(order => order.status === status).length })), revenue: orders.slice(0, 8).reverse().map(order => ({ date: order.createdAt.slice(5, 10), revenue: order.total })), products: ['draft', 'active', 'archived'].map(status => ({ status, count: products.filter(product => product.status === status).length })) }, rankings: { segments: [{ segment: 'Enterprise', orders: 42, revenue: '$128,400' }, { segment: 'Retail', orders: 36, revenue: '$82,900' }, { segment: 'Partner', orders: 28, revenue: '$74,300' }] } } }
}

function upload(buffer: Buffer, headers: IncomingHttpHeaders): UploadResult {
  const text = buffer.toString('latin1')
  const filename = UPLOAD_FILENAME_RE.exec(text)?.[1] ?? `upload-${Date.now()}`
  const type = UPLOAD_CONTENT_TYPE_RE.exec(text)?.[1] ?? 'application/octet-stream'
  return { url: `/uploads/${Date.now()}-${filename.replace(UNSAFE_FILENAME_CHARS_RE, '-')}`, name: filename, size: buffer.length, type, contentType: headers['content-type'] }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS')
    return json(res, 204)
  const url = new URL(req.url!, `http://127.0.0.1:${PORT}`)
  if (url.pathname === '/health')
    return json(res, 200, { ok: true, service: 'lumi-json-api' })
  if (url.pathname === '/__reset' && req.method === 'POST') {
    if (!RESET_TOKEN)
      return error(res, 404, 'not found', 'not_found')
    if (req.headers['x-lumi-reset-token'] !== RESET_TOKEN)
      return error(res, 403, 'reset token required', 'reset_forbidden')
    stores = cloneSeed()
    userSeq = stores.users.nextId
    return json(res, 200, { data: { reset: true } })
  }
  if ((url.pathname === '/login' || url.pathname === '/auth/login') && req.method === 'POST') {
    const body = await read(req)
    if (!body?.username || !body?.password)
      return error(res, 401, 'username and password are required', 'invalid_credentials')
    const user = stores.users.rows.find(item => item.role === body.username || item.email === body.username)
    if (!user)
      return error(res, 401, 'invalid username or password', 'invalid_credentials')
    const token = `lumi-demo-${user.id}-${Date.now()}`
    sessions.set(token, user.id)
    return json(res, 200, { data: { token, user: publicUser(user), permissions: permissions(user) } })
  }
  if ((url.pathname === '/register' || url.pathname === '/auth/register') && req.method === 'POST') {
    const body = await read(req)
    if (!body?.name || !body?.email || !body?.password)
      return error(res, 422, 'name, email and password are required', 'validation_error')
    if (stores.users.rows.some(item => item.email === body.email))
      return error(res, 409, 'email is already registered', 'email_exists')
    const user: User = { id: ++userSeq, name: body.name as string, email: body.email as string, role: 'support', active: true, password: body.password as string }
    stores.users.nextId = userSeq
    stores.users.rows.push(user)
    const token = `lumi-demo-${user.id}-${Date.now()}`
    sessions.set(token, user.id)
    return json(res, 201, { data: { token, user: publicUser(user), permissions: permissions(user) } })
  }
  const auth = tokenUser(req)
  const user = stores.users.rows.find(item => item.id === auth.user)
  if ((url.pathname === '/logout' || url.pathname === '/auth/logout') && req.method === 'POST') {
    if (auth.token)
      sessions.delete(auth.token)
    return json(res, 200, { data: { success: true } })
  }
  if (!user)
    return error(res, 401, 'authentication required', 'unauthorized')
  if (url.pathname === '/me' || url.pathname === '/auth/me')
    return json(res, 200, { data: { user: publicUser(user), permissions: permissions(user) } })
  if (url.pathname === '/dashboard')
    return json(res, 200, dashboard(user))
  if (url.pathname === '/upload' && req.method === 'POST')
    return json(res, 201, { data: upload(await readRaw(req), req.headers) })

  const parts = url.pathname.split('/').filter(Boolean)
  const resource = parts[0] as string
  const action = parts[1]
  const store = (stores as unknown as Record<string, Store<DynamicRow> | undefined>)[resource]
  if (!store)
    return error(res, 404, 'resource not found', 'not_found')
  if (action === 'batch' && req.method === 'POST') {
    const body = await read(req)
    if (!body || typeof body !== 'object')
      return error(res, 400, 'JSON body is required', 'invalid_json')
    const batchAction = body.action ?? 'delete'
    const ids = ((body.ids ?? []) as unknown[]).map(Number).filter(Number.isFinite)
    if (batchAction !== 'create' && !ids.length)
      return error(res, 422, 'ids are required', 'validation_error')
    if (!can(user, resource, batchAction === 'delete' ? 'delete' : batchAction === 'create' ? 'create' : 'edit'))
      return error(res, 403, 'forbidden', 'forbidden')
    const selected = store.rows.filter(row => ids.includes(Number(row.id)))
    if (batchAction === 'create') {
      if (!Array.isArray(body.data) || !body.data.length)
        return error(res, 422, 'data must be a non-empty array', 'validation_error')
      const created = (body.data as (Record<string, unknown> | null)[]).map((input) => {
        const now = new Date().toISOString()
        const row: DynamicRow = { ...(input ?? {}), id: ++store.nextId, createdAt: now, updatedAt: now }
        delete row.password
        store.rows.push(row)
        return publicUser(row)
      })
      return json(res, 201, { data: created })
    }
    if (batchAction === 'delete') {
      store.rows = store.rows.filter(row => !ids.includes(Number(row.id)))
      return json(res, 200, { data: selected.map(row => ({ id: row.id })) })
    }
    if (batchAction === 'update') {
      store.rows = store.rows.map(row => ids.includes(Number(row.id)) ? { ...row, ...(body.data ?? {}), id: row.id, updatedAt: new Date().toISOString() } : row)
      return json(res, 200, { data: store.rows.filter(row => ids.includes(Number(row.id))) })
    }
    return error(res, 400, 'unsupported batch action', 'invalid_action')
  }
  const id = action === undefined ? undefined : Number(action)
  const operation = req.method === 'GET' ? (id === undefined ? 'list' : 'show') : req.method === 'POST' && id === undefined ? 'create' : (req.method === 'PUT' || req.method === 'PATCH') && id !== undefined ? 'edit' : req.method === 'DELETE' && id !== undefined ? 'delete' : undefined
  if (!operation || (id !== undefined && !Number.isFinite(id)))
    return error(res, 405, 'method not allowed', 'method_not_allowed')
  if (!can(user, resource, operation))
    return error(res, 403, 'forbidden', 'forbidden')
  if (id === undefined && req.method === 'GET')
    return json(res, 200, list(store, url.searchParams))
  if (id === undefined && req.method === 'POST') {
    const body = await read(req)
    if (!body || typeof body !== 'object')
      return error(res, 400, 'JSON body is required', 'invalid_json')
    const now = new Date().toISOString()
    const row: DynamicRow = { ...body, id: ++store.nextId, createdAt: now, updatedAt: now }
    delete row.password
    store.rows.push(row)
    return json(res, 201, { data: publicUser(row) })
  }
  const index = store.rows.findIndex(row => Number(row.id) === id)
  if (index < 0)
    return error(res, 404, `${resource} not found`, 'not_found')
  if (req.method === 'GET')
    return json(res, 200, { data: publicUser(store.rows[index]) })
  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = await read(req)
    if (!body || typeof body !== 'object')
      return error(res, 400, 'JSON body is required', 'invalid_json')
    store.rows[index] = { ...store.rows[index], ...body, id: id!, updatedAt: new Date().toISOString() }
    delete store.rows[index]!.password
    return json(res, 200, { data: publicUser(store.rows[index]) })
  }
  store.rows.splice(index, 1)
  return json(res, 200, { data: { id } })
})

server.listen(PORT, '127.0.0.1', () => process.stdout.write(`[lumi json api] http://127.0.0.1:${PORT}\n`))
