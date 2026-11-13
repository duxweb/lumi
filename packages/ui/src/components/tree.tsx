import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from 'react'
import type { OptionValue, TreeProps, TreeValue } from '../catalog/types-public.js'
import type { CheckState, TreeItem } from './tree-utils.js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronRightIcon, LumiIcon, SearchIcon, SearchRemoveIcon } from '../icons.js'
import { Input } from '../internal/shadcn/input.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { optionKey, useControllableValue } from './control.js'
import { LumiEmpty } from './empty.js'
import { useUiText } from './text.js'
import { checkedLeafKeys, checkedValues, filterTree, indexTree, splitMatch, toggleChecked, toValueArray, treeCheckStates, treeGuides, treeHasChildren, treeNeedsLoad } from './tree-utils.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'aria-describedby'?: string, 'id'?: string }

const NO_ITEMS: readonly TreeItem[] = []

interface VisibleRow { node: TreeItem, key: string, level: number, parent?: string }

/** The tick drawn inside a checkable row; the row itself carries `aria-checked`. */
export function TreeCheckMark({ state, disabled }: { state: CheckState, disabled?: boolean | undefined }): ReactElement {
  return (
    <span className="lumi-tree__check" data-state={state === 'mixed' ? 'indeterminate' : state ? 'checked' : 'unchecked'} data-disabled={disabled || undefined} aria-hidden>
      {state === true && <CheckIcon />}
      {state === 'mixed' && <i />}
    </span>
  )
}

/** A tree node's label with the searched text highlighted. */
export function TreeLabel({ label, needle }: { label: string, needle: string }): ReactNode {
  const parts = splitMatch(label, needle)
  return parts
    ? (
        <>
          {parts[0]}
          <mark className="lumi-tree__match">{parts[1]}</mark>
          {parts[2]}
        </>
      )
    : label
}

/**
 * Hierarchical list with expand/collapse, single or multiple selection, and
 * tri-state checkboxes. Nodes without `children` load through `onLoadChildren`
 * the first time they open; the host answers by updating `items`.
 */
