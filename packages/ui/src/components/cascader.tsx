import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import type { CascaderOption, CascaderProps, OptionValue } from '../catalog/types-public.js'
import { useMemo, useState } from 'react'
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, SearchRemoveIcon, XIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Input } from '../internal/shadcn/input.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { CONTROL_HEIGHT, FIELD_PLACEHOLDER_CLASS, FIELD_TRIGGER_CLASS, OPTION_CLASS, optionKey, useControllableValue } from './control.js'
import { LumiEmpty } from './empty.js'
import { useUiText } from './text.js'
import { treeHasChildren, treeNeedsLoad } from './tree-utils.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string, 'aria-describedby'?: string, 'id'?: string }

/** The options along `path`, stopping at the first value that no longer matches. */
const NO_OPTIONS: readonly CascaderOption[] = []

/** The options along a value path, level by level, up to the first value that is not found. */
export function cascaderPathOptions(options: readonly CascaderOption[], path: readonly OptionValue[]): CascaderOption[] {
  const found: CascaderOption[] = []
  let level: readonly CascaderOption[] | undefined = options
  for (const value of path) {
    const option: CascaderOption | undefined = level?.find(item => item.value === value)
    if (!option)
      break
    found.push(option)
    level = option.children
  }
  return found
}

/** The path from a root to `value`, wherever it sits in the tree. */
export function cascaderFindPath(options: readonly CascaderOption[], value: OptionValue): OptionValue[] {
  for (const option of options) {
    if (option.value === value)
      return [option.value]
    const rest = option.children ? cascaderFindPath(option.children, value) : []
    if (rest.length)
      return [option.value, ...rest]
  }
  return []
}

function leafPaths(options: readonly CascaderOption[], trail: CascaderOption[] = [], all = false): CascaderOption[][] {
  return options.flatMap((option) => {
    const path = [...trail, option]
    if (option.disabled)
      return []
    const below = option.children?.length ? leafPaths(option.children, path, all) : []
    return option.children?.length ? (all ? [path, ...below] : below) : [path]
  })
}

/**
 * Hierarchical choice: one column per level, opened by pointing at a parent.
 * The value is the path of option values from the root, e.g. `['cn', 'zj', 'hz']`.
 */
