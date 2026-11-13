import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import type { ListboxOption, ListboxProps, OptionValue } from '../catalog/types-public.js'
import { useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, useOutlineIcon } from '../icons.js'
import { cn } from '../internal/utils.js'
import { OPTION_CLASS, optionKey, useControllableValue } from './control.js'
import { LumiEmpty } from './empty.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string, 'id'?: string, 'aria-describedby'?: string }

type ListboxValue = OptionValue | OptionValue[] | null

function OptionRow({ id, option, selected, active, onPick, onPoint }: { id: string, option: ListboxOption, selected: boolean, active: boolean, onPick: () => void, onPoint: () => void }): ReactElement {
  const Icon = useOutlineIcon(option.icon ?? undefined)
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      data-slot="listbox-option"
      data-active={active || undefined}
      className={cn(OPTION_CLASS, 'h-auto min-h-control-md cursor-default py-1.5 data-active:bg-hover data-active:text-hover-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40 aria-selected:data-active:bg-selected aria-selected:data-active:text-selected-foreground group-focus-visible/listbox:data-active:ring-1 group-focus-visible/listbox:data-active:ring-ring/60 group-focus-visible/listbox:data-active:ring-inset', option.description && 'items-start')}
      onMouseMove={onPoint}
      onClick={onPick}
    >
      {Icon && <Icon aria-hidden className={cn('size-4 shrink-0 opacity-70', option.description && 'mt-0.5')} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{option.label}</span>
        {option.description && <span className="text-meta text-muted-foreground" data-slot="listbox-description">{option.description}</span>}
      </span>
      <CheckIcon aria-hidden className={cn('size-4 shrink-0 self-center', !selected && 'invisible')} />
    </div>
  )
}

/**
 * An always-open option list. Focus stays on the list and the active option
 * is announced through `aria-activedescendant`, as the listbox pattern asks.
 */
export function LumiListbox(props: ListboxProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue, onChange, options, multiple, maxHeight, empty, disabled, readonly, invalid, ariaLabel, className, children: _children, 'aria-label': hostLabel, 'data-testid': testId, id, 'aria-describedby': describedBy } = props
  const [current, setCurrent] = useControllableValue<ListboxValue>(value as ListboxValue | undefined, (defaultValue ?? (multiple ? [] : null)) as ListboxValue, next => onChange?.(next))
  const chosen = new Set((Array.isArray(current) ? current : current == null ? [] : [current]).map(optionKey))
  const baseId = useId()
  const optionId = (index: number): string => `${baseId}-option-${index}`
  const enabled = options.flatMap((option, index) => option.disabled ? [] : [index])
  const [active, setActive] = useState<number>(-1)
  const list = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: '', at: 0 })
  useEffect(() => {
    if (active >= 0)
      list.current?.ownerDocument.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' })
  }, [active])
  const pick = (index: number): void => {
    const option = options[index]
    if (!option || option.disabled || disabled || readonly)
      return
    setActive(index)
    if (multiple) {
      const values = Array.isArray(current) ? current : []
      setCurrent(chosen.has(optionKey(option.value)) ? values.filter(item => optionKey(item) !== optionKey(option.value)) : [...values, option.value])
    }
    else {
      setCurrent(option.value)
    }
  }
  const move = (to: number): void => {
    if (enabled.length)
      setActive(enabled[Math.max(0, Math.min(enabled.length - 1, to))]!)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const position = enabled.indexOf(active)
    if (event.key === 'ArrowDown') {
      move(position < 0 ? 0 : position + 1)
    }
    else if (event.key === 'ArrowUp') {
      move(position < 0 ? enabled.length - 1 : position - 1)
    }
    else if (event.key === 'Home') {
      move(0)
    }
    else if (event.key === 'End') {
      move(enabled.length - 1)
    }
    else if (event.key === ' ' || event.key === 'Enter') {
      pick(active)
    }
    else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + event.key.toLowerCase(), at: now }
      const match = enabled.find(index => options[index]!.label.toLowerCase().startsWith(typed.current.text))
      if (match !== undefined)
        setActive(match)
      return
    }
    else {
      return
    }
    event.preventDefault()
  }
  const groups: Array<{ name: string | null | undefined, entries: number[] }> = []
  options.forEach((option, index) => {
    const last = groups.at(-1)
    if (last && last.name === option.group)
      last.entries.push(index)
    else
      groups.push({ name: option.group, entries: [index] })
  })
  const row = (index: number): ReactElement => (
    <OptionRow
      key={optionKey(options[index]!.value)}
      id={optionId(index)}
      option={options[index]!}
      selected={chosen.has(optionKey(options[index]!.value))}
      active={active === index}
      onPick={() => pick(index)}
      onPoint={() => !options[index]!.disabled && setActive(index)}
    />
  )
  return (
    <div
      ref={list}
      id={id}
      role="listbox"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel ?? hostLabel}
      aria-describedby={describedBy}
      aria-multiselectable={multiple || undefined}
      aria-activedescendant={active >= 0 ? optionId(active) : undefined}
      aria-disabled={disabled || undefined}
      aria-readonly={readonly || undefined}
      aria-invalid={invalid || undefined}
      data-slot="listbox"
      data-testid={testId}
      className={cn('group/listbox flex flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-control border border-input p-(--lumi-menu-padding) outline-none [--lumi-radius-item:max(var(--lumi-radius-sm),calc(var(--lumi-radius-control)-var(--lumi-menu-padding)))] focus-visible:border-ring focus-visible:ring-[0.5px] focus-visible:ring-ring focus-visible:ring-inset aria-invalid:border-destructive', disabled && 'pointer-events-none opacity-50', className)}
      style={maxHeight ? { maxHeight } : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (active < 0) {
          const first = options.findIndex(option => !option.disabled && chosen.has(optionKey(option.value)))
          setActive(first >= 0 ? first : enabled[0] ?? -1)
        }
      }}
    >
      {options.length === 0 && <LumiEmpty size="xs" title={empty ?? t('lumi.common.noData', 'No data')} />}
      {groups.map((group, groupIndex) => group.name
        ? (
            <div key={`${group.name}:${groupIndex}`} role="group" aria-labelledby={`${baseId}-group-${groupIndex}`} className={cn('flex flex-col gap-0.5', groupIndex > 0 && 'mt-1 border-t border-border pt-1')}>
              <div id={`${baseId}-group-${groupIndex}`} role="presentation" className="px-inset-sm pt-1.5 pb-1 text-xs text-muted-foreground" data-slot="listbox-group-label">{group.name}</div>
              {group.entries.map(row)}
            </div>
          )
        : group.entries.map(row))}
    </div>
  )
}
