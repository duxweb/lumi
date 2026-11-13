import { spawn } from 'node:child_process'
import { afterAll, beforeAll, expect, it } from 'vitest'

const port = 39002
const base = `http://127.0.0.1:${port}`
let server: ReturnType<typeof spawn> | undefined

beforeAll(async () => {
  server = spawn(process.execPath, ['mock/server.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), MOCK_AGENT_STEP_MS: '0' },
    stdio: 'ignore',
  })
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`${base}/health`)).ok)
        return
    }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('mock server did not start')
})

afterAll(() => server?.kill())

it('signs in the demo accounts with their shared password only', async () => {
  const login = (username: string, password: string): Promise<Response> => fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
  expect((await login('manager', 'admin')).status).toBe(200)
  const wrong = await login('admin', 'wrong')
  expect(wrong.status).toBe(401)
  expect(await wrong.json()).toEqual({ message: 'Incorrect username or password' })
  expect((await login('nobody', 'admin')).status).toBe(401)
})

it('aggregates every dashboard breakdown over the requested date window', async () => {
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin' }) }).then(response => response.json())
  const headers = { Authorization: `Bearer ${login.data.token}` }
  for (const days of [7, 28, 90]) {
    const { data } = await fetch(`${base}/dashboard?days=${days}`, { headers }).then(response => response.json())
    expect(data.period.days).toBe(days)
    expect(data.charts.revenue).toHaveLength(days)
    expect(data.charts.revenue.reduce((sum, row) => sum + row.revenue, 0)).toBeCloseTo(data.totals.revenue)
    expect(data.charts.status.reduce((sum, row) => sum + row.count, 0)).toBe(data.totals.orders)
    expect(data.rankings.payments.reduce((sum, row) => sum + row.count, 0)).toBe(data.totals.orders)
    expect(data.rankings.customers.reduce((sum, row) => sum + row.spent, 0)).toBeCloseTo(data.totals.revenue)
    expect(data.recent.orders.every(order => order.createdAt >= data.period.start && order.createdAt <= data.period.end)).toBe(true)
  }
})

it('applies the same filters to aggregate and product list requests', async () => {
  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  }).then(response => response.json())
  const headers = { Authorization: `Bearer ${login.data.token}` }
  const list = await fetch(`${base}/products?status=active&page=1&pageSize=10`, { headers }).then(response => response.json())
  const aggregate = await fetch(`${base}/products/aggregate?status=active`, { headers }).then(response => response.json())

  expect(aggregate.data.products).toBe(list.meta.total)
  expect(aggregate.data.active).toBe(list.meta.total)
  expect(aggregate.data.draft).toBe(0)
  expect(aggregate.data.archived).toBe(0)
  expect(aggregate.data.productsSeries).toHaveLength(8)
  expect(aggregate.data.productsSeries.at(-1)).toBe(list.meta.total)
  expect(aggregate.data.activeSeries.at(-1)).toBe(list.meta.total)
  expect(aggregate.data.draftSeries.every(value => value === 0)).toBe(true)
})

it('reports order queue stats that match the rows the list filters return', async () => {
  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  }).then(response => response.json())
  const headers = { Authorization: `Bearer ${login.data.token}` }
  const total = (query: string): Promise<number> => fetch(`${base}/orders?${query}`, { headers }).then(response => response.json()).then(body => body.meta.total)
  const { data } = await fetch(`${base}/orders/stats`, { headers }).then(response => response.json())

  expect(data.total).toBe(await total('page=1'))
  expect(data.toShip).toBe(await total('status=paid'))
  expect(data.awaitingPayment).toBe(await total('status=pending'))
  expect(data.overdue).toBe(await total('overdueHours[gte]=1'))
  // The demo story: one warehouse is behind, and the Agent flags its three late orders.
  expect(data.overdue).toBe(3)
  const late = await fetch(`${base}/orders?overdueHours[gte]=24`, { headers }).then(response => response.json())
  expect(new Set(late.data.map((order: { warehouse: string }) => order.warehouse)).size).toBe(1)
  expect(data.toShip).toBeLessThanOrEqual(15)
  expect(data.refunding).toBe(await total('refunding=true'))
  expect(data.watching).toBeGreaterThan(0)
  expect(data.watching).toBe(await total('watched=true'))
  expect(await total('searchText[like]=blue%20pine')).toBeGreaterThan(0)
})

it('streams scripted agent replies and keeps the conversation behind agent-sessions', async () => {
  const login = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin' }) }).then(response => response.json())
  const headers = { 'Authorization': `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
  const user = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Remind the late customers' }] }
  const chat = (body: unknown): Promise<Response> => fetch(`${base}/agent/chat`, { method: 'POST', headers, body: JSON.stringify(body) })
  const chunks = async (response: Response): Promise<{ type: string, [key: string]: unknown }[]> => {
    const text = await response.text()
    expect(text.endsWith('data: [DONE]\n\n')).toBe(true)
    return text.split('\n\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)))
  }

  const first = await chat({ id: 'mock-chat', trigger: 'submit-message', messages: [user] })
  expect(first.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1')
  const sent = await chunks(first)
  expect(sent[0]).toMatchObject({ type: 'start' })
  expect(sent.find(chunk => chunk.type === 'data-approval')).toMatchObject({ data: { status: 'pending' } })
  expect(sent.at(-1)).toMatchObject({ type: 'finish', finishReason: 'tool-calls' })

  const stored = await fetch(`${base}/agent-sessions/mock-chat`, { headers }).then(response => response.json())
  expect(stored.data.title).toBe('Remind the late customers')
  const reply = stored.data.messages[1]
  expect(reply.parts.find((part: { type: string }) => part.type === 'approval')).toMatchObject({ status: 'pending' })
  const list = await fetch(`${base}/agent-sessions`, { headers }).then(response => response.json())
  expect(list.data[0]).toMatchObject({ id: 'mock-chat', status: 'waiting' })

  const decided = { ...reply, parts: reply.parts.map((part: { type: string }) => part.type === 'approval' ? { ...part, status: 'approved' } : part) }
  const after = await chunks(await chat({ id: 'mock-chat', trigger: 'approval-response', messageId: reply.id, messages: [user, decided] }))
  expect(after.filter(chunk => chunk.type === 'data-approval').at(-1)).toMatchObject({ data: { status: 'approved', reason: 'Sent 3 reminders' } })
  const done = await fetch(`${base}/agent-sessions/mock-chat`, { headers }).then(response => response.json())
  expect(done.data.messages).toHaveLength(2)
  expect((await fetch(`${base}/agent-sessions`, { headers }).then(response => response.json())).data[0].status).toBeUndefined()
})