export function LumiCascader(props: CascaderProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { options: inputOptions, value, defaultValue = [], onChange, onLoadChildren, loading = false, changeOnSelect = false, searchable = false, clearable = false, separator = ' / ', placeholder = t('lumi.select.placeholder', 'Select…'), size = 'md', appearance = 'outline', name, disabled, readonly, invalid, ariaLabel, className, id, ...rest } = props
  // Bound lists are `null` while their data loads.
  const options = inputOptions ?? NO_OPTIONS
  const lazy = Boolean(onLoadChildren)
  const listName = ariaLabel ?? t('lumi.select.options', 'Options')
  const [selected, setSelected] = useControllableValue<readonly OptionValue[]>(value, defaultValue, next => onChange?.(next.length ? [...next] : null))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<OptionValue[]>([])
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const chosen = cascaderPathOptions(options, selected)
  const text = chosen.length ? chosen.map(option => option.label).join(separator) : undefined
  const trail = cascaderPathOptions(options, active)
  const columns: (readonly CascaderOption[] | null)[] = [loading && !options.length ? null : options, ...trail.filter(option => option.children?.length || treeNeedsLoad(option, lazy) || pending.has(optionKey(option.value))).map(option => option.children?.length ? option.children : null)]
  const load = (option: CascaderOption): void => {
    const key = optionKey(option.value)
    if (!treeNeedsLoad(option, lazy) || pending.has(key))
      return
    const result = onLoadChildren?.(option)
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setPending(set => new Set(set).add(key))
      const done = (): void => setPending((set) => {
        const next = new Set(set)
        next.delete(key)
        return next
      })
      ;(result as Promise<unknown>).then(done, done)
    }
  }
  const reveal = (option: CascaderOption, level: number): void => {
    setActive([...trail.slice(0, level), option].map(item => item.value))
    load(option)
  }
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? leafPaths(options, [], changeOnSelect).filter(path => path.some(option => option.label.toLowerCase().includes(needle))).slice(0, 50) : []
  }, [changeOnSelect, options, query])

  const commit = (path: readonly CascaderOption[]): void => {
    setSelected(path.map(option => option.value))
    setOpen(false)
  }
  const pick = (option: CascaderOption, level: number): void => {
    const path = [...trail.slice(0, level), option]
    setActive(path.map(item => item.value))
    load(option)
    if (!treeHasChildren(option, lazy))
      commit(path)
    else if (changeOnSelect)
      setSelected(path.map(item => item.value))
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, option: CascaderOption, level: number): void => {
    const column = event.currentTarget.closest('[role=listbox]')
    const items = [...column?.querySelectorAll<HTMLButtonElement>('[role=option]:not(:disabled)') ?? []]
    const index = items.indexOf(event.currentTarget)
    const panel = column?.parentElement
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
    else if (event.key === 'ArrowRight' && treeHasChildren(option, lazy)) {
      event.preventDefault()
      reveal(option, level)
      requestAnimationFrame(() => panel?.children[level + 1]?.querySelector<HTMLButtonElement>('[role=option]:not(:disabled)')?.focus())
    }
    else if (event.key === 'ArrowLeft' && level > 0) {
      event.preventDefault()
      panel?.children[level - 1]?.querySelector<HTMLButtonElement>('[aria-current=true], [role=option]')?.focus()
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setQuery('')
        if (next)
          setActive([...selected])
      }}
    >
      {name && <input type="hidden" name={name} value={selected.map(String).join(',')} disabled={disabled} />}
      <div className={cn('relative w-full min-w-0', className)} data-slot="cascader">
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn('w-full min-w-0 justify-between px-inset-md font-normal', FIELD_TRIGGER_CLASS, CONTROL_HEIGHT[size], !text && FIELD_PLACEHOLDER_CLASS, clearable && text && 'pr-8')}
            disabled={disabled || readonly}
            aria-label={ariaLabel}
            aria-invalid={invalid}
            aria-describedby={rest['aria-describedby']}
            aria-haspopup="listbox"
            data-appearance={appearance}
            data-lumi-control-size={size}
            data-testid={rest['data-testid']}
          >
            <span className="truncate">{text ?? placeholder}</span>
            <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        {clearable && text && !disabled && !readonly && (
          <Button type="button" variant="ghost" size="icon-xs" className="absolute top-1/2 right-1.5 -translate-y-1/2" aria-label={t('lumi.common.clear', 'Clear')} onClick={() => setSelected([])}>
            <XIcon />
          </Button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1rem)] gap-0 p-0" data-slot="cascader-panel">
        {searchable && (
          <div className="relative border-b border-border p-(--lumi-menu-padding)">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="h-control-md border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0" value={query} placeholder={t('lumi.select.search', 'Search…')} aria-label={t('lumi.select.searchOf', '{name} search', { name: listName })} onChange={event => setQuery(event.target.value)} />
          </div>
        )}
        {query.trim()
          ? (
              <div role="listbox" aria-label={t('lumi.cascader.results', 'Search results')} className="flex max-h-72 min-w-56 flex-col gap-0.5 overflow-y-auto p-(--lumi-menu-padding)">
                {matches.length
                  ? matches.map(path => (
                      <button
                        key={path.map(option => optionKey(option.value)).join('/')}
                        type="button"
                        role="option"
                        aria-selected={path.length === chosen.length && path.every((option, index) => option.value === chosen[index]?.value)}
                        className={OPTION_CLASS}
                        onClick={() => commit(path)}
                      >
                        {path.map(option => option.label).join(separator)}
                      </button>
                    ))
                  : <LumiEmpty size="xs" role="status" icon={<SearchRemoveIcon />} title={t('lumi.common.noMatches', 'No matches')} />}
              </div>
            )
          : (
              <div className="flex divide-x divide-border overflow-x-auto" data-slot="cascader-columns">
                {columns.map((column, level) => (
                  <div key={level} role="listbox" aria-label={t('lumi.cascader.level', '{name} level {level}', { name: listName, level: level + 1 })} aria-busy={!column || undefined} className="flex max-h-72 w-(--lumi-menu-min-width) shrink-0 flex-col gap-0.5 overflow-y-auto p-(--lumi-menu-padding)">
                    {!column && (
                      <p className="flex h-control-md items-center gap-2 px-inset-sm text-control text-muted-foreground" role="status">
                        <Spinner aria-hidden role="presentation" />
                        {t('lumi.select.loading', 'Loading…')}
                      </p>
                    )}
                    {column?.map((option) => {
                      const onPath = trail[level]?.value === option.value
                      const isChosen = chosen.length === level + 1 && chosen[level]?.value === option.value
                      return (
                        <button
                          key={optionKey(option.value)}
                          type="button"
                          role="option"
                          aria-selected={isChosen}
                          aria-current={onPath || undefined}
                          disabled={option.disabled}
                          className={cn(
                            OPTION_CLASS,
                            onPath && !isChosen && 'bg-hover text-hover-foreground',
                          )}
                          onMouseEnter={() => treeHasChildren(option, lazy) && reveal(option, level)}
                          onKeyDown={event => onKeyDown(event, option, level)}
                          onClick={() => pick(option, level)}
                        >
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                          {pending.has(optionKey(option.value))
                            ? <Spinner aria-hidden role="presentation" className="size-4 shrink-0 opacity-60" />
                            : treeHasChildren(option, lazy)
                              ? <ChevronRightIcon className="size-4 shrink-0 opacity-60" aria-hidden />
                              : isChosen && <CheckIcon className="size-4 shrink-0" aria-hidden />}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
      </PopoverContent>
    </Popover>
  )
}
