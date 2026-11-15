import type { QueryClient } from '@tanstack/query-core'
import type { LumiContext } from './context.js'
import type { Filter, Meta, Sorter } from './types.js'
import { dataProviderHttp, dataProviderPath } from './context.js'
import { invalidateResourceQueries } from './invalidation.js'
import { getPathValue, isPlainRecord, normalizeResource, setPathValue } from './path.js'
import { executeRequest, recordAudit, sessionVersion } from './services.js'
import { translateText } from './text.js'
import { sendFile } from './upload-transport.js'

/**
 * Import and export of a resource's records as CSV or JSON. Everything here
 * is plain data in and out; saving a file and choosing one belong to the host
 * (the React layer passes them to the JSON actions).
 */

export type TransferFormat = 'csv' | 'json'

/** One column of the file: the record field, its header and, on import, how to read the text. */
export interface TransferColumn {
  /** The record field. */
  field: string
  /** The column heading in the file; the field name when left out. */
  label?: string
  /** How an imported cell is read; a string when left out. */
  type?: 'string' | 'number' | 'boolean'
}

export interface TransferFile {
  name: string
  type: string
  content: string
}

/** A file the backend built, as it arrived: any format, kept as bytes. */
export interface TransferDownload {
  name: string
  type: string
  content: Blob
}

const NEEDS_QUOTES_RE = /[",\r\n]/
const FORMULA_RE = /^[=+\-@\t\r]/
// The apostrophe `cell` puts before a formula-shaped string.
const GUARDED_RE = /^'(?=[=+\-@\t\r])/
const QUOTE_RE = /"/g
const EXTENSION_RE = /\.(?:csv|json)$/i
// Excel reads a CSV as UTF-8 only when it starts with a byte order mark.
const BOM = '\uFEFF'

function cell(value: unknown): string {
  if (value === undefined || value === null)
    return ''
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  // A cell opening with = + - @ runs as a formula in spreadsheets; quote it
  // as text. Plain negative numbers are left alone.
  if (FORMULA_RE.test(text) && !(typeof value === 'number'))
    text = `'${text}`
  return NEEDS_QUOTES_RE.test(text) ? `"${text.replace(QUOTE_RE, '""')}"` : text
}

/** Columns for rows without a declared list: every field of the first rows, in order of appearance. */
function inferColumns(rows: readonly Record<string, unknown>[]): TransferColumn[] {
  const fields = new Set<string>()
  for (const row of rows.slice(0, 50)) {
    for (const key of Object.keys(row))
      fields.add(key)
  }
  return Array.from(fields, field => ({ field }))
}

/** Records as CSV text under a header row; cells that look like formulas are guarded against spreadsheet injection. */
export function toCsv(rows: readonly Record<string, unknown>[], columns?: readonly TransferColumn[]): string {
  const list = columns?.length ? columns : inferColumns(rows)
  const lines = [list.map(column => cell(column.label ?? column.field)).join(',')]
  for (const row of rows)
    lines.push(list.map(column => cell(readField(row, column.field))).join(','))
  return `${BOM}${lines.join('\r\n')}\r\n`
}

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF; a leading BOM is dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.startsWith(BOM) ? text.slice(1) : text
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index++
      }
      else if (char === '"') {
        quoted = false
      }
      else {
        field += char
      }
      continue
    }
    if (char === '"' && field === '') {
      quoted = true
    }
    else if (char === ',') {
      row.push(field)
      field = ''
    }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n')
        index++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    }
    else {
      field += char
    }
  }
  if (field !== '' || row.length)
    rows.push([...row, field])
  return rows.filter(cells => cells.some(value => value !== ''))
}

/** A cell as it was before `cell` guarded it: one leading apostrophe before a formula character is the guard. */
function unguard(text: string): string {
  return text.replace(GUARDED_RE, '')
}

function readValue(source: string, type: TransferColumn['type']): unknown {
  const text = unguard(source)
  if (type === 'number') {
    const trimmed = text.trim()
    if (trimmed === '')
      return null
    // `1,234` or `N/A` is no number. The text is kept, so the server refuses
    // the row by name instead of receiving the null that NaN turns into.
    const value = Number(trimmed)
    return Number.isFinite(value) ? value : text
  }
  if (type === 'boolean')
    return ['true', '1', 'yes', 'y'].includes(text.trim().toLowerCase())
  return text
}

