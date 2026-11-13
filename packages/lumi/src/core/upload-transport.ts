import type { QueryClient } from '@tanstack/query-core'
import type { LumiContext } from './context.js'
import type { HttpClient, HttpOutgoingRequest, HttpPreparedRequest } from './http.js'
import type { UploadOptions, UploadResult, UploadTicket } from './upload.js'
import { dataProviderHttp, dataProviderPath } from './context.js'
import { isAbsoluteUrl, isPlainRecord, joinUrl } from './path.js'
import { executeRequest } from './services.js'
import { resolveUploadHeaders, UploadError } from './upload.js'

function filesArray(files: File | File[] | FileList): File[] {
  if (files instanceof File)
    return [files]
  return Array.from(files)
}

function resolveUrl(
  context: LumiContext | undefined,
  options: UploadOptions,
): string {
  const url = options.url ?? '/upload'
  if (isAbsoluteUrl(url))
    return url

  const apiUrl = context
    ?.getDataProvider(options.dataProviderName)
    ?.getApiUrl?.()
  return apiUrl ? joinUrl(apiUrl, url) : url
}

const LINE_BREAKS_RE = /[\r\n]+/

/** `Name: value` lines from `getAllResponseHeaders`, as a Headers init. */
function parseResponseHeaders(raw: string): Array<[string, string]> {
  return raw.trim().split(LINE_BREAKS_RE).filter(Boolean).flatMap((line) => {
    const at = line.indexOf(':')
    return at > 0 ? [[line.slice(0, at).trim(), line.slice(at + 1).trim()] as [string, string]] : []
  })
}

function urlOrigin(url: string): string | undefined {
  const base
    = typeof location !== 'undefined' ? location.href : 'http://lumi.invalid'
  try {
    return new URL(url, base).origin
  }
  catch {
    return undefined
  }
}

function isTrustedTarget(
  context: LumiContext | undefined,
  options: UploadOptions,
  target: string,
): boolean {
  const targetOrigin = urlOrigin(target)
  if (!targetOrigin)
    return false

  const trusted = new Set(
    (options.trustedOrigins ?? [])
      .map(urlOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  )
  const apiUrl = context
    ?.getDataProvider(options.dataProviderName)
    ?.getApiUrl?.()
  const apiOrigin = apiUrl ? urlOrigin(apiUrl) : undefined
  const pageOrigin
    = typeof location !== 'undefined' ? location.origin : undefined
  return (
    targetOrigin === apiOrigin
    || targetOrigin === pageOrigin
    || trusted.has(targetOrigin)
  )
}

function appendFormData(
  form: FormData,
  data: Record<string, unknown> | undefined,
): void {
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === undefined || value === null)
      continue
    if (value instanceof Blob)
      form.append(key, value)
    else if (Array.isArray(value))
      value.forEach(item => form.append(`${key}[]`, String(item)))
    else form.append(key, String(value))
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isPlainRecord(value) ? value : undefined
}

function responseToResult(body: unknown, file: File): UploadResult {
  const bodyRecord = asRecord(body)
  const payload = asRecord(bodyRecord?.data) ?? bodyRecord
  const files = Array.isArray(payload?.files) ? payload.files : undefined
  const urls = Array.isArray(payload?.urls) ? payload.urls : undefined
  const first
    = asRecord(files?.[0])
      ?? (typeof urls?.[0] === 'string' ? { url: urls[0] } : payload)
  const url = first?.url ?? first?.src
  if (typeof url !== 'string' || !url)
    throw new Error('[lumi] Upload response must include a url')
  return {
    url,
    name: typeof first?.name === 'string' ? first.name : file.name,
    size: typeof first?.size === 'number' ? first.size : file.size,
    type: typeof first?.type === 'string' ? first.type : file.type,
    raw: body,
  }
}

function aborted(): Error {
  return Object.assign(new Error('Upload aborted'), { name: 'AbortError' })
}

interface XhrAnswer {
  status: number
  statusText: string
  text: string
  headers: Array<[string, string]>
}

