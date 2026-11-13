// @vitest-environment jsdom
import type { DataProvider, LiveEvent, LiveProvider, LiveSubscribeParams } from '@duxweb/lumi'
import { createLumi, createSseLiveProvider } from '@duxweb/lumi'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiProvider, useList, useOne, useSubscription } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** A response whose SSE body the test writes frame by frame. */
function stream(): { response: Response, push: (event: LiveEvent) => void, end: () => void } {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  const encoder = new TextEncoder()
  return {
    response: new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    push: event => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
    end: () => controller.close(),
  }
}

/** A live provider the test drives directly. */
function manual(): LiveProvider & { emit: (event: LiveEvent) => void, count: () => number } {
  const subscriptions = new Set<LiveSubscribeParams>()
  return {
    subscribe(params) {
      subscriptions.add(params)
      return () => subscriptions.delete(params)
    },
    emit(event) {
      for (const subscription of subscriptions) {
        if (subscription.channel === event.channel && (!subscription.types || subscription.types.includes(event.type)))
          subscription.onLiveEvent(event)
      }
    },
    count: () => subscriptions.size,
  }
}

describe('live', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('reads one stream with the request headers, filters by channel and type, and reconnects after a drop', async () => {
    vi.useFakeTimers()
    const opened: Array<{ headers: Record<string, string>, stream: ReturnType<typeof stream> }> = []
    let tenant = 'north'
    const live = createSseLiveProvider({
      url: 'https://api.test/live',
      headers: () => ({ 'X-Tenant': tenant }),
      retryDelay: 100,
      fetcher: (async (_url: string, init: RequestInit) => {
        const next = stream()
        opened.push({ headers: init.headers as Record<string, string>, stream: next })
        return next.response
      }) as typeof fetch,
    })
    const orders: LiveEvent[] = []
    const deletes: LiveEvent[] = []
    const off = live.subscribe({ channel: 'resources/orders', onLiveEvent: event => orders.push(event) })
    live.subscribe({ channel: 'resources/orders', types: ['deleted'], onLiveEvent: event => deletes.push(event) })
    await vi.advanceTimersByTimeAsync(0)
    expect(opened).toHaveLength(1)
    expect(opened[0]!.headers).toMatchObject({ 'X-Tenant': 'north', 'Accept': 'text/event-stream' })

    opened[0]!.stream.push({ channel: 'resources/orders', type: 'updated', payload: { ids: [7] } })
    opened[0]!.stream.push({ channel: 'resources/users', type: 'updated' })
    opened[0]!.stream.push({ channel: 'resources/orders', type: 'deleted', payload: { ids: [8] } })
    await vi.advanceTimersByTimeAsync(0)
    expect(orders.map(event => event.type)).toEqual(['updated', 'deleted'])
    expect(deletes.map(event => event.payload?.ids)).toEqual([[8]])

    // A dropped stream opens again after the delay, with fresh headers.
    tenant = 'south'
    opened[0]!.stream.end()
    await vi.advanceTimersByTimeAsync(99)
    expect(opened).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(opened).toHaveLength(2)
    expect(opened[1]!.headers['X-Tenant']).toBe('south')

    // Reconnecting on purpose replaces the stream at once.
    live.reconnect()
    await vi.advanceTimersByTimeAsync(0)
    expect(opened).toHaveLength(3)
    off()
    live.close()
    // The last subscription left: the stream closes and does not come back.
    await vi.advanceTimersByTimeAsync(1000)
    expect(opened).toHaveLength(3)
  })

  it('refetches lists and the named record on events in auto mode, and only reports them in manual mode', async () => {
    const live = manual()
    let version = 1
    const getList = vi.fn(async () => ({ data: [{ id: 1, version }], total: 1 }))
    const getOne = vi.fn(async ({ id }: { id: number }) => ({ data: { id, version } }))
    const context = createLumi({ dataProvider: { getList, getOne } as unknown as DataProvider, liveProvider: live })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const reported: string[] = []
    const heard: string[] = []

    function Probe(): null {
      useList({ resource: 'orders' })
      useOne({ resource: 'orders', id: 1 })
      useList({ resource: 'users', liveMode: 'manual', onLiveEvent: event => reported.push(event.type) })
      useSubscription({ channel: 'notices', onLiveEvent: event => heard.push(event.type) })
      return null
    }

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const until = (check: () => void): Promise<void> => act(async () => {
      await vi.waitFor(check)
    })
    await act(async () => root.render(<LumiProvider context={context} queryClient={client} registry={{}}><Probe /></LumiProvider>))
    await until(() => expect(getOne).toHaveBeenCalledTimes(1))
    expect(live.count()).toBe(4)
    const listsBefore = getList.mock.calls.length

    version = 2
    // Another record: the list refetches, the record of id 1 does not.
    await act(async () => live.emit({ channel: 'resources/orders', type: 'updated', payload: { ids: [2] } }))
    await until(() => expect(getList.mock.calls.length).toBe(listsBefore + 1))
    expect(getOne).toHaveBeenCalledTimes(1)
    await act(async () => live.emit({ channel: 'resources/orders', type: 'updated', payload: { ids: [1] } }))
    await until(() => expect(getOne).toHaveBeenCalledTimes(2))

    // Manual mode reports and leaves the cache alone.
    const usersBefore = getList.mock.calls.filter(([params]) => (params as { resource: string }).resource === 'users').length
    await act(async () => live.emit({ channel: 'resources/users', type: 'created' }))
    expect(reported).toEqual(['created'])
    expect(getList.mock.calls.filter(([params]) => (params as { resource: string }).resource === 'users')).toHaveLength(usersBefore)
    await act(async () => live.emit({ channel: 'notices', type: 'ping' }))
    expect(heard).toEqual(['ping'])

    await act(async () => root.unmount())
    expect(live.count()).toBe(0)
  })

  it('leaves a manual reader\'s query alone when an auto reader of the same resource refetches', async () => {
    const live = manual()
    const getList = vi.fn(async ({ pagination }: { pagination?: { page: number } }) => ({ data: [{ id: pagination?.page ?? 0 }], total: 1 }))
    const context = createLumi({ dataProvider: { getList, getOne: vi.fn() } as unknown as DataProvider, liveProvider: live })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Probe(): null {
      useList({ resource: 'orders', pagination: { page: 1, pageSize: 10 } })
      useList({ resource: 'orders', pagination: { page: 2, pageSize: 10 }, liveMode: 'manual' })
      return null
    }
    const pages = (page: number): number => getList.mock.calls.filter(([params]) => params.pagination?.page === page).length
    const root = createRoot(document.createElement('div'))
    await act(async () => root.render(<LumiProvider context={context} queryClient={client} registry={{}}><Probe /></LumiProvider>))
    await act(async () => {
      await vi.waitFor(() => expect(pages(2)).toBe(1))
    })
    await act(async () => live.emit({ channel: 'resources/orders', type: 'updated' }))
    await act(async () => {
      await vi.waitFor(() => expect(pages(1)).toBe(2))
    })
    expect(pages(2)).toBe(1)
    await act(async () => root.unmount())
  })

  it('stays off without a live provider or with liveMode off', async () => {
    const live = manual()
    const context = createLumi({ dataProvider: { getList: async () => ({ data: [], total: 0 }) } as unknown as DataProvider, liveProvider: live, liveMode: 'off' })
    function Probe(): null {
      useList({ resource: 'orders' })
      useList({ resource: 'users', liveMode: 'auto' })
      return null
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(<LumiProvider context={context} registry={{}}><Probe /></LumiProvider>))
    // The app default is off; a query may still ask for it.
    expect(live.count()).toBe(1)
    await act(async () => root.unmount())
  })
})