export function LumiTree(props: TreeProps & HostProps): ReactElement {
  const { t } = useUiText()
  const {
    items: inputItems,
    value,
    defaultValue,
    onChange,
    checkable = false,
    checkStrategy = 'all',
    selectionMode = checkable ? 'none' : 'single',
    expandedValue,
    defaultExpandedValue,
    defaultExpandAll = false,
    onExpandedChange,
    onLoadChildren,
    searchable = false,
    searchPlaceholder,
    query: externalQuery,
    onSearch,
    showLine = true,
    loading = false,
    empty,
    size = 'md',
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
  const lazy = Boolean(onLoadChildren)
  const multiple = checkable || selectionMode === 'multiple'
  const [current, setCurrent] = useControllableValue<TreeValue>(value, defaultValue ?? (multiple ? [] : null), onChange)
  const initialExpanded = useMemo(() => defaultExpandedValue ?? (defaultExpandAll ? [...indexTree(items).values()].filter(entry => entry.node.children?.length).map(entry => entry.node.value) : []), [])
  const [expanded, setExpanded] = useControllableValue<readonly OptionValue[]>(expandedValue, initialExpanded, next => onExpandedChange?.([...next]))
  const latestExpanded = useRef(expanded)
  latestExpanded.current = expanded
  const [ownQuery, setOwnQuery] = useState('')
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const [focusKey, setFocusKey] = useState<string>()
  const mounted = useRef(new Set<string>())
  const typeahead = useRef({ value: '', at: 0 })
  const baseId = useId()
  const treeRef = useRef<HTMLUListElement>(null)
  const query = externalQuery ?? ownQuery
  // Nodes that arrive after mount (a remote source) still open with defaultExpandAll, once.
  const expandAllLater = useRef(defaultExpandAll && expandedValue === undefined && initialExpanded.length === 0)
  useEffect(() => {
    if (!expandAllLater.current)
      return
    const parents = [...indexTree(items).values()].filter(entry => entry.node.children?.length).map(entry => entry.node.value)
    if (parents.length) {
      expandAllLater.current = false
      setExpanded(parents)
    }
  }, [items])
  const needle = query.trim().toLocaleLowerCase()
  const unavailable = Boolean(disabled || readonly)

  const filtered = useMemo(() => needle ? filterTree(items, needle) : { items: [...items], open: new Set<string>() }, [items, needle])
  const expandedKeys = useMemo(() => new Set([...expanded.map(optionKey), ...filtered.open]), [expanded, filtered])
  const values = toValueArray(current)
  const leaves = useMemo(() => checkable ? checkedLeafKeys(items, values) : new Set<string>(), [checkable, items, values.map(optionKey).join('\u0000')])
  const checks = useMemo(() => checkable ? treeCheckStates(items, leaves) : new Map<string, CheckState>(), [checkable, items, leaves])
  const selectedKeys = new Set(values.map(optionKey))

  const rows = useMemo(() => {
    const out: VisibleRow[] = []
    const walk = (nodes: readonly TreeItem[], level: number, parent?: string): void => {
      for (const node of nodes) {
        const key = optionKey(node.value)
        out.push({ node, key, level, parent })
        if (node.children?.length && expandedKeys.has(key))
          walk(node.children, level + 1, key)
      }
    }
    walk(filtered.items, 1)
    return out
  }, [filtered, expandedKeys])
  const focusable = rows.find(row => row.key === focusKey) ?? rows.find(row => selectedKeys.has(row.key)) ?? rows[0]
  const rowId = (key: string): string => `${baseId}-${key}`

  useEffect(() => {
    if (focusKey && treeRef.current?.contains(document.activeElement))
      document.getElementById(rowId(focusKey))?.focus()
  }, [focusKey])

  const setOpen = (node: TreeItem, open: boolean): void => {
    const key = optionKey(node.value)
    const listed = expanded.some(item => optionKey(item) === key)
    if (open !== listed)
      setExpanded(open ? [...expanded, node.value] : expanded.filter(item => optionKey(item) !== key))
    if (open && treeNeedsLoad(node, lazy) && !pending.has(key)) {
      const result = onLoadChildren?.(node)
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        setPending(set => new Set(set).add(key))
        ;(result as Promise<unknown>).then(
          () => setPending(set => withoutKey(set, key)),
          () => {
            setPending(set => withoutKey(set, key))
            // What is open now, not when the load began: other nodes may have opened since.
            setExpanded(latestExpanded.current.filter(item => optionKey(item) !== key))
          },
        )
      }
    }
  }
  const activate = (node: TreeItem): void => {
    if (unavailable || node.disabled)
      return
    if (checkable) {
      const next = toggleChecked(node, leaves, checks)
      setCurrent(checkedValues(items, next, checkStrategy, values))
    }
    else if (selectionMode === 'single') {
      setCurrent(node.value)
    }
    else if (selectionMode === 'multiple') {
      const key = optionKey(node.value)
      setCurrent(selectedKeys.has(key) ? values.filter(item => optionKey(item) !== key) : [...values, node.value])
    }
    else if (treeHasChildren(node, lazy)) {
      setOpen(node, !expandedKeys.has(optionKey(node.value)))
    }
  }
  const changeQuery = (next: string): void => {
    setOwnQuery(next)
    onSearch?.(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || !focusable)
      return
    const at = rows.findIndex(row => row.key === focusable.key)
    const row = rows[at]!
    const open = expandedKeys.has(row.key)
    const expandable = treeHasChildren(row.node, lazy)
    let target: VisibleRow | undefined
    switch (event.key) {
      case 'ArrowDown': target = rows[Math.min(at + 1, rows.length - 1)]
        break
      case 'ArrowUp': target = rows[Math.max(at - 1, 0)]
        break
      case 'Home': target = rows[0]
        break
      case 'End': target = rows.at(-1)
        break
      case 'ArrowRight':
        if (expandable && !open)
          setOpen(row.node, true)
        else if (open && row.node.children?.length)
          target = rows[at + 1]
        break
      case 'ArrowLeft':
        if (expandable && open)
          setOpen(row.node, false)
        else if (row.parent)
          target = rows.find(item => item.key === row.parent)
        break
      case 'Enter':
      case ' ':
        activate(row.node)
        break
      default:
        if (event.key.length === 1 && event.key !== ' ') {
          const now = Date.now()
          typeahead.current = { value: `${now - typeahead.current.at < 700 ? typeahead.current.value : ''}${event.key.toLocaleLowerCase()}`, at: now }
          const ordered = [...rows.slice(at + 1), ...rows.slice(0, at + 1)]
          target = ordered.find(item => item.node.label.toLocaleLowerCase().startsWith(typeahead.current.value))
          if (!target)
            return
          break
        }
        return
    }
    event.preventDefault()
    if (target) {
      setFocusKey(target.key)
      document.getElementById(rowId(target.key))?.focus()
    }
  }

  const renderNodes = (nodes: readonly TreeItem[], level: number, continues: readonly boolean[]): ReactElement[] => nodes.map((node, position) => {
    const key = optionKey(node.value)
    const expandable = treeHasChildren(node, lazy)
    const open = expandable && expandedKeys.has(key)
    const last = position === nodes.length - 1
    const guides = showLine ? treeGuides(continues, last) : []
    const busy = pending.has(key) || (open && treeNeedsLoad(node, lazy))
    if (open)
      mounted.current.add(key)
    const checkState = checks.get(key) ?? (checkable && leaves.has(key))
    const selected = !checkable && selectionMode !== 'none' && selectedKeys.has(key)
    return (
      <li
        key={key}
        id={rowId(key)}
        role="treeitem"
        className="lumi-tree__item"
        style={{ '--lumi-tree-level': level - 1 } as CSSProperties}
        aria-level={level}
        aria-setsize={nodes.length}
        aria-posinset={position + 1}
        aria-expanded={expandable ? open : undefined}
        aria-selected={!checkable && selectionMode !== 'none' ? selected : undefined}
        aria-checked={checkable ? checkState : undefined}
        aria-disabled={node.disabled || undefined}
        aria-busy={busy || undefined}
        tabIndex={focusable?.key === key ? 0 : -1}
        onFocus={(event) => {
          if (event.target === event.currentTarget)
            setFocusKey(key)
        }}
      >
        <div
          className="lumi-tree__row"
          data-selected={selected || undefined}
          data-disabled={node.disabled || undefined}
          data-leaf={!expandable || undefined}
          onClick={(event) => {
            event.stopPropagation()
            setFocusKey(key)
            activate(node)
          }}
        >
          {guides.map((guide, column) => guide !== 'none' && (
            <span key={column} className="lumi-tree__guide" data-guide={guide} style={{ '--lumi-tree-column': column } as CSSProperties} aria-hidden />
          ))}
          {showLine && open && Boolean(node.children?.length) && <span className="lumi-tree__guide" data-guide="stem" style={{ '--lumi-tree-column': level - 1 } as CSSProperties} aria-hidden />}
          <span
            className="lumi-tree__toggle"
            data-expandable={expandable || undefined}
            onClick={(event) => {
              if (!expandable)
                return
              event.stopPropagation()
              setFocusKey(key)
              setOpen(node, !open)
            }}
            aria-hidden
          >
            {busy ? <Spinner aria-hidden role="presentation" /> : expandable && <ChevronRightIcon data-open={open || undefined} />}
          </span>
          {checkable && <TreeCheckMark state={checkState} disabled={node.disabled || unavailable} />}
          {node.icon && <LumiIcon name={node.icon} className="lumi-tree__icon" />}
          <span className="lumi-tree__label"><TreeLabel label={node.label} needle={needle} /></span>
        </div>
        {expandable && node.children && mounted.current.has(key) && (
          <div className="lumi-tree__group" data-state={open ? 'open' : 'closed'} inert={!open}>
            <ul role="group">{renderNodes(node.children, level + 1, [...continues, !last])}</ul>
          </div>
        )}
      </li>
    )
  })

  const listName = ariaLabel ?? rest['aria-label'] ?? t('lumi.tree.label', 'Tree')
  return (
    <div
      className={cn('lumi-tree', className)}
      data-slot="tree"
      data-size={size}
      data-show-line={showLine || undefined}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      data-testid={rest['data-testid']}
    >
      {name && <input type="hidden" name={name} value={multiple ? JSON.stringify(values) : String(values[0] ?? '')} disabled={disabled} />}
      {searchable && externalQuery === undefined && (
        <div className="lumi-tree__search">
          <SearchIcon aria-hidden />
          <Input
            className="min-w-0 shadow-none"
            value={ownQuery}
            disabled={disabled}
            placeholder={searchPlaceholder ?? t('lumi.select.search', 'Search…')}
            aria-label={t('lumi.select.searchOf', '{name} search', { name: listName })}
            onChange={event => changeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                treeRef.current?.querySelector<HTMLElement>('[role=treeitem][tabindex="0"]')?.focus()
              }
            }}
          />
        </div>
      )}
      <ul
        ref={treeRef}
        id={id}
        role="tree"
        className="lumi-tree__list"
        aria-label={listName}
        aria-describedby={rest['aria-describedby']}
        aria-multiselectable={(!checkable && selectionMode === 'multiple') || undefined}
        aria-readonly={readonly || undefined}
        aria-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        aria-busy={loading || undefined}
        onKeyDown={onKeyDown}
      >
        {!loading && renderNodes(filtered.items, 1, [])}
      </ul>
      {loading
        ? (
            <p className="lumi-tree__status" role="status">
              <Spinner aria-hidden role="presentation" />
              {t('lumi.select.loading', 'Loading…')}
            </p>
          )
        : filtered.items.length === 0 && (
          <LumiEmpty
            size="xs"
            role="status"
            icon={needle ? <SearchRemoveIcon /> : undefined}
            title={needle ? t('lumi.common.noMatches', 'No matches') : empty ?? t('lumi.common.noData', 'No data')}
          />
        )}
    </div>
  )
}

function withoutKey(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set)
  next.delete(key)
  return next
}
