import type { KeyboardEvent, ReactElement } from 'react'
import type { ControlAppearance, Option, OptionValue, Size } from '../catalog/types-public.js'
import { useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, SearchRemoveIcon, XIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { FIELD_TRIGGER_CLASS, optionKey } from './control.js'
import { LumiEmpty } from './empty.js'
import { useLoadMore } from './load-more.js'
import { OptionContent } from './option-content.js'
import { PanelSearch } from './panel-search.js'
import { useUiText } from './text.js'

interface SelectPopoverProps {
  'selected': OptionValue[]
  'options': Option[]
  'selectedOptions'?: Option[] | undefined
  'onSelect': (value: OptionValue) => void
  'onClear': () => void
  'onSearch'?: ((query: string) => void) | undefined
  'onLoadMore'?: (() => void) | undefined
  'multiple'?: boolean
  'filterable'?: boolean
  'clearable'?: boolean
  'disabled'?: boolean
  'readonly'?: boolean
  'loading'?: boolean
  'loadingMore'?: boolean
  'hasMore'?: boolean
  'invalid'?: boolean
  'placeholder'?: string
  'ariaLabel'?: string
  'aria-describedby'?: string
  'id'?: string
  'name'?: string
  'className'?: string
  'size'?: Size
  'appearance'?: ControlAppearance
}

/** Shared dropdown surface for searchable selects and compact multi-selection. */
export function SelectPopover(props: SelectPopoverProps): ReactElement {
  const { t } = useUiText()
  const { selected, options, selectedOptions, onSelect, onClear, onSearch, onLoadMore, multiple, filterable, clearable, disabled, readonly, loading, loadingMore, hasMore, invalid, placeholder = t('lumi.select.placeholder', 'Select…'), ariaLabel, id, name, className, size = 'md', appearance = 'outline', ...rest } = props
  const listName = ariaLabel ?? t('lumi.select.options', 'Options')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeKey, setActiveKey] = useState<string>()
  const listId = useId()
  const list = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const typeahead = useRef({ value: '', at: 0 })
  const selectionLabels = useRef(new Map<OptionValue, string>())
  const unavailable = disabled || readonly
  const remote = onSearch !== undefined
  const normalized = query.trim().toLocaleLowerCase()
  const listed = new Set(options.map(option => optionKey(option.value)))
  // Chosen values beyond the loaded page lead the list until a search starts,
  // so they can be seen and unchosen.
  const echoed = normalized ? [] : (selectedOptions ?? []).filter(option => selected.includes(option.value) && !listed.has(optionKey(option.value)))
  const rows = [...echoed, ...options]
  const visible = remote ? rows : rows.filter(option => !normalized || `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(normalized))
  const enabled = visible.filter(option => !option.disabled)
  const active = enabled.find(option => optionKey(option.value) === activeKey) ?? enabled[0]
  const labelOf = (value: OptionValue): string | undefined => rows.find(option => option.value === value)?.label ?? selectionLabels.current.get(value)
  const labels = selected.map(value => labelOf(value) ?? String(value))
  const resolving = loading && selected.some(value => labelOf(value) === undefined)
  const optionId = (option: Option): string => `${listId}-${rows.indexOf(option)}`
  const activeId = active ? optionId(active) : undefined
  const canClear = clearable && selected.length > 0

  useEffect(() => {
    selectionLabels.current = new Map(selected.map((value, index) => [value, labels[index]!]))
  }, [selected, labels])

  useEffect(() => {
    if (open && activeId)
      document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId, open])

  const { ref: listRef, onScroll, request: requestMore } = useLoadMore(list, { length: options.length, resetKey: query, hasMore, busy: loading || loadingMore, active: open, onLoadMore })

  const changeQuery = (next: string): void => {
    setQuery(next)
    setActiveKey(undefined)
    onSearch?.(next)
  }
  const changeOpen = (next: boolean): void => {
    if (next && unavailable)
      return
    setOpen(next)
    if (!next) {
      if (query)
        changeQuery('')
      setActiveKey(undefined)
    }
  }
  const choose = (option: Option): void => {
    if (option.disabled || unavailable)
      return
    onSelect(option.value)
    if (!multiple)
      changeOpen(false)
  }
  const navigate = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey)
      return
    const index = enabled.findIndex(option => option === active)
    let next: Option | undefined
    if (event.key === 'ArrowDown') {
      next = enabled[(index + 1) % enabled.length]
      if (index >= enabled.length - 2)
        requestMore()
    }
    else if (event.key === 'ArrowUp') {
      next = enabled[(index - 1 + enabled.length) % enabled.length]
    }
    else if (event.key === 'Home' && event.target === list.current) {
      next = enabled[0]
    }
    else if (event.key === 'End' && event.target === list.current) {
      next = enabled.at(-1)
    }
    else if (event.key === 'Enter' || (event.key === ' ' && event.target === list.current)) {
      event.preventDefault()
      if (active)
        choose(active)
      return
    }
    else if (!filterable && event.key.length === 1) {
      const now = Date.now()
      typeahead.current = { value: `${now - typeahead.current.at < 700 ? typeahead.current.value : ''}${event.key.toLocaleLowerCase()}`, at: now }
      next = enabled.find(option => option.label.toLocaleLowerCase().startsWith(typeahead.current.value))
    }
    else {
      return
    }
    event.preventDefault()
    if (next)
      setActiveKey(optionKey(next.value))
  }

  const firstLoad = loading && visible.length === 0
  return (
    <div className={cn('lumi-select-control relative w-full min-w-0', className)} data-slot={multiple ? 'multi-select' : 'search-select'} data-clearable={canClear || undefined}>
      {name && <input type="hidden" name={name} value={multiple ? JSON.stringify(selected) : String(selected[0] ?? '')} disabled={disabled} />}
      <Popover open={open && !unavailable} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn('lumi-select-trigger w-full min-w-0 justify-between text-start font-normal', FIELD_TRIGGER_CLASS)}
            role="combobox"
            aria-label={ariaLabel}
            aria-haspopup="dialog"
            aria-controls={open ? `${listId}-popup` : undefined}
            aria-expanded={open && !unavailable}
            aria-invalid={invalid}
            aria-readonly={readonly || undefined}
            aria-describedby={rest['aria-describedby']}
            aria-busy={loading || undefined}
            disabled={unavailable}
            data-slot="select-trigger"
            data-lumi-control-size={size}
            data-appearance={appearance}
            data-placeholder={selected.length === 0 || resolving || undefined}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveKey(optionKey((event.key === 'ArrowUp' ? enabled.at(-1) : enabled[0])?.value ?? ''))
                changeOpen(true)
              }
            }}
          >
            <span className="lumi-select-value flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap" title={labels.join(', ')}>
              {resolving
                ? t('lumi.select.loading', 'Loading…')
                : selected.length === 0
                  ? placeholder
                  : multiple
                    ? (
                        <>
                          {labels.slice(0, 2).map((label, index) => <span className="lumi-select-chip min-w-0 truncate text-xs" key={optionKey(selected[index]!)}>{label}</span>)}
                          {labels.length > 2 && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              +
                              {labels.length - 2}
                            </span>
                          )}
                        </>
                      )
                    : <span className="truncate">{labels[0]}</span>}
            </span>
            {loading && !open ? <Spinner /> : <ChevronDownIcon className="text-muted-foreground" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id={`${listId}-popup`}
          className="lumi-select-popover gap-0 overflow-hidden p-0"
          aria-label={t('lumi.select.choices', '{name} choices', { name: listName })}
          align="start"
          collisionPadding={8}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const target = search.current ?? list.current
            target?.focus()
          }}
          onEscapeKeyDown={(event) => {
            if (query) {
              event.preventDefault()
              changeQuery('')
            }
          }}
          onKeyDown={navigate}
        >
          {filterable && (
            <PanelSearch
              inputRef={search}
              value={query}
              onValueChange={changeQuery}
              loading={loading && !firstLoad}
              role="combobox"
              aria-label={t('lumi.select.searchOf', '{name} search', { name: listName })}
              aria-controls={listId}
              aria-expanded
              aria-autocomplete="list"
              aria-activedescendant={firstLoad ? undefined : activeId}
            />
          )}
          <div ref={listRef} id={listId} className="lumi-select-options min-h-0 overflow-y-auto overscroll-contain outline-none" role="listbox" aria-label={listName} aria-multiselectable={multiple || undefined} aria-activedescendant={filterable || firstLoad ? undefined : activeId} aria-busy={loading || loadingMore || undefined} tabIndex={filterable ? -1 : 0} onScroll={onScroll} data-empty={visible.length === 0 || undefined}>
            {visible.map((option) => {
              const checked = selected.includes(option.value)
              return (
                <div
                  key={optionKey(option.value)}
                  id={optionId(option)}
                  role="option"
                  aria-selected={checked}
                  aria-disabled={option.disabled || undefined}
                  className="lumi-select-option flex cursor-default items-center justify-between"
                  data-active={option === active || undefined}
                  onPointerMove={() => {
                    if (!option.disabled)
                      setActiveKey(optionKey(option.value))
                  }}
                  onPointerDown={event => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <OptionContent option={option} query={filterable ? query : undefined} />
                  {checked && <CheckIcon className="size-4 shrink-0" aria-hidden />}
                </div>
              )
            })}
            {(loadingMore || (hasMore && visible.length > 0)) && (
              <div className="lumi-select-more flex items-center justify-center text-muted-foreground" role="status" data-slot="select-load-more">
                <Spinner />
                {t('lumi.select.loadingMore', 'Loading more…')}
              </div>
            )}
          </div>
          {firstLoad
            ? (
                <div className="lumi-select-empty m-0 flex items-center justify-center text-muted-foreground" role="status">
                  <Spinner />
                  {normalized ? t('lumi.select.searching', 'Searching…') : t('lumi.select.loading', 'Loading…')}
                </div>
              )
            : visible.length === 0 && (
              <LumiEmpty
                size="xs"
                role="status"
                icon={normalized ? <SearchRemoveIcon /> : undefined}
                title={normalized ? t('lumi.select.noMatch', 'No results for “{query}”', { query: query.trim() }) : t('lumi.select.empty', 'No options found')}
              />
            )}
        </PopoverContent>
      </Popover>
      {canClear && <Button type="button" variant="ghost" size="icon-xs" className="lumi-select-clear" disabled={unavailable} aria-label={t('lumi.select.clear', 'Clear selection')} onClick={onClear}><XIcon /></Button>}
    </div>
  )
}
