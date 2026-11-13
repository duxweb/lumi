import type { OverlayCloseGuard } from '@duxweb/lumi'
import type { PropsWithChildren, ReactElement } from 'react'
import type { BlockerFunction } from 'react-router'
import { useOverlayCloseGuard } from '@duxweb/lumi'
import { LumiDialog as Dialog, useUiText } from '@duxweb/lumi-ui'
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'

/** Where unsaved changes live: the page, an imperative overlay, or one layer of the routed drawer stack. */
export type UnsavedChangesScope = 'page' | 'overlay' | `routed-drawer:${number}`

interface UnsavedOwner {
  id: string
  dirty: boolean
  scope: UnsavedChangesScope
  title: string
  description: string
  confirmText: string
  cancelText: string
}

interface PendingDecision {
  owner: UnsavedOwner
  resolve: (allowed: boolean) => void
  promise: Promise<boolean>
  transition?: () => void
  navigation: boolean
}

interface UnsavedChangesCoordinator {
  register: (owner: UnsavedOwner) => () => void
  request: (ownerId: string, transition: () => void) => void
  requestDecision: (ownerId: string) => Promise<boolean>
  requestScope: (scope: UnsavedChangesScope, transition: () => void, navigation?: boolean) => void
}

interface UnsavedChangesGuardOptions {
  dirty: boolean
  owner: string
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
}

interface UnsavedChangesGuard {
  request: (transition: () => void) => void
  dialog: ReactElement
}

const UnsavedChangesContext = createContext<UnsavedChangesCoordinator | null>(null)
const UnsavedChangesScopeContext = createContext<UnsavedChangesScope>('page')

/** The drawer stack up to and including `layer`, as the location names it. */
function drawerKey(search: string, layer: number): string {
  return new URLSearchParams(search).getAll('drawer').slice(0, layer + 1).join('\n')
}

const DRAWER_SCOPE_RE = /^routed-drawer:(\d+)$/

function ownerBlocksNavigation(owner: UnsavedOwner, currentPathname: string, currentSearch: string, nextPathname: string, nextSearch: string): boolean {
  if (!owner.dirty)
    return false
  if (currentPathname !== nextPathname)
    return true
  // A drawer's changes are lost when its layer, or one below it, changes or closes.
  const layer = DRAWER_SCOPE_RE.exec(owner.scope)?.[1]
  return layer !== undefined && drawerKey(currentSearch, Number(layer)) !== drawerKey(nextSearch, Number(layer))
}

