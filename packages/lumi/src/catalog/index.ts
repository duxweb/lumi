import { z } from 'zod'
import { FILTER_OPERATORS } from '../core/types.js'
import { agentActionDefinitions, agentComponentDefinitions } from './agent.js'

const record = z.record(z.string(), z.unknown())
export const dataTargetSchema = z.object({
  resource: z.string().min(1),
  dataProviderName: z.string().optional(),
  meta: record.optional(),
})
export const queryPropsSchema = dataTargetSchema.extend({
  operation: z.enum(['list', 'one', 'many', 'custom']).default('list'),
  id: z.union([z.string(), z.number()]).optional(),
  ids: z.array(z.union([z.string(), z.number()])).optional(),
  pagination: z.union([z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive() }), z.literal(false)]).optional(),
  filters: z.array(z.object({ field: z.string(), operator: z.enum(FILTER_OPERATORS), value: z.unknown() })).optional(),
  sorters: z.array(z.object({ field: z.string(), order: z.enum(['asc', 'desc']) })).optional(),
  url: z.string().optional(),
  query: record.optional(),
  enabled: z.boolean().optional(),
  /** `auto` refetches when the backend pushes a change to the resource; defaults to the app's live mode. */
  liveMode: z.enum(['auto', 'manual', 'off']).optional(),
  resultPath: z.string().startsWith('/'),
}).strict()

export const canAccessPropsSchema = z.strictObject({
  resource: z.string().min(1),
  action: z.string().min(1),
  params: record.optional(),
  /** Writes `{ can, reason, loading }` here, so other elements can bind `visible` or `disabled` to it. */
  resultPath: z.string().startsWith('/').optional(),
})
export type CanAccessProps = z.infer<typeof canAccessPropsSchema>

export const lumiComponentDefinitions = {
  CanAccess: {
    props: canAccessPropsSchema,
    slots: ['default', 'fallback'],
    events: [],
    description: 'Renders its children only when the access provider allows `action` on `resource`, else its `fallback` slot (nothing while checking). With `resultPath` it also writes `{ can, reason, loading }` to state: bind a button\'s `disabled` or any element\'s `visible` to it to disable or hide it.',
  },
  Query: {
    props: queryPropsSchema,
    slots: ['default'],
    events: [],
    description: 'Read data on mount and parameter changes, and again when a live provider pushes a change to the resource (`liveMode`). Projects { data, total, loading, error } to resultPath. Bind display props to that state path.',
  },
  ...agentComponentDefinitions,
}

