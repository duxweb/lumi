import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'

export type OverlayType = 'modal' | 'drawer' | 'dialog'
export type OverlayCloseReason = 'dismiss' | 'cancel' | 'confirm' | 'programmatic'
export type OverlayCloseGuard = (request: { id: number, reason: OverlayCloseReason, value?: unknown }) => boolean | Promise<boolean>

export interface OverlayOptions {
  type: OverlayType
  title: string
  message?: string
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  /** A HugeIcons name for the confirmation's icon, or `false` for none; omitted, the tone picks it. */
  icon?: string | false
  confirmText?: string
  cancelText?: string
  placement?: 'left' | 'right' | 'top' | 'bottom'
  render?: () => ReactNode
}

export interface OverlayEntry extends OverlayOptions {
  id: number
  resolve: (value: unknown) => void
}

export interface OverlayHandle {
  id: number
  close: (value?: unknown) => Promise<boolean>
  result: Promise<unknown>
}

export interface OverlayController {
  /** The open overlays, the newest last. */
  entries: OverlayEntry[]
  /** The open overlays as an immutable list, for `useSyncExternalStore`. */
  getSnapshot: () => OverlayEntry[]
  /** Opens an overlay; the handle closes it and carries its `result`. */
  open: (options: OverlayOptions) => OverlayHandle
  /** Closes an overlay once its close guards agree; resolves whether it closed. */
  requestClose: (id: number, request?: { reason?: OverlayCloseReason, value?: unknown }) => Promise<boolean>
  /** Adds a check that may refuse a close; returns the function removing it. */
  registerCloseGuard: (id: number, guard: OverlayCloseGuard) => () => void
  /** Closes every overlay and drops the listeners. */
  dispose: () => void
  /** Notifies when the open overlays change. */
  subscribe: (listener: () => void) => () => void
}

/** The React context carrying the overlay controller. */
export const LumiOverlayContext = createContext<OverlayController | null>(null)
const LumiOverlayCloseGuardContext = createContext<((guard: OverlayCloseGuard) => () => void) | null>(null)

/** Registers a check an overlay runs before it closes, e.g. to confirm unsaved changes; returns whether it is inside an overlay. */
export function useOverlayCloseGuard(guard: OverlayCloseGuard, active = true): boolean {
  const register = useContext(LumiOverlayCloseGuardContext)
  useEffect(() => active && register ? register(guard) : undefined, [active, guard, register])
  return Boolean(register)
}

function OverlayCloseGuardScope(props: { controller: OverlayController, id: number, children: ReactNode }): ReactNode {
  const register = useMemo(() => (guard: OverlayCloseGuard) => props.controller.registerCloseGuard(props.id, guard), [props.controller, props.id])
  return <LumiOverlayCloseGuardContext.Provider value={register}>{props.children}</LumiOverlayCloseGuardContext.Provider>
}

