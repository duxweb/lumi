import type { QueryClient } from '@tanstack/query-core'
import type { LumiContext } from './context.js'
import type { AuditLogEvent } from './providers/audit.js'
import type { AuthAccountAction, AuthActionResponse } from './providers/auth.js'
import type { LumiSession } from './session.js'
import type { ID } from './types.js'
import { isUnsignedFailure } from './http.js'
import { invalidateResourceQueries } from './invalidation.js'
import { handleAuthProviderError } from './providers/auth.js'
import { resetIdentityQueries } from './query-reset.js'
import { auditLogQueryKey } from './query.js'

const sessionQueues = new WeakMap<LumiSession, Promise<unknown>>()
/** Counts account and tenant changes, including changes made through derived contexts. */
export function sessionVersion(context: LumiContext): number {
  return context.session.getSnapshot()
}

/** The auth operations that may change who is signed in; a new account can be signed in on creation. */
export type SessionOperation = 'login' | 'logout' | 'register'

/** Runs a sign-in, sign-out or sign-up, one at a time per context, and drops the previous session's cached data once it succeeds. */
export function executeAuthAction(
  context: LumiContext,
  client: QueryClient,
  operation: SessionOperation,
  params?: unknown,
): Promise<AuthActionResponse> {
  return changeSession(context, client, operation, params)
}

/** Runs an account flow that leaves the session as it is, such as requesting or setting a password. */
export async function executeAccountAction(
  context: LumiContext,
  operation: AuthAccountAction,
  params?: unknown,
): Promise<AuthActionResponse> {
  const action = context.authProvider?.[operation]
  if (!action)
    throw new Error(`[lumi] authProvider.${operation} is not configured`)
  return action.call(context.authProvider, params)
}

function changeSession(
  context: LumiContext,
  client: QueryClient | undefined,
  operation: SessionOperation,
  params?: unknown,
  expectedVersion?: number,
): Promise<AuthActionResponse> {
  const previous = sessionQueues.get(context.session) ?? Promise.resolve()
  const request = previous
    .catch(() => {})
    .then(async () => {
      if (expectedVersion !== undefined && expectedVersion !== sessionVersion(context))
        return { success: false }
      const action = context.authProvider?.[operation]
      if (!action)
        throw new Error(context.authProvider ? `[lumi] authProvider.${operation} is not configured` : '[lumi] authProvider is not configured')
      const result = await action.call(context.authProvider, params)
      if (result.success !== false) {
        context.session.advance()
        // An open event stream was signed for the previous reader.
        context.liveProvider?.reconnect?.()
      }
      if (client)
        await resetSessionQueries(client, result, expectedVersion === undefined)
      return result
    })
  sessionQueues.set(context.session, request)
  const clear = (): void => {
    if (sessionQueues.get(context.session) === request)
      sessionQueues.delete(context.session)
  }
  void request.then(clear, clear)
  return request
}

/** Runs a data request and hands a failure to the auth provider's `onError`, which may sign the reader out; a failure of an unsigned backend (`auth: false`) goes to the caller alone. */
export async function executeRequest<T>(
  context: LumiContext,
  request: () => Promise<T>,
  client?: QueryClient,
): Promise<T> {
  let version = sessionVersion(context)
  try {
    return await request()
  }
  catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    // A backend the app does not sign for (`auth: false`) reports its own
    // failures; its 401 is not the reader's session ending.
    if (isUnsignedFailure(cause))
      throw error
    // Refetches inside an ongoing session reset must not recursively enqueue logout.
    if (version === sessionVersion(context) && !sessionQueues.has(context.session)) {
      await handleAuthProviderError(
        context.authProvider && {
          onError: async (error) => {
            const response = await context.authProvider!.onError?.(error)
            return version === sessionVersion(context) ? response ?? {} : {}
          },
          logout: async () => {
            const result = await changeSession(context, client, 'logout', undefined, version)
            if (result.success)
              version = sessionVersion(context)
            return result
          },
        },
        context.routerProvider && {
          go: (params) => {
            if (version === sessionVersion(context))
              context.routerProvider!.go(params)
          },
        },
        error,
      )
    }
    throw error
  }
}
export type MutationResult<T> = T & { refreshError?: string }

/** The ids a create answered with, so the log names the new record. */
function createdIds(result: object): ID[] | undefined {
  const data = (result as { data?: unknown }).data
  const ids = (Array.isArray(data) ? data : [data])
    .map(item => (typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : undefined))
    .filter((id): id is ID => typeof id === 'string' || typeof id === 'number')
  return ids.length ? ids : undefined
}

/**
 * Hands an accepted write to the audit log provider. The write already
 * happened, so a log that fails is reported on the console, not to the reader.
 */
export function recordAudit(context: LumiContext, event: AuditLogEvent, client?: QueryClient, dataProviderName?: string): void {
  const create = context.auditLogProvider?.create
  if (!create)
    return
  const clean = Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined)) as unknown as AuditLogEvent
  const version = sessionVersion(context)
  void Promise.resolve()
    .then(() => version === sessionVersion(context) ? create(clean) : undefined)
    // The resource refetched when the write landed, maybe before the entry
    // existed; its log reads again now.
    .then(() => version === sessionVersion(context) ? client?.invalidateQueries({ queryKey: auditLogQueryKey(event.resource, dataProviderName) }) : undefined)
    .catch(error => console.warn('[lumi] The audit log refused an event.', error))
}
/** Runs a write, records it in the audit log, then refetches the resource's queries; a failed refetch is reported as `refreshError` on the result, never as a failed write. */
export async function executeMutation<T extends object>(
  context: LumiContext,
  client: QueryClient,
  request: () => Promise<T>,
  target: {
    resource?: string
    dataProviderName?: string
    deletedIds?: readonly ID[]
    /** Recorded through the audit log provider once the server accepts the write. */
    audit?: Omit<AuditLogEvent, 'resource'>
  },
): Promise<MutationResult<T>> {
  const version = sessionVersion(context)
  const result = await executeRequest(context, request, client)
  if (version !== sessionVersion(context))
    return result
  if (target.resource && target.audit)
    recordAudit(context, { ...target.audit, resource: target.resource, ids: target.audit.ids ?? createdIds(result) }, client, target.dataProviderName)
  if (!target.resource)
    return result
  try {
    await invalidateResourceQueries(
      client,
      context,
      target.resource,
      target.dataProviderName,
      target.deletedIds,
    )
  }
  catch (error) {
    return {
      ...result,
      refreshError: error instanceof Error ? error.message : String(error),
    }
  }
  return result
}

/** Cancels and drops every Lumi query after a session change, then fetches the mounted ones again, or only empties them with `refetch: false`. */
export async function resetSessionQueries(
  client: QueryClient,
  result: AuthActionResponse,
  refetch = true,
): Promise<void> {
  if (result.success === false)
    return
  await resetIdentityQueries(client, refetch)
}