/** Coordinates unsaved-changes prompts: pages and drawers register their dirty forms, and leaving one asks the reader first. */
export function LumiUnsavedChangesProvider({ children }: PropsWithChildren): ReactElement {
  const { t } = useUiText()
  const owners = useRef(new Map<string, UnsavedOwner>())
  const [pending, setPending] = useState<PendingDecision | undefined>(undefined)
  const pendingRef = useRef<PendingDecision | undefined>(undefined)
  const blockedOwner = useRef<UnsavedOwner | undefined>(undefined)
  const approvedNavigation = useRef(false)

  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) => {
    if (approvedNavigation.current) {
      approvedNavigation.current = false
      return false
    }
    const owner = [...owners.current.values()].find(candidate => ownerBlocksNavigation(
      candidate,
      currentLocation.pathname,
      currentLocation.search,
      nextLocation.pathname,
      nextLocation.search,
    ))
    blockedOwner.current = owner
    return Boolean(owner)
  }, [])
  const blocker = useBlocker(shouldBlock)

  useBeforeUnload(useCallback((event) => {
    if (![...owners.current.values()].some(owner => owner.dirty))
      return
    event.preventDefault()
    event.returnValue = ''
  }, []))

  const register = useCallback((owner: UnsavedOwner): (() => void) => {
    owners.current.set(owner.id, owner)
    return () => {
      owners.current.delete(owner.id)
    }
  }, [])

  const beginDecision = useCallback((owner: UnsavedOwner, transition?: () => void, navigation = false): PendingDecision => {
    let resolve!: (allowed: boolean) => void
    const promise = new Promise<boolean>((done) => {
      resolve = done
    })
    const decision = { owner, resolve, promise, transition, navigation }
    pendingRef.current = decision
    setPending(decision)
    return decision
  }, [])

  const settleDecision = useCallback((allowed: boolean): void => {
    const decision = pendingRef.current
    if (!decision)
      return
    pendingRef.current = undefined
    setPending(undefined)
    decision.resolve(allowed)
    if (!allowed || !decision.transition)
      return
    if (decision.navigation)
      approvedNavigation.current = true
    decision.transition()
    // The transition asked about another owner instead of navigating: that
    // answer decides, and a "keep editing" there must leave nothing approved.
    if (pendingRef.current)
      approvedNavigation.current = false
  }, [])

  const requestDecision = useCallback((ownerId: string): Promise<boolean> => {
    const owner = owners.current.get(ownerId)
    if (!owner?.dirty)
      return Promise.resolve(true)
    const active = pendingRef.current
    if (active)
      return active.owner.id === ownerId ? active.promise : Promise.resolve(false)
    return beginDecision(owner).promise
  }, [beginDecision])

  const request = useCallback((ownerId: string, transition: () => void): void => {
    const owner = owners.current.get(ownerId)
    if (!owner?.dirty) {
      transition()
      return
    }
    if (!pendingRef.current)
      beginDecision(owner, transition)
  }, [beginDecision])

  const requestScope = useCallback((scope: UnsavedChangesScope, transition: () => void, navigation = false): void => {
    const owner = [...owners.current.values()].find(candidate => candidate.scope === scope && candidate.dirty)
    if (!owner) {
      transition()
      return
    }
    if (!pendingRef.current)
      beginDecision(owner, transition, navigation)
  }, [beginDecision])

  useEffect(() => {
    if (blocker.state === 'blocked')
      settleDecision(false)
  }, [blocker.state, settleDecision])

  useEffect(() => () => {
    pendingRef.current?.resolve(false)
    pendingRef.current = undefined
  }, [])

  const cancel = (): void => {
    if (blocker.state === 'blocked')
      blocker.reset()
    settleDecision(false)
  }
  const proceed = (): void => {
    if (blocker.state === 'blocked') {
      blocker.proceed()
      return
    }
    settleDecision(true)
  }
  const activeOwner = blocker.state === 'blocked' ? blockedOwner.current : pending?.owner
  const context = useMemo<UnsavedChangesCoordinator>(() => ({ register, request, requestDecision, requestScope }), [register, request, requestDecision, requestScope])

  return (
    <UnsavedChangesContext.Provider value={context}>
      {children}
      <Dialog
        open={blocker.state === 'blocked' || Boolean(pending)}
        title={activeOwner?.title ?? t('lumi.form.leaveTitle', 'Discard unsaved changes?')}
        description={activeOwner?.description ?? t('lumi.form.leaveDescription', 'This page has unsaved changes. Leave the page and discard them?')}
        tone="danger"
        confirmText={activeOwner?.confirmText ?? t('lumi.form.leaveConfirm', 'Discard and leave')}
        cancelText={activeOwner?.cancelText ?? t('lumi.form.leaveCancel', 'Keep editing')}
        onConfirm={proceed}
        onOpenChange={(open) => {
          if (!open)
            cancel()
        }}
      />
    </UnsavedChangesContext.Provider>
  )
}

/** Marks which surface, the page or a drawer layer, the forms inside belong to. */
export function LumiUnsavedChangesScope({ scope, children }: PropsWithChildren<{ scope: UnsavedChangesScope }>): ReactElement {
  return <UnsavedChangesScopeContext.Provider value={scope}>{children}</UnsavedChangesScopeContext.Provider>
}

/** The unsaved-changes coordinator; throws outside its provider. */
export function useUnsavedChangesCoordinator(): UnsavedChangesCoordinator {
  const coordinator = useContext(UnsavedChangesContext)
  if (!coordinator)
    throw new Error('[lumi-admin] unsaved changes require <LumiUnsavedChangesProvider> inside the active router')
  return coordinator
}

/** Registers a form's dirty state, so leaving its page or drawer asks before discarding it. */
export function useUnsavedChangesGuard(props: UnsavedChangesGuardOptions): UnsavedChangesGuard {
  const { t } = useUiText()
  const {
    dirty,
    owner,
    title = t('lumi.form.leaveTitle', 'Discard unsaved changes?'),
    description = t('lumi.form.leaveDescription', 'This page has unsaved changes. Leave the page and discard them?'),
    confirmText = t('lumi.form.leaveConfirm', 'Discard and leave'),
    cancelText = t('lumi.form.leaveCancel', 'Keep editing'),
  } = props
  const coordinator = useUnsavedChangesCoordinator()
  const ownerId = `${owner}:${useId()}`
  const declaredScope = useContext(UnsavedChangesScopeContext)
  const overlayGuard = useCallback<OverlayCloseGuard>(() => coordinator.requestDecision(ownerId), [coordinator, ownerId])
  const inOverlay = useOverlayCloseGuard(overlayGuard, dirty)
  const scope = declaredScope === 'page' && inOverlay ? 'overlay' : declaredScope

  useEffect(() => coordinator.register({
    id: ownerId,
    dirty,
    scope,
    title,
    description,
    confirmText,
    cancelText,
  }), [cancelText, confirmText, coordinator, description, dirty, ownerId, scope, title])

  return {
    request: transition => coordinator.request(ownerId, transition),
    dialog: <></>,
  }
}
