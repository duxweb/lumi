import type { KeyboardEvent, ReactElement } from 'react'
import type { Option, OptionValue, TransferProps } from '../catalog/types-public.js'
import { useId, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SearchRemoveIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Checkbox } from '../internal/shadcn/checkbox.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { optionKey, useControllableValue } from './control.js'
import { LumiEmpty } from './empty.js'
import { useLoadMore } from './load-more.js'
import { OptionContent } from './option-content.js'
import { PanelSearch } from './panel-search.js'
import { useUiText } from './text.js'
import { TreeCheckMark } from './tree.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

const NO_OPTIONS: readonly Option[] = []
const NO_VALUES: readonly OptionValue[] = []

function filterLocal(items: Option[], query: string): Option[] {
  const needle = query.trim().toLocaleLowerCase()
  return needle ? items.filter(item => `${item.label} ${item.description ?? ''}`.toLocaleLowerCase().includes(needle)) : items
}

interface TransferListProps {
  side: 'source' | 'target'
  title: string
  items: Option[]
  /** Size of the whole list when only part of it is loaded. */
  count: number
  checked: ReadonlySet<string>
  onCheckedChange: (next: Set<string>) => void
  query: string
  onQuery: (query: string) => void
  filterable: boolean
  locked: boolean
  loading?: boolean | undefined
  loadingMore?: boolean | undefined
  hasMore?: boolean | undefined
  onLoadMore?: (() => void) | undefined
  emptyText: string
}

function TransferList({ side, title, items, count, checked, onCheckedChange, query, onQuery, filterable, locked, loading, loadingMore, hasMore, onLoadMore, emptyText }: TransferListProps): ReactElement {
  const { t } = useUiText()
  const titleId = useId()
  const list = useRef<HTMLDivElement>(null)
  const [activeKey, setActiveKey] = useState<string>()
  const selectable = items.filter(item => !item.disabled)
  const checkedHere = selectable.filter(item => checked.has(optionKey(item.value)))
  const all = selectable.length > 0 && checkedHere.length === selectable.length
  const active = selectable.find(item => optionKey(item.value) === activeKey) ?? selectable[0]
  const listId = `${titleId}-list`
  const activeId = active ? `${titleId}-${items.indexOf(active)}` : undefined
  const { ref: listRef, onScroll, request } = useLoadMore(list, { length: items.length, resetKey: query, hasMore, busy: loading || loadingMore, onLoadMore })
  const toggle = (item: Option): void => {
    if (item.disabled || locked)
      return
    const next = new Set(checked)
    const key = optionKey(item.value)
    if (next.has(key))
      next.delete(key)
    else
      next.add(key)
    onCheckedChange(next)
  }
  const navigate = (event: KeyboardEvent<HTMLElement>): void => {
    const index = active ? selectable.indexOf(active) : -1
    let next: Option | undefined
    if (event.key === 'ArrowDown') {
      next = selectable[Math.min(selectable.length - 1, index + 1)]
      if (index >= selectable.length - 2)
        request()
    }
    else if (event.key === 'ArrowUp') {
      next = selectable[Math.max(0, index - 1)]
    }
    else if (event.key === 'Home') {
      next = selectable[0]
    }
    else if (event.key === 'End') {
      next = selectable.at(-1)
    }
    else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (active)
        toggle(active)
      return
    }
    else if (event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      onCheckedChange(all ? new Set() : new Set(selectable.map(item => optionKey(item.value))))
      return
    }
    else {
      return
    }
    event.preventDefault()
    if (next) {
      setActiveKey(optionKey(next.value))
      document.getElementById(`${titleId}-${items.indexOf(next)}`)?.scrollIntoView({ block: 'nearest' })
    }
  }
  return (
    <section className="lumi-transfer-panel flex min-w-0 flex-1 flex-col" data-slot="transfer-list" data-side={side} aria-labelledby={titleId}>
      <header className="lumi-transfer-header flex items-center gap-2.5">
        <Checkbox
          checked={all ? true : checkedHere.length ? 'indeterminate' : false}
          disabled={locked || selectable.length === 0}
          aria-label={t('lumi.transfer.checkAll', 'Check all in {name}', { name: title })}
          onCheckedChange={() => onCheckedChange(all ? new Set() : new Set(selectable.map(item => optionKey(item.value))))}
        />
        <span id={titleId} className="min-w-0 flex-1 truncate">{title}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums" data-slot="transfer-count" aria-live="polite">
          {checkedHere.length
            ? t('lumi.transfer.checkedCount', '{checked}/{count}', { checked: checkedHere.length, count })
            : t('lumi.transfer.count', '{count} items', { count })}
        </span>
      </header>
      {filterable && (
        <PanelSearch
          variant="inset"
          value={query}
          onValueChange={onQuery}
          disabled={locked}
          aria-label={t('lumi.transfer.searchOf', 'Search {name}', { name: title })}
          aria-controls={listId}
          aria-activedescendant={activeId}
          onKeyDown={(event) => {
            if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key))
              navigate(event)
          }}
        />
      )}
      {/* The listbox holds only options; the load-more and empty states are its siblings in the scroller. */}
      <div ref={listRef} className="lumi-transfer-options min-h-0 flex-1 overflow-y-auto overscroll-contain" onScroll={onScroll}>
        <div
          id={listId}
          className="lumi-transfer-listbox"
          role="listbox"
          aria-labelledby={titleId}
          aria-multiselectable
          aria-busy={loading || loadingMore || undefined}
          aria-activedescendant={activeId}
          aria-disabled={locked || undefined}
          tabIndex={items.length ? 0 : -1}
          onKeyDown={navigate}
        >
          {items.map((item, index) => {
            const isChecked = checked.has(optionKey(item.value))
            return (
              <div
                key={optionKey(item.value)}
                id={`${titleId}-${index}`}
                role="option"
                aria-selected={isChecked}
                aria-disabled={item.disabled || locked || undefined}
                className="lumi-transfer-option flex cursor-default items-center gap-2.5"
                data-active={item === active || undefined}
                onPointerDown={event => event.preventDefault()}
                onClick={() => {
                  setActiveKey(optionKey(item.value))
                  toggle(item)
                }}
              >
                <TreeCheckMark state={isChecked} />
                <OptionContent option={item} query={query} />
              </div>
            )
          })}
        </div>
        {(loadingMore || (hasMore && items.length > 0)) && (
          <div className="lumi-select-more flex items-center justify-center text-muted-foreground" role="status">
            <Spinner />
            {t('lumi.select.loadingMore', 'Loading more…')}
          </div>
        )}
        {items.length === 0 && (loading
          ? (
              <p className="lumi-select-empty m-0 flex h-full items-center justify-center text-muted-foreground" role="status">
                <Spinner />
                {t('lumi.select.loading', 'Loading…')}
              </p>
            )
          : (
              <LumiEmpty
                size="xs"
                role="status"
                className="h-full"
                icon={query.trim() ? <SearchRemoveIcon /> : undefined}
                title={query.trim() ? t('lumi.select.noMatch', 'No results for “{query}”', { query: query.trim() }) : emptyText}
              />
            ))}
      </div>
    </section>
  )
}

