import type { FocusEvent, ReactElement, ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { AlertCircleIcon } from '../icons.js'
import { TOOLTIP_LAYER } from '../internal/layers.js'
import { cn } from '../internal/utils.js'
import { TOOLTIP_CLASS } from './interactive.js'

export type ErrorDisplay = 'inline' | 'tooltip'

interface Candidate { anchor: HTMLElement, reveal: () => void }

let batch: Candidate[] = []
let flushing: ReturnType<typeof setTimeout> | undefined

/**
 * Errors that appear together (one failed submit) arrive in the same tick;
 * only the first in document order opens by itself, or a form full of
 * tooltips would bury the fields they point at.
 */
function propose(candidate: Candidate): void {
  batch.push(candidate)
  flushing ??= setTimeout(() => {
    const live = batch.filter(item => item.anchor.isConnected)
    batch = []
    flushing = undefined
    live.sort((a, b) => a.anchor.compareDocumentPosition(b.anchor) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
    live[0]?.reveal()
  }, 0)
}

export interface FieldErrorTipProps {
  /** The message; nothing is shown while it is empty. */
  message?: string | undefined
  /** Id of the visually hidden copy, for the control's `aria-describedby`. */
  id: string
  /**
   * Link the message to the control inside (`aria-describedby`, `aria-invalid`)
   * when the host cannot pass those props, as with cells rendered from JSON.
   */
  describe?: boolean
  className?: string | undefined
  children: ReactNode
}

const CONTROL = 'input:not([type="hidden"]), textarea, select, [role="combobox"], [contenteditable="true"]'

/**
 * Wraps a control whose error is shown above it instead of under it, so a
 * message never changes the layout. It opens while the control is hovered or
 * focused, and once by itself when the error first appears.
 */
export function LumiFieldErrorTip({ message, id, describe = false, className, children }: FieldErrorTipProps): ReactElement {
  const anchor = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const previous = useRef(message)
  const mounted = useRef(false)

  useEffect(() => {
    const before = previous.current
    previous.current = message
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (!message) {
      setRevealed(false)
      return
    }
    if (message !== before && anchor.current)
      propose({ anchor: anchor.current, reveal: () => setRevealed(true) })
  }, [message])

  useEffect(() => {
    const target = describe && message ? anchor.current?.querySelector<HTMLElement>(CONTROL) : undefined
    if (!target)
      return
    const describedBy = target.getAttribute('aria-describedby')
    const invalid = target.getAttribute('aria-invalid')
    target.setAttribute('aria-describedby', [describedBy, id].filter(Boolean).join(' '))
    target.setAttribute('aria-invalid', 'true')
    return () => {
      if (describedBy === null)
        target.removeAttribute('aria-describedby')
      else target.setAttribute('aria-describedby', describedBy)
      if (invalid === null)
        target.removeAttribute('aria-invalid')
      else target.setAttribute('aria-invalid', invalid)
    }
  }, [describe, message, id])

  useEffect(() => {
    if (!revealed)
      return
    const close = (event: Event): void => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !anchor.current?.contains(event.target as Node))
        setRevealed(false)
    }
    document.addEventListener('pointerdown', close, true)
    document.addEventListener('keydown', close, true)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      document.removeEventListener('keydown', close, true)
    }
  }, [revealed])

  const leave = (event: FocusEvent): void => {
    if (anchor.current?.contains(event.relatedTarget as Node | null))
      return
    setFocused(false)
    setRevealed(false)
  }
  const open = Boolean(message) && (hovered || focused || revealed)
  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <TooltipPrimitive.Root open={open}>
        <TooltipPrimitive.Trigger asChild>
          <span
            ref={anchor}
            data-slot="field-error-anchor"
            data-invalid={message ? true : undefined}
            className={cn('relative block min-w-0', className)}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={leave}
          >
            {children}
            {message && <span id={id} className="sr-only">{message}</span>}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            data-slot="tooltip"
            data-tone="danger"
            side="top"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            aria-hidden
            style={TOOLTIP_LAYER}
            className={TOOLTIP_CLASS}
            onPointerDownOutside={event => event.preventDefault()}
          >
            <AlertCircleIcon aria-hidden />
            <span>{message}</span>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
