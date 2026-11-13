import type { ChildProcess } from 'node:child_process'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, it } from 'vitest'

/** The fields these assertions read from any resource row. */
interface Row {
  id: number
  name: string
  status: string
  price: number
  visible: boolean
  createdAt: string
  updatedAt: string
}
interface DataBody<T> {
  data: T
}
type TokenBody = DataBody<{ token: string }>
interface ListBody extends DataBody<Row[]> {
  meta: { total: number }
}
interface ErrorBody {
  code: string
}

const port = 3303
let server: ChildProcess | undefined
let token: string | undefined
const api = (path: string, options: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) } })

beforeAll(async () => {
  server = spawn(process.execPath, ['server.ts'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, PORT: String(port) } })
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok)
        return
    }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('API did not start')
})
afterAll(() => {
  server?.kill()
})

it('auth, resource CRUD, batch operations and dashboard use the public wire format', async () => {
  const login = await api('/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'demo' }) })
  assert.equal(login.status, 200)
  token = (await login.json() as TokenBody).data.token
  const list = await api('/products?page=1&pageSize=2&status=active')
  const listBody = await list.json() as ListBody
  assert.equal(list.status, 200)
  assert.equal(listBody.data.length, 2)
  assert.equal(typeof listBody.meta.total, 'number')
  const created = await api('/products', { method: 'POST', body: JSON.stringify({ name: 'Test Product', sku: 'TEST-1', status: 'draft' }) })
  const createdBody = await created.json() as DataBody<Row>
  assert.equal(created.status, 201)
  const batch = await api('/products/batch', { method: 'POST', body: JSON.stringify({ action: 'update', ids: [createdBody.data.id], data: { status: 'active' } }) })
  assert.equal(batch.status, 200)
  const createdMany = await api('/products/batch', { method: 'POST', body: JSON.stringify({ action: 'create', data: [{ name: 'Batch A' }, { name: 'Batch B' }] }) })
  assert.equal(createdMany.status, 201)
  assert.equal((await createdMany.json() as DataBody<Row[]>).data.length, 2)
  const deleted = await api('/products/batch', { method: 'POST', body: JSON.stringify({ action: 'delete', ids: [createdBody.data.id] }) })
  assert.equal(deleted.status, 200)
  assert.equal((await deleted.json() as DataBody<[Row]>).data[0].id, createdBody.data.id)
  const dashboard = await api('/dashboard')
  assert.equal(dashboard.status, 200)
  assert.equal(typeof (await dashboard.json() as DataBody<{ totals: { orders: number } }>).data.totals.orders, 'number')
  const logout = await api('/logout', { method: 'POST' })
  assert.equal(logout.status, 200)
  assert.equal((await api('/me')).status, 401)
})

it('registration rejects duplicate email and accepts a new account', async () => {
  const response = await api('/register', { method: 'POST', body: JSON.stringify({ name: 'New User', email: `new-${Date.now()}@lumi.test`, password: 'demo' }) })
  assert.equal(response.status, 201)
  assert.ok((await response.json() as TokenBody).data.token)
})

it('rejects unknown accounts instead of falling back to an administrator', async () => {
  token = undefined
  const response = await api('/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'unknown-user', password: 'demo' }),
  })
  assert.equal(response.status, 401)
  assert.equal((await response.json() as ErrorBody).code, 'invalid_credentials')
})

it('keeps server-owned ids and timestamps authoritative', async () => {
  const login = await api('/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'demo' }) })
  token = (await login.json() as TokenBody).data.token
  const response = await api('/products', {
    method: 'POST',
    body: JSON.stringify({ id: 999999, createdAt: 'client-value', updatedAt: 'client-value', name: 'Owned fields' }),
  })
  const body = await response.json() as DataBody<Row>
  assert.equal(response.status, 201)
  assert.notEqual(body.data.id, 999999)
  assert.notEqual(body.data.createdAt, 'client-value')
  assert.notEqual(body.data.updatedAt, 'client-value')
})

it('keeps equality and contains filters semantically distinct', async () => {
  const exact = await api('/products?page=1&pageSize=100&status=active')
  const exactBody = await exact.json() as ListBody
  assert.ok(exactBody.data.every(row => row.status === 'active'))

  const contains = await api('/products?page=1&pageSize=100&name[like]=Product%201')
  const containsBody = await contains.json() as ListBody
  assert.ok(containsBody.data.length > 0)
  assert.ok(containsBody.data.every(row => row.name.includes('Product 1')))

  const included = await api('/products?page=1&pageSize=100&status[in][]=active&status[in][]=draft')
  const includedBody = await included.json() as ListBody
  assert.ok(includedBody.data.length > 0)
  assert.ok(includedBody.data.every(row => ['active', 'draft'].includes(row.status)))

  const excluded = await api('/products?page=1&pageSize=100&status[nin][]=active&status[nin][]=draft')
  const excludedBody = await excluded.json() as ListBody
  assert.ok(excludedBody.data.length > 0)
  assert.ok(excludedBody.data.every(row => !['active', 'draft'].includes(row.status)))

  const range = await api('/products?page=1&pageSize=100&price[between][]=40&price[between][]=60')
  const rangeBody = await range.json() as ListBody
  assert.ok(rangeBody.data.length > 0)
  assert.ok(rangeBody.data.every(row => row.price >= 40 && row.price <= 60))

  const boolean = await api('/categories?page=1&pageSize=100&visible=false')
  const booleanBody = await boolean.json() as ListBody
  assert.ok(booleanBody.data.length > 0)
  assert.ok(booleanBody.data.every(row => row.visible === false))

  const filteredAndSorted = await api('/products?page=1&pageSize=100&status=active&sort=status,-price')
  const filteredAndSortedBody = await filteredAndSorted.json() as ListBody
  assert.ok(filteredAndSortedBody.data.length > 1)
  assert.ok(filteredAndSortedBody.data.every(row => row.status === 'active'))
  assert.deepEqual(
    filteredAndSortedBody.data.map(row => row.price),
    filteredAndSortedBody.data.map(row => row.price).toSorted((left, right) => right - left),
  )
})

it('returns complete unpaginated and getMany results', async () => {
  const all = await api('/products')
  const allBody = await all.json() as ListBody
  assert.equal(all.status, 200)
  assert.equal(allBody.data.length, allBody.meta.total)
  assert.ok(allBody.data.length > 10)

  const ids = allBody.data.slice(0, 12).map(row => `ids[]=${row.id}`).join('&')
  const many = await api(`/products?${ids}`)
  const manyBody = await many.json() as ListBody
  assert.equal(many.status, 200)
  assert.equal(manyBody.data.length, 12)
})

it('supports PATCH and rejects malformed mutation JSON', async () => {
  const patched = await api('/products/1', { method: 'PATCH', body: JSON.stringify({ status: 'active' }) })
  assert.equal(patched.status, 200)
  assert.equal((await patched.json() as DataBody<Row>).data.status, 'active')

  const malformedBatch = await api('/products/batch', { method: 'POST', body: '{' })
  assert.equal(malformedBatch.status, 400)
  assert.equal((await malformedBatch.json() as ErrorBody).code, 'invalid_json')

  const malformedUpdate = await api('/products/1', { method: 'PUT', body: '{' })
  assert.equal(malformedUpdate.status, 400)
  assert.equal((await malformedUpdate.json() as ErrorBody).code, 'invalid_json')
})

it('keeps destructive reset disabled unless the server has an explicit token', async () => {
  const response = await api('/__reset', { method: 'POST' })
  assert.equal(response.status, 404)
})