/**
 * One XHR, for the upload progress fetch does not report. `ready` supplies the
 * final request once the XHR exists, so an abort during its preparation is
 * still an abort.
 */
function xhrSend(
  ready: () => Promise<{ url: string, method: string, headers: Record<string, string>, body: XMLHttpRequestBodyInit, withCredentials?: boolean }>,
  signal: AbortSignal | undefined,
  onProgress: (loaded: number, total: number) => void,
): Promise<XhrAnswer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(aborted())
      return
    }
    if (typeof XMLHttpRequest === 'undefined') {
      reject(new Error('[lumi] XMLHttpRequest is required for upload progress'))
      return
    }
    const xhr = new XMLHttpRequest()
    const abort = (): void => {
      xhr.abort()
      reject(aborted())
    }
    signal?.addEventListener('abort', abort, { once: true })
    xhr.onloadend = () => signal?.removeEventListener('abort', abort)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(event.loaded, event.total)
    }
    xhr.onerror = () => reject(new Error('[lumi] Upload request failed'))
    xhr.onabort = () => reject(aborted())
    xhr.onload = () => resolve({ status: xhr.status, statusText: xhr.statusText, text: xhr.responseText, headers: parseResponseHeaders(xhr.getAllResponseHeaders()) })
    void ready()
      .then((request) => {
        if (signal?.aborted) {
          reject(aborted())
          return
        }
        xhr.open(request.method, request.url, true)
        xhr.withCredentials = request.withCredentials ?? false
        for (const [key, value] of Object.entries(request.headers))
          xhr.setRequestHeader(key, value)
        xhr.send(request.body)
      })
      .catch((error) => {
        signal?.removeEventListener('abort', abort)
        reject(error)
      })
  })
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : {}
  }
  catch {
    return {}
  }
}

/**
 * Sends one file as a form to the backend, with upload progress, and answers
 * the parsed response body. The data provider's client prepares the request
 * as it prepares any other (credentials, tenant, `onRequest`) and sees the
 * answer (`onResponse`). Uploads and backend imports share it.
 */
export async function sendFile(
  context: LumiContext | undefined,
  file: File,
  options: UploadOptions,
  onProgress: (loaded: number, total: number) => void = () => {},
): Promise<unknown> {
  const target = resolveUrl(context, options)
  if (!isTrustedTarget(context, options, target))
    throw new Error(`[lumi] Upload target origin "${urlOrigin(target) ?? target}" is not trusted`)
  const method = options.method ?? 'POST'
  const http: HttpClient | undefined = context
    ? dataProviderHttp(context, options.dataProviderName).extend({ trustedOrigins: options.trustedOrigins ?? [] })
    : undefined
  const form = new FormData()
  appendFormData(form, options.data)
  form.append(options.fieldName ?? 'file', file, file.name)
  let sent: HttpOutgoingRequest = { url: target, method, headers: {}, body: form }
  const answer = await xhrSend(async () => {
    // The auth's credentials win over the configured extras, then the
    // client's `onRequest` sees the final headers and the form.
    sent = { ...sent, headers: { ...await resolveUploadHeaders(options.headers) } }
    const { credentials, ...ready } = (http ? await http.prepare(sent) : sent) as HttpPreparedRequest
    sent = ready
    return {
      url: ready.url,
      method: ready.method,
      headers: ready.headers,
      body: (ready.body ?? form) as XMLHttpRequestBodyInit,
      withCredentials: options.withCredentials ?? credentials === 'include',
    }
  }, options.signal, onProgress)

  let { status, statusText, text } = answer
  // The client's `onResponse` sees the answer as it sees a fetched one.
  if (http && status >= 200 && status <= 599) {
    try {
      // A status without a body (204…) cannot carry one in a Response.
      const response = await http.receive(new Response([204, 205, 304].includes(status) ? null : text || null, { status, statusText, headers: answer.headers }), sent)
      status = response.status
      statusText = response.statusText
      text = await response.text()
    }
    catch (error) {
      throw http.own(error)
    }
  }
  const body = parseJson(text)
  if (status < 200 || status >= 300) {
    const bodyRecord = asRecord(body)
    const error = new UploadError({
      status,
      message: typeof bodyRecord?.message === 'string' ? bodyRecord.message : statusText || '[lumi] Upload request failed',
      data: bodyRecord?.data,
      raw: body,
    })
    throw http ? http.own(error) : error
  }
  return body
}

