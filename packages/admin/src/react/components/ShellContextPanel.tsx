import type { PropsWithChildren, ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

interface ContextPanelSlot {
  target: HTMLElement | null
  setTarget: (element: HTMLElement | null) => void
  claimed: boolean
  claim: () => () => void
}

const ContextPanelContext = createContext<ContextPanelSlot | null>(null)

/**
 * Lets a page take over the shell's context column — the dual layout's second
 * column — while it is mounted, e.g. the agent workspace showing its
 * conversations where the module menu was. The column returns to the menu
 * when the page leaves.
 */
export function ShellContextPanelProvider({ children }: PropsWithChildren): ReactNode {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [claims, setClaims] = useState(0)
  const claim = useCallback(() => {
    setClaims(count => count + 1)
    return () => setClaims(count => count - 1)
  }, [])
  const value = useMemo<ContextPanelSlot>(() => ({ target, setTarget, claimed: claims > 0, claim }), [target, claims, claim])
  return <ContextPanelContext.Provider value={value}>{children}</ContextPanelContext.Provider>
}

/** For layouts: whether a page claims the context column, and the ref of the element it fills. */
export function useShellContextPanelHost(): { claimed: boolean, ref: (element: HTMLElement | null) => void } {
  const slot = useContext(ContextPanelContext)
  return { claimed: Boolean(slot?.claimed), ref: slot?.setTarget ?? noop }
}

function noop(): void {}

/**
 * Claims the context column while mounted and returns the element to portal
 * into, or null when there is none to show: the single layout, a collapsed
 * sidebar, or a screen too narrow for the column. A page then draws the
 * content itself.
 */
export function useShellContextPanel(): HTMLElement | null {
  const slot = useContext(ContextPanelContext)
  const claim = slot?.claim
  const target = slot?.target ?? null
  const [visible, setVisible] = useState(false)
  useEffect(() => claim?.(), [claim])
  useEffect(() => {
    if (!target) {
      setVisible(false)
      return
    }
    const measure = (): void => setVisible(target.getClientRects().length > 0 && target.offsetWidth > 0)
    measure()
    if (typeof ResizeObserver === 'undefined')
      return
    // A hidden column has no box, so its size reports when it shows or hides.
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    const view = target.ownerDocument.defaultView
    view?.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      view?.removeEventListener('resize', measure)
    }
  }, [target])
  return visible ? target : null
}

/** Renders `children` in the shell's context column, or `fallback` where there is none. */
export function ShellContextPanel({ children, fallback = null }: { children: ReactNode, fallback?: ReactNode }): ReactNode {
  const target = useShellContextPanel()
  return target ? createPortal(children, target) : fallback
}