/** A field of the record: its own key first, then a dotted path into nested values. */
function readField(row: Record<string, unknown>, field: string): unknown {
  if (Object.hasOwn(row, field))
    return row[field]
  try {
    return getPathValue(row, field)
  }
  catch {
    return undefined
  }
}

/** Header names that are not a safe path (empty, `__proto__`…) are ignored. */
function safePath(path: string): boolean {
  try {
    getPathValue({}, path)
    return true
  }
  catch {
    return false
  }
}

/**
 * The records in a CSV or JSON file. A CSV header names each column by field
 * or by its declared label; without declared columns every header is a field.
 * Columns the file does not have are left out of the records.
 */
export function readRecords(file: Pick<TransferFile, 'name' | 'content'>, columns?: readonly TransferColumn[]): Record<string, unknown>[] {
  const json = file.name.toLowerCase().endsWith('.json') || file.content.trimStart().startsWith('[')
  if (json) {
    const parsed: unknown = JSON.parse(file.content)
    if (!Array.isArray(parsed))
      throw new Error('[lumi] An imported JSON file must hold an array of records.')
    return parsed.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
  }
  const [header = [], ...lines] = parseCsv(file.content)
  const map = header.map((name) => {
    const title = unguard(name.trim())
    const column = columns?.find(item => item.field === title || item.label === title)
      ?? (columns?.length ? undefined : { field: title })
    return column && safePath(column.field) ? column : undefined
  })
  return lines.map((cells) => {
    let record: Record<string, unknown> = {}
    map.forEach((column, index) => {
      if (column && index < cells.length)
        record = setPathValue(record, column.field, readValue(cells[index]!, column.type))
    })
    return record
  })
}

/** Builds the export file of the records, CSV or JSON, with its name and MIME type. */
export function exportFile(rows: readonly Record<string, unknown>[], options: { filename?: string, format?: TransferFormat, columns?: readonly TransferColumn[] }): TransferFile {
  const format = options.format ?? 'csv'
  const base = (options.filename ?? 'export').replace(EXTENSION_RE, '')
  if (format === 'json') {
    const data = options.columns?.length
      ? rows.map(row => Object.fromEntries(options.columns!.map(column => [column.field, readField(row, column.field)])))
      : rows
    return { name: `${base}.json`, type: 'application/json', content: JSON.stringify(data, null, 2) }
  }
  return { name: `${base}.csv`, type: 'text/csv;charset=utf-8', content: toCsv(rows, options.columns) }
}

export interface FetchAllOptions {
  resource: string
  dataProviderName?: string
  filters?: Filter[]
  sorters?: Sorter[]
  meta?: Meta
  /** Records asked for per request. */
  pageSize?: number
  /** Stops after this many records, so an export cannot run away. */
  maxItems?: number
  signal?: AbortSignal
  onProgress?: (progress: { loaded: number, total?: number }) => void
}

export const DEFAULT_EXPORT_PAGE_SIZE = 100
export const DEFAULT_EXPORT_MAX_ITEMS = 10_000

/** Every record matching the filters, page after page through `getList`. */
export async function fetchAllRecords<T = Record<string, unknown>>(context: LumiContext, client: QueryClient | undefined, options: FetchAllOptions): Promise<T[]> {
  const provider = context.getDataProvider(options.dataProviderName)
  const pageSize = options.pageSize ?? DEFAULT_EXPORT_PAGE_SIZE
  const maxItems = options.maxItems ?? DEFAULT_EXPORT_MAX_ITEMS
  const rows: T[] = []
  for (let page = 1; rows.length < maxItems; page++) {
    options.signal?.throwIfAborted()
    const result = await executeRequest(context, () => provider.getList<T>({
      resource: options.resource,
      pagination: { page, pageSize },
      filters: options.filters,
      sorters: options.sorters,
      meta: options.meta,
      signal: options.signal,
    }), client)
    rows.push(...result.data.slice(0, maxItems - rows.length))
    // A total of 0 beside rows means the backend sent none (the simple
    // provider reads a missing `meta.total` as 0): it is unknown, not reached.
    const total = typeof result.total === 'number' && result.total > 0 ? result.total : undefined
    options.onProgress?.({ loaded: rows.length, ...(total === undefined ? {} : { total }) })
    // With a total, a short page is a backend capping the page size, not the
    // end; without one, a short page is the only sign of it.
    const done = result.data.length === 0 || (total === undefined ? result.data.length < pageSize : rows.length >= total)
    if (done)
      break
  }
  return rows
}

