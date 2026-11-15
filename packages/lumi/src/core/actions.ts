import type { ActionBinding, ActionHandler, StateStore } from '@json-render/core'
import type { QueryClient } from '@tanstack/query-core'
import type { WriteParams } from '../catalog/index.js'
import type { LumiContext } from './context.js'
import type { TransferHost } from './transfer.js'
import type { FormValidationIssue } from './validation.js'
import {
  agentEventParamsSchema,
  agentSendParamsSchema,
  agentSessionParamsSchema,
  authParamsSchema,
  closeNoticeParamsSchema,
  dataTargetSchema,
  exportListParamsSchema,
  importListParamsSchema,
  mutationParamsSchema,
  notifyParamsSchema,
  requestParamsSchema,
  submitFormParamsSchema,
  toastParamsSchema,
  writeParamsSchema,
} from '../catalog/index.js'
import { findAgentSession } from './agent/registry.js'
import { FormBusyError } from './feedback.js'
import { invalidateResourceQueries } from './invalidation.js'
import { normalizeResource } from './path.js'
import {
  executeAuthAction,
  executeRequest,
  sessionVersion,
} from './services.js'
import { DEFAULT_IMPORT_ACCEPT, runExport, runImport, uploadImport } from './transfer.js'
import { FormValidationError, serverFieldIssues, validateForm } from './validation.js'
import { executeWrite } from './write.js'

export type ActionState = Pick<
  StateStore,
  'get' | 'set' | 'update' | 'getSnapshot'
>
export interface FormStatus {
  pending: boolean
  valid?: boolean
  errors: FormValidationIssue[]
  fieldErrors: Record<string, string>
  refreshError?: string
}

const pendingForms = new WeakMap<ActionState['getSnapshot'], Set<string>>()
const requestRevisions = new WeakMap<
  ActionState['getSnapshot'],
  Map<string, number>
>()

/** Where a form's status (pending, errors) is kept in page state when `submitForm` names no `validationPath`. */
export function formStatusPath(valuesPath: string): string {
  return `/__lumi/forms/${valuesPath.replaceAll('~', '~0').replaceAll('/', '~1')}`
}

function formStatus(
  errors: FormValidationIssue[],
  pending = false,
): FormStatus {
  return {
    pending,
    valid: errors.length === 0,
    errors,
    fieldErrors: Object.fromEntries(
      errors.map(issue => [issue.path, issue.message]),
    ),
  }
}

