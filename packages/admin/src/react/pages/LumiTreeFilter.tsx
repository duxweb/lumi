import type { CascaderOption, OptionValue } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { LumiTree, treeSubtree, useUiText } from '@duxweb/lumi-ui'

export interface LumiTreeFilterProps {
  items: readonly CascaderOption[]
  /** The chosen node, or `null` for every record. */
  value?: OptionValue | null
  onChange?: (value: OptionValue | null) => void
  /** The chosen node and every loaded node below it, for an `in` filter; `null` for every record. */
  onSubtreeChange?: (values: OptionValue[] | null) => void
  title?: string
  /** Label of the row that clears the filter. */
  allLabel?: string
  showAll?: boolean
  searchable?: boolean
  defaultExpandAll?: boolean
  loading?: boolean
  onLoadChildren?: (node: CascaderOption) => Promise<unknown> | void
  onSearch?: (query: string) => void
  ariaLabel?: string
  className?: string
}

function findNode(items: readonly CascaderOption[], value: OptionValue): CascaderOption | undefined {
  for (const item of items) {
    if (item.value === value)
      return item
    const found = item.children && findNode(item.children, value)
    if (found)
      return found
  }
  return undefined
}

/** A side panel that narrows a list to one branch of a tree. */
export function LumiTreeFilter({ items, value = null, onChange, onSubtreeChange, title, allLabel, showAll = true, searchable, defaultExpandAll, loading, onLoadChildren, onSearch, ariaLabel, className }: LumiTreeFilterProps): ReactElement {
  const { t } = useUiText()
  const name = ariaLabel ?? title ?? t('lumi.treeFilter.label', 'Filter tree')
  const choose = (next: OptionValue | null): void => {
    onChange?.(next)
    if (onSubtreeChange) {
      const node = next === null ? undefined : findNode(items, next)
      onSubtreeChange(next === null ? null : node ? treeSubtree(node).map(item => item.value) : [next])
    }
  }
  return (
    <nav className={['lumi-tree-filter', className].filter(Boolean).join(' ')} aria-label={name}>
      {title && <h2 className="lumi-tree-filter__title">{title}</h2>}
      {showAll && (
        <button type="button" className="lumi-tree-filter__all" aria-pressed={value === null} data-selected={value === null || undefined} onClick={() => choose(null)}>
          {allLabel ?? t('lumi.treeFilter.all', 'All')}
        </button>
      )}
      <LumiTree
        items={items}
        value={value}
        selectionMode="single"
        size="sm"
        searchable={searchable}
        defaultExpandAll={defaultExpandAll}
        loading={loading}
        onLoadChildren={onLoadChildren}
        onSearch={onSearch}
        ariaLabel={name}
        onChange={next => choose(Array.isArray(next) ? next[0] ?? null : next)}
      />
    </nav>
  )
}
