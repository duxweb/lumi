import type { TextValue } from '../catalog/types-public.js'
import { useCallback, useState } from 'react'
import { FIELD_DISABLED, FIELD_FOCUS, FIELD_SURFACE } from '../internal/field-surface.js'

const NO_ITEMS: readonly never[] = []

/**
 * A value that follows its prop when one is given, else its own state. State
 * often holds `null` for "nothing" (a cleared field, a reset form, a backend
 * field that is JSON null): a list control then reads an empty list and a text
 * control an empty string, still controlled, rather than iterating null or
 * leaving the old text on screen.
 */
export function useControllableValue<T>(value: T | undefined, defaultValue: T, onChange?: (value: T) => void, controlled = value !== undefined): [T, (value: T) => void] {
  const [internal, setInternal] = useState(defaultValue)
  const empty = value === null
    ? Array.isArray(defaultValue) ? NO_ITEMS as unknown as T : typeof defaultValue === 'string' ? '' as unknown as T : value as T
    : value as T
  const current = controlled ? empty : internal
  const set = useCallback((next: T) => {
    if (!controlled)
      setInternal(next)
    onChange?.(next)
  }, [controlled, onChange])
  return [current, set]
}

/** The runtime resolves translations before render; this is the type-level tail. */
export function text(value: TextValue): string {
  return value
}

export function optionKey(value: string | number | boolean): string {
  return `${typeof value}:${String(value)}`
}

/**
 * Control heights by size. Merged as a class rather than left to the
 * `[data-lumi-control-size]` rule, so `twMerge` drops a primitive's baked-in
 * height and a caller's own `className` still wins.
 */
export const CONTROL_HEIGHT = { sm: 'h-control-sm', md: 'h-control-md', lg: 'h-control-lg' } as const

/**
 * One choosable row in a picker list: a select option, a cascader node, a time
 * cell. Pointing uses the hover tokens; the chosen row takes the selected tint
 * and brand text, without an edge — a row is not a button.
 */
export const OPTION_CLASS = 'flex h-control-md shrink-0 items-center gap-2 rounded-item px-inset-sm text-start text-control outline-none transition-colors hover:bg-hover hover:text-hover-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 aria-selected:bg-selected aria-selected:text-selected-foreground aria-selected:hover:bg-selected aria-selected:hover:text-selected-foreground'

/** A list panel: options or menu items on the frosted surface, hugged by the menu inset. */
export const MENU_PANEL_CLASS = 'lumi-glass-panel w-auto min-w-(--lumi-menu-min-width) max-w-[calc(100vw-1rem)] gap-0.5 p-(--lumi-menu-padding)'

/** A panel holding a calendar or other content rather than a list. */
export const CONTENT_PANEL_CLASS = 'w-auto max-w-[calc(100vw-1rem)] p-(--lumi-popover-padding)'

/**
 * A button that opens a field's panel (a picker, a cascader, a select) wears
 * Input's surface rather than the outline button's: no hover fill, a fill that
 * runs under its translucent edge, and the disabled wash. Focused or open, it
 * shows a 1.5px brand edge (the border plus a 0.5px inset ring, so nothing
 * shifts) over the faint brand tint, with no halo.
 */
export const FIELD_TRIGGER_CLASS = `${FIELD_SURFACE} ${FIELD_FOCUS} ${FIELD_DISABLED} bg-clip-border hover:bg-transparent aria-expanded:border-ring aria-expanded:bg-focus aria-expanded:ring-[0.5px] aria-expanded:ring-inset aria-expanded:ring-ring aria-expanded:hover:bg-focus dark:hover:bg-input/30 dark:aria-expanded:bg-focus dark:aria-expanded:hover:bg-focus`

/** Placeholder text on a field trigger stays muted under the pointer and while open. */
export const FIELD_PLACEHOLDER_CLASS = 'text-muted-foreground hover:text-muted-foreground aria-expanded:text-muted-foreground'

/** The chosen one of a set of button-like choices: raised, brand edge, soft halo. */
export const CHOICE_CLASS = 'border-choice-border bg-choice font-medium text-choice-foreground hover:bg-choice hover:text-choice-foreground'
