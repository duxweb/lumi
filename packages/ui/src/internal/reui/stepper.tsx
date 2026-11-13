import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import { createContext, useContext, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../utils.js'

interface StepperContextValue {
  activeStep: number
  orientation: 'horizontal' | 'vertical'
  idPrefix: string
  select: (step: number) => void
  register: (step: number, element: HTMLButtonElement | null) => void
  focus: (step: number, direction: -1 | 1 | 'first' | 'last') => void
}

const StepperContext = createContext<StepperContextValue | undefined>(undefined)

function useStepperContext(): StepperContextValue {
  const value = useContext(StepperContext)
  if (!value)
    throw new Error('Stepper parts must be rendered inside Stepper')
  return value
}

interface StepperProps extends ComponentProps<'div'> {
  value?: number
  defaultValue?: number
  orientation?: 'horizontal' | 'vertical'
  onValueChange?: (value: number) => void
}

export function Stepper({ value, defaultValue = 1, orientation = 'horizontal', onValueChange, className, children, ...props }: StepperProps): React.ReactElement {
  const [internal, setInternal] = useState(defaultValue)
  const triggers = useRef(new Map<number, HTMLButtonElement>())
  const idPrefix = useId()
  const activeStep = value ?? internal
  const context = useMemo<StepperContextValue>(() => ({
    activeStep,
    orientation,
    idPrefix,
    select(step) {
      if (value === undefined)
        setInternal(step)
      onValueChange?.(step)
    },
    register(step, element) {
      if (element)
        triggers.current.set(step, element)
      else
        triggers.current.delete(step)
    },
    focus(step, direction) {
      const entries = [...triggers.current.entries()].filter(([, element]) => !element.disabled).sort(([left], [right]) => left - right)
      if (!entries.length)
        return
      const index = entries.findIndex(([candidate]) => candidate === step)
      const target = direction === 'first'
        ? entries[0]
        : direction === 'last'
          ? entries.at(-1)
          : entries[(index + direction + entries.length) % entries.length]
      target?.[1].focus()
    },
  }), [activeStep, idPrefix, onValueChange, orientation, value])
  return <StepperContext.Provider value={context}><div className={cn('w-full', className)} data-slot="stepper" data-orientation={orientation} {...props}>{children}</div></StepperContext.Provider>
}

export function StepperNav({ className, ...props }: ComponentProps<'div'>): React.ReactElement {
  const { orientation } = useStepperContext()
  return <div className={cn('flex w-full data-[orientation=vertical]:flex-col', className)} role="tablist" aria-orientation={orientation} data-slot="stepper-nav" data-orientation={orientation} {...props} />
}

interface StepperItemProps extends ComponentProps<'div'> {
  step: number
  state: 'complete' | 'current' | 'upcoming' | 'loading' | 'error'
}

export function StepperItem({ step, state, className, ...props }: StepperItemProps): React.ReactElement {
  return <div className={cn('group/step relative flex min-w-0 items-start data-[orientation=horizontal]:flex-1', className)} data-slot="stepper-item" data-step={step} data-state={state} {...props} />
}

interface StepperTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  step: number
  children: ReactNode
}

export function StepperTrigger({ step, className, children, onClick, onKeyDown, ...props }: StepperTriggerProps): React.ReactElement {
  const context = useStepperContext()
  const selected = context.activeStep === step
  const triggerId = `${context.idPrefix}-trigger-${step}`
  const panelId = `${context.idPrefix}-panel-${step}`
  return (
    <button
      ref={element => context.register(step, element)}
      type="button"
      role="tab"
      id={triggerId}
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      className={cn('inline-flex min-w-0 items-center gap-2 rounded-item outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50', className)}
      data-slot="stepper-trigger"
      onClick={(event) => {
        context.select(step)
        onClick?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          context.focus(step, 1)
        }
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          context.focus(step, -1)
        }
        else if (event.key === 'Home') {
          event.preventDefault()
          context.focus(step, 'first')
        }
        else if (event.key === 'End') {
          event.preventDefault()
          context.focus(step, 'last')
        }
        else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          context.select(step)
        }
        onKeyDown?.(event)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export function StepperIndicator({ className, ...props }: ComponentProps<'span'>): React.ReactElement {
  return <span aria-hidden className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border text-xs', className)} data-slot="stepper-indicator" {...props} />
}

export function StepperSeparator({ className, ...props }: ComponentProps<'span'>): React.ReactElement {
  return <span aria-hidden className={cn('mx-3 mt-3 h-px min-w-4 flex-1 bg-border group-data-[orientation=vertical]/stepper:hidden', className)} data-slot="stepper-separator" {...props} />
}

export function StepperPanel({ step, className, ...props }: ComponentProps<'div'> & { step: number }): React.ReactElement {
  const context = useStepperContext()
  const active = context.activeStep === step
  return <div id={`${context.idPrefix}-panel-${step}`} role="tabpanel" aria-labelledby={`${context.idPrefix}-trigger-${step}`} className={cn('mt-4', className)} data-slot="stepper-panel" hidden={!active} {...props} />
}
