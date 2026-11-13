import type { KeyboardEvent, ReactElement } from 'react'
import type { CascaderOption, CascaderPanelProps, OptionValue } from '../catalog/types-public.js'
import { useMemo, useState } from 'react'
import { CheckIcon, ChevronRightIcon } from '../icons.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { cascaderPathOptions } from './cascader.js'
import { OPTION_CLASS, optionKey, useControllableValue } from './control.js'
import { useUiText } from './text.js'
import { checkedLeafKeys, checkedValues, indexTree, toggleChecked, treeCheckStates, treeHasChildren, treeNeedsLoad } from './tree-utils.js'
import { TreeCheckMark } from './tree.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'aria-describedby'?: string, 'id'?: string }

type Path = readonly OptionValue[]

function isPathList(value: unknown): value is OptionValue[][] {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0])
}

const NO_OPTIONS: readonly CascaderOption[] = []

/**
 * The Cascader columns shown in place. One path is chosen by default;
 * `multiple` checks leaves across branches, with tri-state parents.
 */
export function LumiCascaderPanel(props: CascaderPanelProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { options: inputOptions, value, defaultValue, onChange, onLoadChildren, multiple = false, changeOnSelect = false, loading = false, name, disabled, readonly, invalid, ariaLabel, className, id, ...rest } = props
  // Bound lists are `null` while their data loads.
  const options = inputOptions ?? NO_OPTIONS
  const lazy = Boolean(onLoadChildren)
  const listName = ariaLabel ?? rest['aria-label'] ?? t('lumi.select.options', 'Options')
  const [current, setCurrent] = useControllableValue<OptionValue[] | OptionValue[][] | null>(value as OptionValue[] | OptionValue[][] | undefined, (defaultValue as OptionValue[] | OptionValue[][] | undefined) ?? [], onChange)
  const paths: Path[] = multiple ? (isPathList(current) ? current : []) : (current && !isPathList(current) && current.length ? [current] : [])
  const [active, setActive] = useState<OptionValue[]>(() => [...(paths[0] ?? [])])
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const unavailable = Boolean(disabled || readonly)
  const trail = cascaderPathOptions(options, active)
  const index = useMemo(() => indexTree(options), [options])
  const leaves = useMemo(() => multiple ? checkedLeafKeys(options, paths.map(path => path.at(-1)!)) : new Set<string>(), [multiple, options, JSON.stringify(paths)])
  const checks = useMemo(() => multiple ? treeCheckStates(options, leaves) : new Map(), [multiple, options, leaves])
  const chosen = multiple ? [] : cascaderPathOptions(options, paths[0] ?? [])

  const columns: { nodes: readonly CascaderOption[], loading: boolean }[] = [{ nodes: options, loading: loading && options.length === 0 }]
  for (const node of trail) {
    if (node.children?.length)
      columns.push({ nodes: node.children, loading: false })
    else if (pending.has(optionKey(node.value)) || treeNeedsLoad(node, lazy))
      columns.push({ nodes: [], loading: true })
  }

  const load = (node: CascaderOption): void => {
    const key = optionKey(node.value)
    if (!treeNeedsLoad(node, lazy) || pending.has(key))
      return
    const result = onLoadChildren?.(node)
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
  const open = (node: CascaderOption, level: number): CascaderOption[] => {
    const path = [...trail.slice(0, level), node]
    setActive(path.map(item => item.value))
    load(node)
    return path
  }
  const toggle = (node: CascaderOption): void => {
    const next = toggleChecked(node, leaves, checks)
    const values = checkedValues(options, next, 'leaf', paths.map(path => path.at(-1)!))
    setCurrent(values.map(item => index.get(optionKey(item))?.path.map(step => step.value) ?? [...(paths.find(path => optionKey(path.at(-1)!) === optionKey(item)) ?? [item])]))
  }
  const pick = (node: CascaderOption, level: number): void => {
    if (unavailable || node.disabled)
      return
    const path = open(node, level)
    if (multiple)
      return toggle(node)
    if (!treeHasChildren(node, lazy) || changeOnSelect)
      setCurrent(path.map(item => item.value))
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, node: CascaderOption, level: number): void => {
    const column = event.currentTarget.closest('[role=listbox]')
    const items = [...column?.querySelectorAll<HTMLElement>('[role=option]:not([aria-disabled=true])') ?? []]
    const at = items.indexOf(event.currentTarget)
    const strip = column?.parentElement
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? items[0] : items.at(-1))?.focus()
    }
    else if (event.key === 'ArrowRight' && treeHasChildren(node, lazy)) {
      event.preventDefault()
      open(node, level)
      requestAnimationFrame(() => strip?.children[level + 1]?.querySelector<HTMLElement>('[role=option]')?.focus())
    }
    else if (event.key === 'ArrowLeft' && level > 0) {
      event.preventDefault()
      strip?.children[level - 1]?.querySelector<HTMLElement>('[aria-current=true], [role=option]')?.focus()
    }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(node, level)
    }
  }

  return (
    <div
      id={id}
      className={cn('lumi-cascader-panel', className)}
      data-slot="cascader-panel"
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      data-testid={rest['data-testid']}
      aria-describedby={rest['aria-describedby']}
    >
      {name && <input type="hidden" name={name} value={JSON.stringify(multiple ? paths : (paths[0] ?? []))} disabled={disabled} />}
      <div className="flex divide-x divide-border overflow-x-auto" data-slot="cascader-columns">
        {columns.map((column, level) => (
          <div
            key={level}
            role="listbox"
            aria-label={t('lumi.cascader.level', '{name} level {level}', { name: listName, level: level + 1 })}
            aria-multiselectable={multiple || undefined}
            aria-busy={column.loading || undefined}
            className="flex max-h-72 w-(--lumi-menu-min-width) shrink-0 flex-col gap-0.5 overflow-y-auto p-(--lumi-menu-padding)"
          >
            {column.loading && (
              <p className="flex h-control-md items-center gap-2 px-inset-sm text-control text-muted-foreground" role="status">
                <Spinner aria-hidden role="presentation" />
                {t('lumi.select.loading', 'Loading…')}
              </p>
            )}
            {column.nodes.map((node, position) => {
              const key = optionKey(node.value)
              const onPath = trail[level]?.value === node.value
              const isChosen = chosen.length === level + 1 && chosen[level]?.value === node.value
              const state = checks.get(key) ?? leaves.has(key)
              const expandable = treeHasChildren(node, lazy)
              return (
                <div
                  key={key}
                  role="option"
                  tabIndex={onPath || (!trail[level] && position === 0) ? 0 : -1}
                  aria-selected={multiple ? state === true : isChosen}
                  aria-checked={multiple ? state : undefined}
                  aria-current={onPath || undefined}
                  aria-disabled={node.disabled || unavailable || undefined}
                  className={cn(
                    OPTION_CLASS,
                    'cursor-default aria-disabled:pointer-events-none aria-disabled:opacity-40',
                    multiple && 'aria-selected:bg-transparent aria-selected:text-current aria-selected:hover:bg-hover',
                    onPath && !isChosen && 'bg-hover text-hover-foreground',
                  )}
                  onMouseEnter={() => !multiple && expandable && !unavailable && open(node, level)}
                  onKeyDown={event => onKeyDown(event, node, level)}
                  onClick={() => pick(node, level)}
                >
                  {multiple && <TreeCheckMark state={state} disabled={node.disabled || unavailable} />}
                  <span className="min-w-0 flex-1 truncate">{node.label}</span>
                  {pending.has(key)
                    ? <Spinner aria-hidden role="presentation" className="size-4 shrink-0 opacity-60" />
                    : expandable
                      ? <ChevronRightIcon className="size-4 shrink-0 opacity-60" aria-hidden />
                      : isChosen && <CheckIcon className="size-4 shrink-0" aria-hidden />}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