export function LumiTransfer(props: TransferProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue, onChange, onSearch, onLoadMore, options: input, selectedOptions, sourceTitle, targetTitle, filterable = true, loading, loadingMore, hasMore, total, name, disabled, readonly, invalid, ariaLabel, className, id } = props
  const [chosen, setChosen] = useControllableValue<OptionValue[]>(value, defaultValue ?? [...NO_VALUES], next => onChange?.(next))
  const selected = chosen ?? NO_VALUES
  const options = input ?? NO_OPTIONS
  const [sourceChecked, setSourceChecked] = useState<Set<string>>(() => new Set())
  const [targetChecked, setTargetChecked] = useState<Set<string>>(() => new Set())
  const [sourceQuery, setSourceQuery] = useState('')
  const [targetQuery, setTargetQuery] = useState('')
  const locked = Boolean(disabled || readonly)
  const known = new Map<string, Option>()
  for (const option of [...selectedOptions ?? [], ...options])
    known.set(optionKey(option.value), option)
  const chosenKeys = new Set(selected.map(optionKey))
  const available = options.filter(option => !chosenKeys.has(optionKey(option.value)))
  const sourceItems = onSearch ? available : filterLocal(available, sourceQuery)
  const targetAll = selected.map(value => known.get(optionKey(value)) ?? { label: String(value), value })
  const targetItems = filterLocal(targetAll, targetQuery)
  const remoteCount = (total ?? 0) - (sourceQuery ? options.length - available.length : selected.length)
  const sourceCount = hasMore && total !== undefined ? Math.max(available.length, remoteCount) : available.length
  const toTarget = available.filter(option => sourceChecked.has(optionKey(option.value)) && !option.disabled)
  const toSource = targetAll.filter(option => targetChecked.has(optionKey(option.value)) && !option.disabled)
  const sourceName = sourceTitle ?? t('lumi.transfer.source', 'Available')
  const targetName = targetTitle ?? t('lumi.transfer.target', 'Chosen')

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel}
      aria-describedby={props['aria-describedby']}
      aria-invalid={invalid || undefined}
      className={cn('lumi-transfer @container w-full min-w-0', className)}
      data-slot="lumi-transfer"
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      data-testid={props['data-testid']}
    >
      {name && <input type="hidden" name={name} value={JSON.stringify(selected)} disabled={disabled} />}
      <div className="lumi-transfer-body">
        <TransferList
          side="source"
          title={sourceName}
          items={sourceItems}
          count={sourceCount}
          checked={sourceChecked}
          onCheckedChange={setSourceChecked}
          query={sourceQuery}
          onQuery={(next) => {
            setSourceQuery(next)
            onSearch?.(next)
          }}
          filterable={filterable}
          locked={locked}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          emptyText={t('lumi.transfer.emptySource', 'Nothing left to choose')}
        />
        <div className="lumi-transfer-actions flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={locked || toTarget.length === 0}
            aria-label={t('lumi.transfer.moveToTarget', 'Move checked to {name}', { name: targetName })}
            onClick={() => {
              setChosen([...selected, ...toTarget.map(option => option.value)])
              setSourceChecked(new Set())
            }}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={locked || toSource.length === 0}
            aria-label={t('lumi.transfer.moveToSource', 'Move checked to {name}', { name: sourceName })}
            onClick={() => {
              const removed = new Set(toSource.map(option => optionKey(option.value)))
              setChosen(selected.filter(value => !removed.has(optionKey(value))))
              setTargetChecked(new Set())
            }}
          >
            <ChevronLeftIcon />
          </Button>
        </div>
        <TransferList
          side="target"
          title={targetName}
          items={targetItems}
          count={targetAll.length}
          checked={targetChecked}
          onCheckedChange={setTargetChecked}
          query={targetQuery}
          onQuery={setTargetQuery}
          filterable={filterable}
          locked={locked}
          emptyText={t('lumi.transfer.emptyTarget', 'Nothing chosen yet')}
        />
      </div>
    </div>
  )
}
