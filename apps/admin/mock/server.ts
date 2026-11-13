import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import http from 'node:http'
import process from 'node:process'
import { configureAgent, handleMockRequest } from './handler.ts'

/**
 * Serves the platform-neutral demo backend (`handler.ts`) over Node HTTP:
 * each IncomingMessage becomes a Fetch Request, and the Response, streamed
 * ones included, is piped back.
 */

const PORT = Number(process.env.PORT) || 3002
if (process.env.MOCK_AGENT_STEP_MS !== undefined)
  configureAgent({ stepMs: Number(process.env.MOCK_AGENT_STEP_MS) })

async function toRequest(req: IncomingMessage, signal: AbortSignal): Promise<Request> {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value)
        headers.append(name, item)
    }
    else if (value !== undefined) {
      headers.set(name, value)
    }
  }
  const method = req.method ?? 'GET'
  let body: Buffer | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req)
      chunks.push(chunk as Buffer)
    body = Buffer.concat(chunks)
  }
  return new Request(new URL(req.url ?? '/', `http://localhost:${PORT}`), { method, headers, body, signal })
}

async function writeResponse(response: Response, res: ServerResponse): Promise<void> {
  // Each Set-Cookie stays its own header; a plain object would join them into one.
  const headers: Record<string, string | string[]> = Object.fromEntries(response.headers)
  const cookies = response.headers.getSetCookie()
  if (cookies.length)
    headers['set-cookie'] = cookies
  res.writeHead(response.status, headers)
  if (!response.body) {
    res.end()
    return
  }
  const reader = response.body.getReader()
  res.on('close', () => void reader.cancel().catch(() => {}))
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done)
        break
      res.write(value)
    }
    res.end()
  }
  catch {
    res.end()
  }
}

const server = http.createServer((req, res) => {
  const abort = new AbortController()
  // `close` on the response fires once the client goes away or the reply ends.
  res.on('close', () => abort.abort())
  void toRequest(req, abort.signal)
    .then(request => handleMockRequest(request))
    .then(response => writeResponse(response, res))
    .catch((error: unknown) => {
      process.stderr.write(`[lumi admin mock] ${error instanceof Error ? error.stack : String(error)}\n`)
      if (!res.headersSent)
        res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'mock failure' }))
    })
})

server.listen(PORT, () => {
  process.stdout.write(`[lumi admin mock] http://localhost:${PORT}\n`)
})