/** The store of open overlays behind `useOverlay`: opens them, runs their close guards and resolves their results. */
export function createOverlayController(): OverlayController {
  const entries: OverlayEntry[] = []
  const listeners = new Set<() => void>()
  let snapshot: OverlayEntry[] = []
  let seq = 0
  const guards = new Map<number, Set<OverlayCloseGuard>>()
  const pendingCloses = new Map<number, Promise<boolean>>()

  function emit(): void {
    snapshot = [...entries]
    for (const listener of listeners)
      listener()
  }

  function forceClose(id: number, value?: unknown): boolean {
    const index = entries.findIndex(entry => entry.id === id)
    if (index === -1)
      return false
    entries[index]!.resolve(value)
    entries.splice(index, 1)
    guards.delete(id)
    pendingCloses.delete(id)
    emit()
    return true
  }

  function requestClose(id: number, request: { reason?: OverlayCloseReason, value?: unknown } = {}): Promise<boolean> {
    const active = pendingCloses.get(id)
    if (active)
      return active
    if (!entries.some(entry => entry.id === id))
      return Promise.resolve(false)
    const reason = request.reason ?? 'programmatic'
    const pending = Promise.resolve().then(async () => {
      try {
        for (const guard of guards.get(id) ?? []) {
          if (!await guard({ id, reason, value: request.value }))
            return false
        }
        return forceClose(id, request.value)
      }
      catch {
        return false
      }
    })
    pendingCloses.set(id, pending)
    void pending.then(() => {
      if (pendingCloses.get(id) === pending)
        pendingCloses.delete(id)
    })
    return pending
  }

  function open(options: OverlayOptions): OverlayHandle {
    const id = ++seq
    let resolve!: (value: unknown) => void
    const result = new Promise<unknown>((r) => {
      resolve = r
    })
    entries.push({ ...options, id, resolve })
    emit()
    return { id, close: value => requestClose(id, { reason: 'programmatic', value }), result }
  }

  function dispose(): void {
    entries.splice(0).forEach(entry => entry.resolve(undefined))
    guards.clear()
    pendingCloses.clear()
    emit()
    listeners.clear()
  }

  return {
    entries,
    getSnapshot: () => snapshot,
    open,
    requestClose,
    registerCloseGuard(id, guard) {
      const entryGuards = guards.get(id) ?? new Set<OverlayCloseGuard>()
      entryGuards.add(guard)
      guards.set(id, entryGuards)
      return () => {
        entryGuards.delete(guard)
        if (entryGuards.size === 0)
          guards.delete(id)
      }
    },
    dispose,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** The overlay controller of the nearest `LumiOverlayProvider`, which `useModal`, `useDrawer` and `useDialog` open through. */
export function useOverlay(): OverlayController {
  const controller = useContext(LumiOverlayContext)
  if (!controller)
    throw new Error('[lumi] Overlay controller is not provided. Use LumiOverlayProvider.')
  return controller
}

function useOverlayEntries(controller: OverlayController): OverlayEntry[] {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    () => [],
  )
}

export interface OverlayOpenOptions {
  /** The overlay's heading. */
  title: string
  /** Renders the overlay's content. */
  render: () => ReactNode
}

/** Opens a modal with content rendered by `render`; the handle's `close(value)` resolves its `result`. */
export function useModal(): { open: (options: OverlayOpenOptions) => OverlayHandle } {
  const controller = useOverlay()
  return useMemo(() => ({
    open: options => controller.open({ type: 'modal', ...options }),
  }), [controller])
}

/** Opens a drawer with content rendered by `render`, from the side `placement` names. */
export function useDrawer(): { open: (options: OverlayOpenOptions & { placement?: 'left' | 'right' | 'top' | 'bottom' }) => OverlayHandle } {
  const controller = useOverlay()
  return useMemo(() => ({
    open: options => controller.open({ type: 'drawer', ...options }),
  }), [controller])
}

export interface DialogOptions {
  /** The question or statement. */
  title: string
  /** A line of detail under the title. */
  message?: string
  tone?: OverlayOptions['tone']
  icon?: OverlayOptions['icon']
  /** Label of the accepting button. */
  confirmText?: string
  /** Label of the dismissing button. */
  cancelText?: string
  /** Content under the message, e.g. the field of a prompt. */
  render?: () => ReactNode
}

/** Confirm, alert and prompt dialogs drawn by the host, following its theme: `confirm` resolves true when the reader accepts. */
export function useDialog(): {
  confirm: (options: DialogOptions) => Promise<boolean>
  alert: (options: DialogOptions) => Promise<void>
  prompt: (options: DialogOptions) => Promise<unknown>
} {
  const controller = useOverlay()
  return useMemo(() => ({
    async confirm(options) {
      const handle = controller.open({ type: 'dialog', ...options })
      return await handle.result === true
    },
    async alert(options) {
      const handle = controller.open({ type: 'dialog', ...options, cancelText: undefined })
      await handle.result
    },
    async prompt(options) {
      const handle = controller.open({ type: 'dialog', ...options })
      return handle.result
    },
  }), [controller])
}

export interface LumiOverlayHostProps {
  render: (entry: OverlayEntry, close: (reason: OverlayCloseReason, value?: unknown) => Promise<boolean>, children: ReactNode) => ReactNode
}

/** Renders the open overlays through `render`, which draws each entry and receives its close function. */
export function LumiOverlayHost({ render }: LumiOverlayHostProps): ReactNode {
  const controller = useOverlay()
  const entries = useOverlayEntries(controller)
  return entries.map(entry => <OverlayCloseGuardScope key={entry.id} controller={controller} id={entry.id}>{render(entry, (reason, value) => controller.requestClose(entry.id, { reason, value }), entry.render?.())}</OverlayCloseGuardScope>)
}

/** Provides an overlay controller to `useOverlay`, `useModal`, `useDrawer` and `useDialog`. */
export function LumiOverlayProvider({ controller, children }: { controller: OverlayController, children: ReactNode }): ReactNode {
  return <LumiOverlayContext.Provider value={controller}>{children}</LumiOverlayContext.Provider>
}