export interface ImportProgress {
  total: number
  processed: number
  succeeded: number
  failed: number
  /** A backend import (`url`): percent of the file sent so far; the counts arrive with the answer. */
  uploaded?: number
}

export interface ImportResult extends ImportProgress {
  /**
   * Rows the server refused, with its reason. `row` counts the file's records
   * from 1: the header is not a record and blank lines are skipped, so it is
   * the spreadsheet's line number minus the header only in a file without gaps.
   */
  errors: Array<{ row: number, message: string }>
}

export interface ImportRecordsOptions {
  resource: string
  dataProviderName?: string
  meta?: Meta
  /**
   * Records sent per `createMany` call, for backends whose bulk create takes
   * or refuses a batch as a whole. Without it each record goes through
   * `create`, so every refused row is reported on its own.
   */
  batchSize?: number
  signal?: AbortSignal
  onProgress?: (progress: ImportProgress) => void
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Creates the records one by one, or in `createMany` batches when
 * `batchSize` is set, going on past refused ones, and refreshes the resource
 * once at the end. A refused batch counts all its rows as failed.
 */
export async function importRecords(context: LumiContext, client: QueryClient | undefined, records: readonly Record<string, unknown>[], options: ImportRecordsOptions): Promise<ImportResult> {
  const provider = context.getDataProvider(options.dataProviderName)
  const bulk = Boolean(provider.createMany && options.batchSize && options.batchSize > 1)
  const size = bulk ? options.batchSize! : 1
  const result: ImportResult = { total: records.length, processed: 0, succeeded: 0, failed: 0, errors: [] }
  options.onProgress?.({ ...result })
  const session = sessionVersion(context)
  try {
    for (let start = 0; start < records.length; start += size) {
      options.signal?.throwIfAborted()
      if (sessionVersion(context) !== session)
        throw new Error('[lumi] The session changed during import. Remaining rows were not sent.')
      const batch = records.slice(start, start + size)
      try {
        await executeRequest(context, () => bulk
          ? provider.createMany!({ resource: options.resource, variables: [...batch], meta: options.meta, signal: options.signal })
          : provider.create({ resource: options.resource, variables: batch[0], meta: options.meta, signal: options.signal }), client)
        result.succeeded += batch.length
      }
      catch (error) {
        // Aborted, or signed out by a refusal: the remaining rows would only be refused too.
        if (options.signal?.aborted || sessionVersion(context) !== session)
          throw error
        result.failed += batch.length
        batch.forEach((_, offset) => result.errors.push({ row: start + offset + 1, message: message(error) }))
      }
      result.processed += batch.length
      options.onProgress?.({ total: result.total, processed: result.processed, succeeded: result.succeeded, failed: result.failed })
    }
  }
  finally {
    if (result.processed && sessionVersion(context) === session)
      recordAudit(context, { action: 'import', resource: options.resource, data: { total: result.total, succeeded: result.succeeded, failed: result.failed }, ...(options.meta ? { meta: options.meta } : {}) }, client, options.dataProviderName)
    if (client && result.succeeded && sessionVersion(context) === session)
      await invalidateResourceQueries(client, context, options.resource, options.dataProviderName).catch(() => {})
  }
  return result
}

/** The files an import offers by default: CSV and JSON. */
export const DEFAULT_IMPORT_ACCEPT = '.csv,.json,text/csv,application/json'

/** How the host saves a file and lets the reader choose one; the React layer supplies the browser's. */
export interface TransferHost {
  save: (file: TransferFile | TransferDownload) => void
  pick: (accept?: string) => Promise<Pick<TransferFile, 'name' | 'content'> | undefined>
  /** The chosen file itself, unread, for an import the backend performs. */
  pickFile?: (accept?: string) => Promise<File | undefined>
}

export interface RunExportOptions extends FetchAllOptions {
  /** The columns of the file, in order; every field of the records when left out. */
  columns?: readonly TransferColumn[]
  /** `csv` or `json` for a file written here; with `url`, any name the backend knows (`xlsx`…). */
  format?: TransferFormat | (string & {})
  /** Name of the saved file without its extension; the resource name by default. */
  filename?: string
  /**
   * The backend builds the file: this endpoint (relative to the API root) is
   * sent `{ filters, sorters, columns, format, ...meta }` and answers the file
   * as a stream, in any format. Without it the records are loaded page by page
   * and the file is written in the browser.
   */
  url?: string
  /** `POST` (default) sends the values as JSON; `GET` as the query, `filters`, `sorters` and `columns` as JSON text. */
  method?: 'GET' | 'POST'
}

const FILENAME_STAR_RE = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/
const FILENAME_RE = /filename\s*=\s*("?)([^";]+)\1/

