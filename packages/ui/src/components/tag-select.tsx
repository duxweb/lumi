import type { ReactElement } from 'react'
import type { OptionValue, TagSelectProps } from '../catalog/types-public.js'
import { LumiIcon } from '../icons.js'
import { ToggleGroup, ToggleGroupItem } from '../internal/shadcn/toggle-group.js'
import { cn } from '../internal/utils.js'
import { CONTROL_HEIGHT, optionKey, useControllableValue } from './control.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

const NO_OPTIONS: readonly never[] = []
const INSET = { sm: 'px-inset-sm', md: 'px-inset-md', lg: 'px-inset-lg' } as const

/** Checkable tags in a row: one value, or several with `multiple`. Arrow keys move between tags. */
export function LumiTagSelect(props: TagSelectProps & HostProps): ReactElement {
  const { value, defaultValue, onChange, options: inputOptions, multiple, clearable, size = 'sm', name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const options = inputOptions ?? NO_OPTIONS
  const values = new Map(options.map(option => [optionKey(option.value), option.value]))
  const [current, setCurrent] = useControllableValue<OptionValue | OptionValue[] | null>(value, defaultValue ?? (multiple ? [] : null), onChange, Object.hasOwn(props, 'value'))
  const selected = Array.isArray(current) ? current : current === null || current === undefined ? [] : [current]
  const keys = selected.map(optionKey)
  const label = ariaLabel ?? props['aria-label']
  const items = options.map(option => (
    <ToggleGroupItem
      key={optionKey(option.value)}
      value={optionKey(option.value)}
      disabled={disabled || option.disabled}
      aria-readonly={readonly || undefined}
      className={cn(CONTROL_HEIGHT[size], INSET[size])}
      data-lumi-control-size={size}
    >
      {option.icon && <LumiIcon name={option.icon} />}
      {option.label}
      {option.count !== undefined && <span className="text-meta tabular-nums in-data-[state=off]:text-(--lumi-fg-secondary)" data-slot="tag-select-count">{option.count}</span>}
    </ToggleGroupItem>
  ))
  const shared = {
    'id': id,
    'role': 'group',
    'disabled': disabled,
    'aria-label': label,
    'aria-invalid': invalid,
    'aria-describedby': props['aria-describedby'],
    'data-invalid': invalid || undefined,
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-slot="lumi-tag-select" data-testid={props['data-testid']}>
      {name && <input type="hidden" name={name} value={multiple ? JSON.stringify(selected) : String(selected[0] ?? '')} disabled={disabled} />}
      {multiple
        ? (
            <ToggleGroup
              {...shared}
              type="multiple"
              value={keys}
              onValueChange={(next) => {
                if (readonly)
                  return
                // Chosen values that are not offered here (not loaded, retired) stay chosen.
                const offered = new Set(options.map(option => optionKey(option.value)))
                setCurrent([...selected.filter(item => !offered.has(optionKey(item))), ...options.filter(option => next.includes(optionKey(option.value))).map(option => option.value)])
              }}
            >
              {items}
            </ToggleGroup>
          )
        : (
            <ToggleGroup
              {...shared}
              type="single"
              value={keys[0] ?? ''}
              onValueChange={(next) => {
                if (readonly || (!next && !clearable))
                  return
                setCurrent(next ? values.get(next) ?? null : null)
              }}
            >
              {items}
            </ToggleGroup>
          )}
      {error && <p role="alert" className="text-meta text-destructive" data-slot="tag-select-error">{error}</p>}
    </div>
  )
}
