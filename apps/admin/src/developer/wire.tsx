import type { DataProvider } from '@duxweb/lumi'
import type { ReactElement } from 'react'
import { createSimpleDataProvider, useLumi, useTranslate } from '@duxweb/lumi'
import { LumiCodeBlock as CodeBlock, LumiStack as Stack, LumiText as Text } from '@duxweb/lumi-ui'
import { useMemo, useState } from 'react'
import { apiUrl } from '../session.js'
import { json } from './source.js'

// The backend pages call the mock through the same createSimpleDataProvider and
// signed client the app uses; a recording fetcher keeps the last exchange to
// show it on the wire.

export interface Exchange {
  method: string
  /** Path and query, decoded for reading. */
  url: string
  status: number
  request?: unknown
  response: unknown
}

const REASONS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

export function statusLine(status: number): string {
  return `${status} ${REASONS[status] ?? ''}`.trim()
}

export interface Recorder {
  provider: DataProvider
  exchange?: Exchange
  /** Runs a call and keeps its failure, so a rejected request still shows its response. */
  run: (call: (provider: DataProvider) => Promise<unknown>) => void
}

/** createSimpleDataProvider whose fetcher records the last exchange. `token` replaces the session's credentials. */
export function useRecorder(options: { token?: string } = {}): Recorder {
  const lumi = useLumi()
  const [exchange, setExchange] = useState<Exchange>()
  const { token } = options
  const provider = useMemo(() => createSimpleDataProvider({
    apiUrl: apiUrl(),
    http: lumi.http.extend({
      // A given token stands in for the reader's: the app's credentials stay off.
      ...(token ? { auth: false, headers: { Authorization: token } } : {}),
      fetcher: record,
    }),
  }), [lumi, token])
  function record(...[input, init]: Parameters<typeof fetch>): Promise<Response> {
    return (async () => {
      const response = await fetch(input, init)
      const body: unknown = await response.clone().json().catch(() => null)
      const url = new URL(String(input))
      setExchange({
        method: init?.method ?? 'GET',
        url: decodeURIComponent(`${url.pathname}${url.search}`),
        status: response.status,
        request: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
        response: body,
      })
      return response
    })()
  }
  const run = (call: (provider: DataProvider) => Promise<unknown>): void => {
    call(provider).catch(() => undefined)
  }
  return { provider, exchange, run }
}

/** One exchange: the request as sent, then the response under its status line. */
export function ExchangeView({ exchange, empty }: { exchange?: Exchange, empty?: string }): ReactElement {
  const t = useTranslate()
  if (!exchange)
    return <Text variant="muted" text={empty ?? t('Send the request to see the exchange')} />
  const request = `${exchange.method} ${exchange.url}${exchange.request === undefined ? '' : `\n\n${json(exchange.request)}`}`
  return (
    <Stack gap="sm">
      <CodeBlock title={t('Request')} code={request} wrap copyable={false} data-testid="exchange-request" />
      <CodeBlock title={statusLine(exchange.status)} language="json" code={json(exchange.response)} data-testid="exchange-response" />
    </Stack>
  )
}