/** The name a `Content-Disposition` header gives the file, if any. */
function dispositionName(header: string | null): string | undefined {
  if (!header)
    return undefined
  const encoded = FILENAME_STAR_RE.exec(header)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim())
    }
    catch {}
  }
  return FILENAME_RE.exec(header)?.[2]?.trim() || undefined
}

/**
 * Asks the backend for the export file and follows its stream. `total` is the
 * `Content-Length` when the server sends one; `loaded` counts bytes.
 */
export async function downloadExport(context: LumiContext, client: QueryClient | undefined, input: RunExportOptions & { url: string }, save: TransferHost['save']): Promise<TransferDownload> {
  const resource = normalizeResource(input.resource)
  const http = dataProviderHttp(context, input.dataProviderName)
  const values = {
    ...input.meta,
    ...(input.filters?.length ? { filters: input.filters } : {}),
    ...(input.sorters?.length ? { sorters: input.sorters } : {}),
    ...(input.columns?.length ? { columns: input.columns } : {}),
    ...(input.format ? { format: input.format } : {}),
  }
  const method = input.method ?? 'POST'
  const text = (value: unknown): unknown => (typeof value === 'object' && value !== null ? JSON.stringify(value) : value)
  const file = await executeRequest(context, async () => {
    const response = await http.download(dataProviderPath(context, input.dataProviderName, input.url), {
      method,
      ...(method === 'GET' ? { query: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, text(value)])) } : { body: values }),
      ...(input.signal ? { signal: input.signal } : {}),
    })
    const length = Number(response.headers.get('Content-Length'))
    const total = Number.isFinite(length) && length > 0 ? length : undefined
    const chunks: BlobPart[] = []
    let loaded = 0
    input.onProgress?.({ loaded, ...(total === undefined ? {} : { total }) })
    const reader = response.body?.getReader()
    for (let part = await reader?.read(); part && !part.done; part = await reader!.read()) {
      chunks.push(part.value)
      loaded += part.value.length
      input.onProgress?.({ loaded, ...(total === undefined ? {} : { total }) })
    }
    const type = response.headers.get('Content-Type') ?? 'application/octet-stream'
    return {
      name: dispositionName(response.headers.get('Content-Disposition')) ?? input.filename ?? resource,
      type,
      content: new Blob(chunks, { type }),
    }
  }, client)
  save(file)
  return file
}

/**
 * Hands the export file to `save` and returns it: the backend's when `url` is
 * set, else one written here from every matching record.
 */
export async function runExport(context: LumiContext, client: QueryClient | undefined, input: RunExportOptions, save: TransferHost['save']): Promise<TransferFile | TransferDownload> {
  if (input.url)
    return downloadExport(context, client, { ...input, url: input.url }, save)
  const options = { ...input, resource: normalizeResource(input.resource) }
  const format = options.format ?? 'csv'
  if (format !== 'csv' && format !== 'json')
    throw new Error(`[lumi] "${format}" files are built by the backend: give the export a \`url\`.`)
  const rows = await fetchAllRecords<Record<string, unknown>>(context, client, options)
  const file = exportFile(rows, { filename: options.filename ?? options.resource, format: format as TransferFormat, columns: options.columns })
  save(file)
  return file
}