describe('sse live provider resilience', () => {
  afterEach(() => vi.useRealTimers())

  /** A stream the test writes raw SSE text into. */
  function raw(): { response: Response, write: (text: string) => void, end: () => void } {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c
      },
    })
    const encoder = new TextEncoder()
    return {
      response: new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      write: text => controller.enqueue(encoder.encode(text)),
      end: () => controller.close(),
    }
  }

  it('stays open through a keep-alive word and a listener that throws', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const opened: Array<ReturnType<typeof raw>> = []
    const live = createSseLiveProvider({
      url: 'https://api.test/live',
      retryDelay: 100,
      fetcher: (async () => {
        const next = raw()
        opened.push(next)
        return next.response
      }) as typeof fetch,
    })
    const heard: string[] = []
    live.subscribe({ channel: 'resources/orders', onLiveEvent: () => {
      throw new Error('listener bug')
    } })
    live.subscribe({ channel: 'resources/orders', onLiveEvent: event => heard.push(event.type) })
    await vi.advanceTimersByTimeAsync(0)
    const event = (type: string): string => `data: ${JSON.stringify({ channel: 'resources/orders', type })}\n\n`
    opened[0]!.write(`data: ping\n\n${event('created')}`)
    await vi.advanceTimersByTimeAsync(0)
    opened[0]!.write(`: comment\n\ndata: ping\n\n${event('updated')}`)
    await vi.advanceTimersByTimeAsync(1000)
    expect(heard).toEqual(['created', 'updated'])
    expect(opened).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('A live listener'), expect.any(Error))
    live.close()
  })

  it('backs off when the stream keeps opening and dropping without an event', async () => {
    vi.useFakeTimers()
    const times: number[] = []
    const live = createSseLiveProvider({
      url: 'https://api.test/live',
      retryDelay: 100,
      fetcher: (async () => {
        times.push(Date.now())
        const next = raw()
        next.end()
        return next.response
      }) as typeof fetch,
    })
    live.subscribe({ channel: 'resources/orders', onLiveEvent: () => {} })
    await vi.advanceTimersByTimeAsync(2000)
    live.close()
    const gaps = times.slice(1).map((time, index) => time - times[index]!)
    expect(gaps.slice(0, 4)).toEqual([100, 200, 400, 800])
  })

  it('fails a publish the server refuses', async () => {
    const live = createSseLiveProvider({
      url: 'https://api.test/live',
      publishUrl: 'https://api.test/live/publish',
      fetcher: (async () => new Response(null, { status: 403 })) as typeof fetch,
    })
    await expect(live.publish!({ channel: 'resources/orders', type: 'updated' })).rejects.toThrow('refused: 403')
  })
})