export const requestParamsSchema = z.strictObject({
  url: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  query: record.optional(),
  payload: z.unknown().optional(),
  dataProviderName: z.string().optional(),
  meta: record.optional(),
  resultPath: z.string().startsWith('/').optional(),
})
export const mutationParamsSchema = dataTargetSchema.extend({
  id: z.union([z.string(), z.number()]).optional(),
  values: record.optional(),
  resultPath: z.string().startsWith('/').optional(),
}).strict()
/** Update and delete also choose when the change shows; forms always wait for the server. */
export const writeParamsSchema = mutationParamsSchema.extend({
  mutationMode: z.enum(['pessimistic', 'optimistic', 'undoable']).optional(),
  undoableTimeout: z.number().int().positive().optional(),
})
export type WriteParams = z.infer<typeof writeParamsSchema>
export const submitFormParamsSchema = mutationParamsSchema.extend({
  valuesPath: z.string().startsWith('/'),
  validationPath: z.string().startsWith('/').optional(),
  rules: z.unknown().optional(),
  successState: record.optional(),
})
export const authParamsSchema = z.strictObject({ params: record.optional() })
const feedbackToneSchema = z.enum(['neutral', 'success', 'info', 'warning', 'danger'])
export const toastParamsSchema = z.strictObject({
  key: z.string().optional(),
  tone: feedbackToneSchema.optional(),
  message: z.string().min(1),
  duration: z.number().int().nonnegative().optional(),
})
/** A notice button: a label plus the native binding it runs when pressed. */
export const noticeActionSchema = z.strictObject({
  label: z.string().min(1),
  action: z.string().min(1),
  params: record.optional(),
})
export const notifyParamsSchema = z.strictObject({
  key: z.string().optional(),
  tone: feedbackToneSchema.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  actions: z.array(noticeActionSchema).max(3).optional(),
  duration: z.number().int().nonnegative().optional(),
})
export const closeNoticeParamsSchema = z.strictObject({ key: z.string().min(1) })
export const transferColumnSchema = z.strictObject({
  field: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean']).optional(),
})
export const exportListParamsSchema = dataTargetSchema.extend({
  filters: queryPropsSchema.shape.filters,
  sorters: queryPropsSchema.shape.sorters,
  /** Fields in file order with their headers; every field of the records without it. */
  columns: z.array(transferColumnSchema).optional(),
  /** The backend builds the file: this endpoint is sent the filters, sorters, columns and format, and answers the file as a stream. */
  url: z.string().min(1).optional(),
  /** How `url` is asked: `POST` (default) with a JSON body, or `GET` with the values in the query. */
  method: z.enum(['GET', 'POST']).optional(),
  /** `csv` or `json` when the file is written in the browser; with `url` any name the backend knows, e.g. `xlsx`. */
  format: z.string().min(1).optional(),
  filename: z.string().min(1).optional(),
  pageSize: z.number().int().positive().max(1000).optional(),
  maxItems: z.number().int().positive().optional(),
  /** Writes `{ loading, loaded, total }` while records load; with `url`, bytes received and the file's size when the server states it. */
  progressPath: z.string().startsWith('/').optional(),
}).strict().superRefine((params, context) => {
  if (!params.url && params.format !== undefined && params.format !== 'csv' && params.format !== 'json')
    context.addIssue({ code: 'custom', path: ['format'], message: 'Without `url` the file is written in the browser as "csv" or "json".' })
})
export type ExportListParams = z.infer<typeof exportListParamsSchema>
export const importListParamsSchema = dataTargetSchema.extend({
  /** How file headers map to fields and how cells are read; the header names the fields without it. */
  columns: z.array(transferColumnSchema).optional(),
  /** The backend performs the import: the chosen file is uploaded to this endpoint as the form field `file` and the answer `{ total, succeeded, failed, errors }` is the result. */
  url: z.string().min(1).optional(),
  /** File types the picker offers; CSV and JSON by default, any file with `url`. */
  accept: z.string().optional(),
  /** Records per createMany call, for a backend whose bulk create is all or nothing; one create per record without it. */
  batchSize: z.number().int().positive().max(1000).optional(),
  /** Writes `{ loading, total, processed, succeeded, failed }` while records are created; with `url`, `uploaded` is the percent of the file sent. */
  progressPath: z.string().startsWith('/').optional(),
  /** Writes the finished `{ total, succeeded, failed, errors: [{ row, message }] }`. */
  resultPath: z.string().startsWith('/').optional(),
}).strict()
export type ImportListParams = z.infer<typeof importListParamsSchema>
export const lumiActionDefinitions = {
  login: { params: authParamsSchema, description: 'Sign in and reset Lumi query caches before completing.' },
  logout: { params: authParamsSchema, description: 'Sign out and isolate cached data from the next session.' },
  request: { params: requestParamsSchema, description: 'Execute a configured DataProvider request and optionally write the normalized response to resultPath.' },
  create: { params: mutationParamsSchema, description: 'Create a record and invalidate its queries.' },
  update: { params: writeParamsSchema, description: 'Update a record and invalidate its queries. `mutationMode` `optimistic` shows the change at once and rolls it back on failure; `undoable` also waits `undoableTimeout` ms with an Undo notice before sending.' },
  delete: { params: writeParamsSchema, description: 'Delete a record and invalidate its queries. `mutationMode` `optimistic` removes the row at once and puts it back on failure; `undoable` also waits `undoableTimeout` ms with an Undo notice before sending.' },
  invalidate: { params: dataTargetSchema.strict(), description: 'Refresh active queries for a resource.' },
  toast: { params: toastParamsSchema, description: 'Show a light single-line message (top centre in Admin) through the ToastProvider; it closes after about 3 seconds, duration 0 keeps it until dismissed and a key updates it in place.' },
  notify: { params: notifyParamsSchema, description: 'Show a notification card (top right in Admin) through the NotificationProvider: title, optional description and up to 3 action buttons that run catalog actions and close it; duration 0 keeps it open.' },
  closeNotice: { params: closeNoticeParamsSchema, description: 'Close the open notice with this key.' },
  exportList: { params: exportListParamsSchema, description: 'Download every record matching the filters as CSV (UTF-8, opens in Excel) or JSON, loading them page after page through getList up to `maxItems` (default 10000). With `url` the backend builds the file instead: it is sent the filters, sorters, columns and format, and its answer is saved as it streams in, in any format.' },
  importList: { params: importListParamsSchema, description: 'Let the reader choose a CSV or JSON file and create its records one by one through create (or in `batchSize` batches through createMany), going on past refused rows; reports progress to `progressPath`, the outcome to `resultPath` and in a notice, then refreshes the resource. With `url` the backend performs the import instead: the file is uploaded there as it is, in any format, and the answer is the outcome.' },
  submitForm: { params: submitFormParamsSchema, description: 'Validate a state-backed form, await business rules, save once and apply successState only after successful saving.' },
  ...agentActionDefinitions,
}

export type QueryProps = z.input<typeof queryPropsSchema>

export const uploadRequestSchema = z.strictObject({
  /**
   * Direct-to-storage upload (S3, OSS, COS…): `url` answers a ticket
   * `{ url, method, headers, fields, fileUrl }` for `{ name, size, type, ...data }`,
   * the file goes to the ticket's address, and `complete`, when set, is told
   * and answers the file's `{ url }`.
   */
  sign: z.strictObject({ url: z.string().min(1), data: record.optional(), complete: z.string().min(1).optional() }).optional(),
  url: z.string().optional(),
  method: z.enum(['POST', 'PUT', 'PATCH']).optional(),
  fieldName: z.string().optional(),
  data: record.optional(),
  dataProviderName: z.string().optional(),
})

export * from './agent.js'
export * from './options.js'