/** The handlers of Lumi's JSON actions (data, sign-in, feedback, import and export, agent), bound to a context, a query client and a page's state. */
export function createLumiHandlers(
  context: LumiContext,
  queryClient: QueryClient,
  store: ActionState,
  lifecycle: {
    isActive?: () => boolean
    /** Runs a notice button's binding; without it the buttons only close the notice. */
    execute?: (binding: ActionBinding) => Promise<void>
    /** Saves and picks files for exportList and importList. */
    files?: TransferHost
  } = {},
): Record<string, ActionHandler> {
  const active = (): boolean => lifecycle.isActive?.() !== false
  const authenticated = <T>(request: () => Promise<T>): Promise<T> =>
    executeRequest(context, request, queryClient)
  const refresh = (resource: string, provider?: string): Promise<void> =>
    invalidateResourceQueries(queryClient, context, resource, provider)
  // Export and import progress at `path`: `{ loading: true, ...progress }`
  // while running, the last progress with `loading: false` once settled.
  const progressReporter = (path: string | undefined): { report: (progress: object) => void, done: () => void } => {
    const version = sessionVersion(context)
    const write = (value: Record<string, unknown>): void => {
      if (path && active() && version === sessionVersion(context))
        store.set(path, value)
    }
    return {
      report: progress => write({ loading: true, ...progress }),
      done: () => write({ ...(path ? store.get(path) as Record<string, unknown> | undefined : undefined), loading: false }),
    }
  }
  const mutation
    = (operation: 'create' | 'update' | 'delete'): ActionHandler =>
      async (input) => {
        const identity = store.getSnapshot
        const version = sessionVersion(context)
        const parsed = (operation === 'create' ? mutationParamsSchema : writeParamsSchema).parse(input) as WriteParams
        const params = { ...parsed, resource: normalizeResource(parsed.resource) }
        const result = await executeWrite(context, queryClient, {
          operation,
          resource: params.resource,
          dataProviderName: params.dataProviderName,
          ...(params.id === undefined ? {} : { ids: [params.id] }),
          values: operation === 'delete' ? params.values : params.values ?? {},
          meta: params.meta,
          mutationMode: params.mutationMode,
          undoableTimeout: params.undoableTimeout,
        })
        if (
          active()
          && store.getSnapshot === identity
          && version === sessionVersion(context)
          && params.resultPath
        ) {
          store.set(params.resultPath, result)
        }
        return result
      }
  const handlers: Record<string, ActionHandler> = {
    login: input =>
      executeAuthAction(
        context,
        queryClient,
        'login',
        authParamsSchema.parse(input).params,
      ),
    logout: input =>
      executeAuthAction(
        context,
        queryClient,
        'logout',
        authParamsSchema.parse(input).params,
      ),
    request: async (input) => {
      const identity = store.getSnapshot
      const version = sessionVersion(context)
      const params = requestParamsSchema.parse(input)
      const provider = context.getDataProvider(params.dataProviderName)
      if (!provider.custom)
        throw new Error('[lumi] DataProvider.custom is not configured.')
      let revisions = requestRevisions.get(store.getSnapshot)
      if (!revisions) {
        revisions = new Map()
        requestRevisions.set(store.getSnapshot, revisions)
      }
      const path = params.resultPath
      const revision = path ? (revisions.get(path) ?? 0) + 1 : 0
      if (path)
        revisions.set(path, revision)
      const result = await authenticated(() =>
        provider.custom!({
          url: params.url,
          method: params.method,
          query: params.query,
          payload: params.payload,
          meta: params.meta,
        }),
      )
      if (
        active()
        && store.getSnapshot === identity
        && version === sessionVersion(context)
        && path
        && revisions.get(path) === revision
      ) {
        store.set(path, result)
      }
      return result
    },
    create: mutation('create'),
    update: mutation('update'),
    delete: mutation('delete'),
    toast: async (input) => {
      context.toastProvider?.open(toastParamsSchema.parse(input))
    },
    notify: async (input) => {
      const { actions, ...params } = notifyParamsSchema.parse(input)
      context.notificationProvider?.open({
        ...params,
        actions: actions?.map(({ label, ...binding }) => ({
          label,
          // A failure is reported by the action observer like any other.
          onPress: () => void lifecycle.execute?.(binding as ActionBinding).catch(() => {}),
        })),
      })
    },
    closeNotice: async (input) => {
      context.notificationProvider?.close?.(closeNoticeParamsSchema.parse(input).key)
    },
    invalidate: async (input) => {
      const params = dataTargetSchema.strict().parse(input)
      context.getDataProvider(params.dataProviderName)
      await refresh(params.resource, params.dataProviderName)
    },
    exportList: async (input) => {
      const { progressPath, ...params } = exportListParamsSchema.parse(input)
      if (!lifecycle.files)
        throw new Error('[lumi] exportList needs a host that can save files.')
      const progress = progressReporter(progressPath)
      progress.report({ loaded: 0 })
      try {
        await runExport(context, queryClient, { ...params, onProgress: progress.report }, lifecycle.files.save)
      }
      finally {
        progress.done()
      }
    },
    importList: async (input) => {
      const version = sessionVersion(context)
      const { progressPath, resultPath, accept, ...params } = importListParamsSchema.parse(input)
      if (!lifecycle.files)
        throw new Error('[lumi] importList needs a host that can pick files.')
      // The backend reads the file itself, so it is uploaded unread and may be any format.
      if (params.url && !lifecycle.files.pickFile)
        throw new Error('[lumi] importList with `url` needs a host that can pick a file to upload.')
      const file = params.url ? await lifecycle.files.pickFile!(accept) : await lifecycle.files.pick(accept ?? DEFAULT_IMPORT_ACCEPT)
      // Closing the picker is not a failure.
      if (!file)
        return undefined
      if (!active() || version !== sessionVersion(context))
        throw new Error('[lumi] The session changed while choosing a file.')
      const progress = progressReporter(progressPath)
      try {
        const result = file instanceof Blob
          ? await uploadImport(context, queryClient, file, { ...params, url: params.url!, onProgress: progress.report })
          : await runImport(context, queryClient, file, { ...params, onProgress: progress.report })
        if (resultPath && active() && version === sessionVersion(context))
          store.set(resultPath, result)
        return result
      }
      finally {
        progress.done()
      }
    },
    submitForm: async (input) => {
      const identity = store.getSnapshot
      const version = sessionVersion(context)
      const params = submitFormParamsSchema.parse(input)
      const value = store.get(params.valuesPath)
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('[lumi] Form values must be an object at valuesPath.')
      let pending = pendingForms.get(store.getSnapshot)
      if (!pending) {
        pending = new Set()
        pendingForms.set(store.getSnapshot, pending)
      }
      if (pending.has(params.valuesPath))
        throw new FormBusyError()
      pending.add(params.valuesPath)
      const path = params.validationPath ?? formStatusPath(params.valuesPath)
      const payload = JSON.parse(JSON.stringify(value)) as Record<
        string,
        unknown
      >
      const current = (): boolean =>
        active()
        && store.getSnapshot === identity
        && version === sessionVersion(context)
        && store.get(params.valuesPath) === value
      const submittingStatus = formStatus([], true)
      store.set(path, submittingStatus)
      try {
        const errors = await validateForm(
          context.validator,
          params.rules,
          payload,
          context.i18nProvider,
        )
        if (!current()) {
          throw new Error(
            '[lumi] Form changed during validation. Submit the current values again.',
          )
        }
        if (errors.length)
          throw new FormValidationError(errors)
        const result = (await handlers[
          params.id === undefined ? 'create' : 'update'
        ]!({
          resource: params.resource,
          dataProviderName: params.dataProviderName,
          id: params.id,
          meta: params.meta,
          values: payload,
          // A form closes only once the server accepted it, whatever the app's default mode.
          ...(params.id === undefined ? {} : { mutationMode: 'pessimistic' }),
        })) as { data: unknown, refreshError?: string }
        if (current()) {
          store.update({
            [path]: { ...formStatus([]), refreshError: result.refreshError },
            ...(params.resultPath ? { [params.resultPath]: result } : {}),
            ...(params.successState ?? {}),
          })
        }
        return result
      }
      catch (error) {
        if (current()) {
          const errors
            = error instanceof FormValidationError
              ? error.issues
              : serverFieldIssues(error) ?? [
                {
                  path: '',
                  code: 'submit_failed',
                  message:
                      error instanceof Error ? error.message : String(error),
                },
              ]
          store.set(path, formStatus(errors))
        }
        throw error
      }
      finally {
        pending.delete(params.valuesPath)
        const status = active()
          ? (store.get(path) as FormStatus | undefined)
          : undefined
        if (status === submittingStatus)
          store.set(path, { ...status, pending: false })
      }
    },
    agentSend: async (input) => {
      const { session, clear, ...message } = agentSendParamsSchema.parse(input)
      const target = findAgentSession(store.getSnapshot, session)
      const before = target.getSnapshot()
      // A send that is accepted commits `submitted` before its first await, so
      // the box empties at once rather than when the reply ends.
      const sending = target.send(message)
      const accepted = target.getSnapshot() !== before && target.getSnapshot().status === 'submitted'
      if (accepted && clear?.length) {
        store.update(Object.fromEntries(clear.map((path) => {
          const current = store.get(path)
          return [path, Array.isArray(current) ? [] : typeof current === 'string' ? '' : null]
        })))
      }
      return sending
    },
    agentStop: async (input) => {
      findAgentSession(store.getSnapshot, agentSessionParamsSchema.parse(input).session).stop()
    },
    agentRetry: async input => findAgentSession(store.getSnapshot, agentSessionParamsSchema.parse(input).session).retry(),
    agentEvent: async (input) => {
      const { session: path, event } = agentEventParamsSchema.parse(input)
      const session = findAgentSession(store.getSnapshot, path)
      const value = event.value
      switch (event.type) {
        case 'approve':
        case 'reject':
          return event.partId ? session.approve(event.partId, event.type === 'approve', typeof value === 'string' ? value : undefined) : false
        case 'answer':
          return event.partId && (typeof value === 'string' || Array.isArray(value)) ? session.answer(event.partId, value as string | string[]) : false
        case 'skip':
          return event.partId ? session.skip(event.partId) : false
        case 'regenerate':
          return session.retry()
        case 'edit':
          return event.messageId && typeof value === 'string' ? session.edit(event.messageId, value) : false
        case 'suggestion': {
          const text = typeof value === 'string' ? value : typeof value === 'object' && value !== null ? (value as { value?: unknown, label?: unknown }).value ?? (value as { label?: unknown }).label : undefined
          return typeof text === 'string' ? session.send({ text }) : false
        }
        default:
          return false
      }
    },
  }
  return handlers
}
