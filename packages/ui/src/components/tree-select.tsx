import type { ReactElement } from 'react'
import type { OptionValue, TreeSelectProps, TreeValue } from '../catalog/types-public.js'
import type { TreeItem } from './tree-utils.js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, SearchIcon, XIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Input } from '../internal/shadcn/input.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { FIELD_TRIGGER_CLASS, optionKey, useControllableValue } from './control.js'
import { useUiText } from './text.js'
import { indexTree, toValueArray } from './tree-utils.js'
import { LumiTree } from './tree.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'aria-describedby'?: string, 'id'?: string }

const MAX_TAGS = 2

/**
 * A Select whose panel is a Tree. Single selection closes the panel; multiple
 * or checkable selection stays open and shows the first picks as tags.
 */
const NO_ITEMS: readonly TreeItem[] = []

export function LumiTreeSelect(props: TreeSelectProps & HostProps): ReactElement {
  const { t } = useUiText()
  const {
    items: inputItems,
    value,
    defaultValue,
    onChange,
    onLoadChildren,
    onSearch,
    selectedNodes: inputSelected,
    multiple: multipleProp = false,
    checkable = false,
    checkStrategy = 'all',
    searchable = false,
    clearable = false,
    loading = false,
    showPath = false,
    separator = ' / ',
    defaultExpandAll,
    placeholder = t('lumi.select.placeholder', 'Select…'),
    size = 'md',
    appearance = 'outline',
    name,
    disabled,
    readonly,
    invalid,
    ariaLabel,
    className,
    id,
    ...rest
  } = props
  // Bound lists are `null` while their data loads.
  const items = inputItems ?? NO_ITEMS
  const selectedNodes = inputSelected ?? NO_ITEMS
  const multiple = multipleProp || checkable
  const listName = ariaLabel ?? rest['aria-label'] ?? t('lumi.select.options', 'Options')
  const [current, setCurrent] = useControllableValue<TreeValue>(value, defaultValue ?? (multiple ? [] : null), onChange)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<OptionValue[]>(() => defaultExpandAll ? [...indexTree(items).values()].filter(entry => entry.node.children?.length).map(entry => entry.node.value) : [])
  const popupId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const remembered = useRef(new Map<string, string>())
  const unavailable = Boolean(disabled || readonly)
  const index = useMemo(() => indexTree(items), [items])
  const known = useMemo(() => indexTree(selectedNodes), [selectedNodes])
  const values = toValueArray(current)
  const labels = values.map((item) => {
    const key = optionKey(item)
    const entry = index.get(key) ?? known.get(key)
    if (!entry)
      return remembered.current.get(key) ?? String(item)
    return showPath ? entry.path.map(node => node.label).join(separator) : entry.node.label
  })
  const canClear = clearable && values.length > 0

  useEffect(() => {
    remembered.current = new Map(values.map((item, at) => [optionKey(item), labels[at]!]))
  })

  const changeQuery = (next: string): void => {
    setQuery(next)
    onSearch?.(next)
  }
  const changeOpen = (next: boolean): void => {
    if (next && unavailable)
      return
    setOpen(next)
    if (next) {
      // Open on the chosen nodes: their ancestors expand once per opening.
      const ancestors = values.flatMap(item => index.get(optionKey(item))?.path.slice(0, -1).map(node => node.value) ?? [])
      setExpanded(current => [...new Set([...current, ...ancestors])])
    }
    else if (query) {
      changeQuery('')
    }
  }
  const focusTree = (): void => {
    panel.current?.querySelector<HTMLElement>('[role=treeitem][tabindex="0"]')?.focus()
  }

  return (
    <div className={cn('lumi-select-control relative w-full min-w-0', className)} data-slot="tree-select" data-clearable={canClear || undefined}>
      {name && <input type="hidden" name={name} value={multiple ? JSON.stringify(values) : String(values[0] ?? '')} disabled={disabled} />}
      <Popover open={open && !unavailable} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn('lumi-select-trigger w-full min-w-0 justify-between text-start font-normal', FIELD_TRIGGER_CLASS)}
            role="combobox"
            aria-label={ariaLabel ?? rest['aria-label']}
            aria-haspopup="tree"
            aria-controls={open ? popupId : undefined}
            aria-expanded={open && !unavailable}
            aria-invalid={invalid}
            aria-readonly={readonly || undefined}
            aria-describedby={rest['aria-describedby']}
            disabled={unavailable}
            data-slot="select-trigger"
            data-lumi-control-size={size}
            data-appearance={appearance}
            data-placeholder={values.length === 0 || undefined}
            data-testid={rest['data-testid']}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                changeOpen(true)
              }
            }}
          >
            <span className="lumi-select-value flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap" title={labels.join(', ')}>
              {values.length === 0
                ? (loading ? t('lumi.select.loading', 'Loading…') : placeholder)
                : multiple
                  ? (
                      <>
                        {labels.slice(0, MAX_TAGS).map((label, at) => <span className="lumi-select-chip min-w-0 truncate text-xs" key={optionKey(values[at]!)}>{label}</span>)}
                        {labels.length > MAX_TAGS && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            +
                            {labels.length - MAX_TAGS}
                          </span>
                        )}
                      </>
                    )
                  : <span className="truncate">{labels[0]}</span>}
            </span>
            {loading ? <Spinner /> : <ChevronDownIcon className="text-muted-foreground" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id={popupId}
          ref={panel}
          className="lumi-select-popover lumi-tree-select__popover gap-0 overflow-hidden p-0"
          aria-label={t('lumi.select.choices', '{name} choices', { name: listName })}
          align="start"
          collisionPadding={8}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (search.current)
              search.current.focus()
            else
              requestAnimationFrame(focusTree)
          }}
        >
          {searchable && (
            <div className="lumi-select-search flex shrink-0 items-center">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                ref={search}
                className="min-w-0 shadow-none"
                value={query}
                aria-label={t('lumi.select.searchOf', '{name} search', { name: listName })}
                placeholder={t('lumi.select.search', 'Search…')}
                onChange={event => changeQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    focusTree()
                  }
                }}
              />
            </div>
          )}
          <div className="lumi-tree-select__body">
            <LumiTree
              items={items}
              value={multiple ? values : (values[0] ?? null)}
              selectionMode={checkable ? 'none' : multiple ? 'multiple' : 'single'}
              checkable={checkable}
              checkStrategy={checkStrategy}
              query={query}
              loading={loading && items.length === 0}
              expandedValue={expanded}
              onExpandedChange={setExpanded}
              onLoadChildren={onLoadChildren}
              ariaLabel={listName}
              onChange={(next) => {
                setCurrent(next)
                if (!multiple)
                  changeOpen(false)
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      {canClear && !unavailable && <Button type="button" variant="ghost" size="icon-xs" className="lumi-select-clear" aria-label={t('lumi.select.clear', 'Clear selection')} onClick={() => setCurrent(multiple ? [] : null)}><XIcon /></Button>}
    </div>
  )
}