export interface RunImportOptions extends ImportRecordsOptions {
  /** Maps the file's headings to record fields; headings are taken as field names when left out. */
  columns?: readonly TransferColumn[]
  /**
   * The backend performs the import: the chosen file is uploaded to this
   * endpoint (relative to the API root) as the form field `file`, with `meta`
   * beside it, and the answer `{ data: { total, succeeded, failed, errors } }`
   * is the result. Without it the file is read here and each record created.
   */
  url?: string
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Tells the reader how an import went: a success toast, or a notice naming the first refused rows. */
function reportImport(context: LumiContext, result: ImportResult): void {
  const counts = { total: result.total, succeeded: result.succeeded, failed: result.failed }
  if (!result.failed) {
    context.toastProvider?.open({ tone: 'success', message: translateText(context, 'lumi.transfer.imported', 'Imported {succeeded} records', counts) })
    return
  }
  const detail = result.errors.slice(0, 3).map(error => translateText(context, 'lumi.transfer.rowError', 'Row {row}: {message}', error)).join('\n')
  context.notificationProvider?.open({
    tone: result.succeeded ? 'warning' : 'danger',
    title: translateText(context, 'lumi.transfer.importPartial', 'Imported {succeeded} of {total}, {failed} refused', counts),
    description: detail,
    duration: 0,
  })
}

/**
 * Uploads the file for the backend to import, reporting how much of it has
 * been sent, then reads the outcome from the answer and refreshes the
 * resource. A backend that answers no counts is taken to have accepted the file.
 */
export async function uploadImport(context: LumiContext, client: QueryClient | undefined, file: File, input: RunImportOptions & { url: string }): Promise<ImportResult> {
  const version = sessionVersion(context)
  const resource = normalizeResource(input.resource)
  const progress = (uploaded: number): void => input.onProgress?.({ total: 0, processed: 0, succeeded: 0, failed: 0, uploaded })
  progress(0)
  const body = await executeRequest(context, () => sendFile(context, file, {
    url: input.url,
    data: input.meta,
    ...(input.dataProviderName ? { dataProviderName: input.dataProviderName } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  }, (loaded, total) => progress(Math.round((loaded / total) * 100))), client)
  const answer = isPlainRecord(body) && isPlainRecord(body.data) ? body.data : isPlainRecord(body) ? body : {}
  const errors = (Array.isArray(answer.errors) ? answer.errors : []).flatMap((item: unknown) =>
    isPlainRecord(item) && typeof item.message === 'string' ? [{ row: count(item.row) ?? 0, message: item.message }] : [])
  const failed = count(answer.failed) ?? errors.length
  const succeeded = count(answer.succeeded) ?? Math.max((count(answer.total) ?? 0) - failed, 0)
  const total = count(answer.total) ?? succeeded + failed
  const result: ImportResult = { total, processed: total, succeeded, failed, errors }
  if (version !== sessionVersion(context))
    return result
  input.onProgress?.({ total, processed: total, succeeded, failed, uploaded: 100 })
  recordAudit(context, { action: 'import', resource, data: { total, succeeded, failed }, ...(input.meta ? { meta: input.meta } : {}) }, client, input.dataProviderName)
  // Without counts the backend may still have written records.
  if (client && (succeeded || count(answer.succeeded) === undefined))
    await invalidateResourceQueries(client, context, resource, input.dataProviderName).catch(() => {})
  reportImport(context, result)
  return result
}

/**
 * Reads the file, creates its records and tells the reader how it went: a
 * success toast, or a warning notice naming the first refused rows.
 */
export async function runImport(context: LumiContext, client: QueryClient | undefined, file: Pick<TransferFile, 'name' | 'content'>, input: RunImportOptions): Promise<ImportResult> {
  const version = sessionVersion(context)
  const options = { ...input, resource: normalizeResource(input.resource) }
  const records = readRecords(file, options.columns)
  const result = await importRecords(context, client, records, options)
  if (version === sessionVersion(context))
    reportImport(context, result)
  return result
}