function isTicket(value: unknown): value is UploadTicket {
  return isPlainRecord(value) && typeof value.url === 'string' && value.url !== ''
}

/**
 * Direct-to-storage: a ticket from the backend, the file to the address it
 * names, then the optional `complete` call. The storage request carries only
 * what the ticket says: never the reader's credentials.
 */
async function uploadSigned(
  context: LumiContext | undefined,
  file: File,
  options: UploadOptions,
  onProgress: (loaded: number, total: number) => void,
): Promise<UploadResult> {
  const sign = options.sign!
  if (!context)
    throw new Error('[lumi] A signed upload needs a Lumi context to ask the backend for its ticket.')
  const http = dataProviderHttp(context, options.dataProviderName)
  const path = (url: string): string => dataProviderPath(context, options.dataProviderName, url)
  const meta = { name: file.name, size: file.size, type: file.type }
  const signal = options.signal
  const answer = asRecord(await http.request(path(sign.url), { method: 'POST', body: { ...meta, ...sign.data }, ...(signal ? { signal } : {}) }))
  const ticket = asRecord(answer?.data) ?? answer
  if (!isTicket(ticket))
    throw new Error('[lumi] The upload ticket must include the storage url')
  const method = ticket.method ?? (ticket.fields ? 'POST' : 'PUT')
  let body: XMLHttpRequestBodyInit = file
  if (method === 'POST') {
    // Storage reads the form in order: the signed fields first, the file last.
    const form = new FormData()
    for (const [key, value] of Object.entries(ticket.fields ?? {}))
      form.append(key, String(value))
    form.append(ticket.fieldName ?? 'file', file, file.name)
    body = form
  }
  const stored = await xhrSend(async () => ({ url: ticket.url, method, headers: { ...ticket.headers }, body }), signal, onProgress)
  if (stored.status < 200 || stored.status >= 300) {
    throw new UploadError({ status: stored.status, message: `[lumi] The storage refused the upload: ${stored.status} ${stored.statusText}`.trim(), raw: stored.text })
  }
  if (sign.complete) {
    const done = await http.request(path(sign.complete), { method: 'POST', body: { ...meta, ...ticket.complete }, ...(signal ? { signal } : {}) })
    return responseToResult(done, file)
  }
  if (typeof ticket.fileUrl !== 'string' || !ticket.fileUrl)
    throw new Error('[lumi] The upload ticket must include fileUrl, or `sign.complete` must answer the file url')
  return { url: ticket.fileUrl, ...meta, raw: ticket }
}

async function uploadOne(
  context: LumiContext | undefined,
  file: File,
  options: UploadOptions,
  onProgress: (loaded: number, total: number) => void,
): Promise<UploadResult> {
  if (options.sign)
    return uploadSigned(context, file, options, onProgress)
  return responseToResult(await sendFile(context, file, options, onProgress), file)
}

/** Uploads files one after another, reporting overall progress, and answers their results in order. */
export async function uploadFiles(
  context: LumiContext | undefined,
  input: File | File[] | FileList,
  options: UploadOptions = {},
  onProgress: (progress: number) => void = () => {},
  queryClient?: QueryClient,
): Promise<UploadResult[]> {
  const files = filesArray(input)
  if (!files.length)
    return []

  const request = async (): Promise<UploadResult[]> => {
    const results: UploadResult[] = []
    for (const [index, file] of files.entries()) {
      const result = await uploadOne(
        context,
        file,
        options,
        (loaded, total) => {
          onProgress(
            Math.round(((index + loaded / total) / files.length) * 100),
          )
        },
      )
      results.push(result)
      onProgress(Math.round(((index + 1) / files.length) * 100))
    }
    return results
  }
  return context ? executeRequest(context, request, queryClient) : request()
}
