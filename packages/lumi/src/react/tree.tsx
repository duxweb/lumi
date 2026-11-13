import type { ValidationCheck } from '@json-render/core'
import type { BaseComponentProps } from '@json-render/react'
import type { ComponentType, ReactElement } from 'react'
import type { TreeSource } from '../catalog/tree.js'
import type { Filter, GetListResult, ID } from '../core/index.js'
import { useBoundProp, useFieldValidation } from '@json-render/react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { treeSourceSchema } from '../catalog/tree.js'
import { executeRequest, listQueryKey, resolveDataTarget } from '../core/index.js'
import { useLumi } from './context.js'
import { useScopedTarget } from './data-scope.js'
import { useList, useMany } from './data.js'

export type { TreeSource } from '../catalog/tree.js'

/** A node in the shape Lumi UI's Tree, TreeSelect and Cascader take. */
export interface TreeSourceNode {
  label: string
  value: ID
  isLeaf?: boolean
  children?: TreeSourceNode[]
}

export interface TreeSourceState {
  /** The nodes loaded so far, as a tree. */
  items: TreeSourceNode[]
  /** The first level (or the whole resource) is loading. */
  loading: boolean
  /** Loads one node's children; only present for a `lazy` source. */
  loadChildren?: (node: { value: unknown }) => Promise<void>
  /** Server search; only present for a `lazy` source with a `searchField`. */
  search?: (query: string) => void
  /** A server search is under way. */
  searching: boolean
  /** The chosen nodes, also when their branch has not been loaded yet. */
  selectedNodes: TreeSourceNode[]
}

type Row = Record<string, unknown>

const DEFAULT_PAGE_SIZE = 1000
const SEARCH_DELAY = 300

function keyOf(value: unknown): string {
  return `${typeof value}:${String(value)}`
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

/** Every ID in a scalar, list, or list of paths value. */
function valueIds(value: unknown): ID[] {
  if (Array.isArray(value))
    return value.flatMap(valueIds)
  return typeof value === 'string' || typeof value === 'number' ? [value] : []
}

function rowLabel(row: Row, field: string | undefined, id: unknown): string {
  const label = field ? row[field] : row.label ?? row.name ?? row.title
  return isPresent(label) ? String(label) : String(id)
}

/**
 * Remote nodes for a hierarchical control. A full source reads the whole
 * resource once; a lazy one reads the root level, then each level as its
 * parent opens. Chosen values are echoed: their rows are read by ID and the
 * branches leading to them are loaded, so labels and paths resolve.
 */
export function useTreeSource(input: TreeSource, options: { value?: unknown } = {}): TreeSourceState {
  const source = useScopedTarget(input)
  const lumi = useLumi()
  const queryClient = useQueryClient()
  const valueField = source.valueField ?? 'id'
  const parentField = source.parentField ?? 'parentId'
  const lazy = source.lazy === true
  const pageSize = source.pageSize ?? DEFAULT_PAGE_SIZE
  const target = { resource: source.resource, dataProviderName: source.dataProviderName, meta: source.meta }

  const toNode = useCallback((row: Row): TreeSourceNode => {
    const id = row[valueField] as ID
    const node: TreeSourceNode = { label: rowLabel(row, source.labelField, id), value: id }
    if (source.leafField && row[source.leafField] !== undefined)
      node.isLeaf = Boolean(row[source.leafField])
    return node
  }, [source.labelField, source.leafField, valueField])

  const levelQuery = useCallback((parent: ID | null) => {
    const filters: Filter[] = [
      ...(source.filters as Filter[] | undefined ?? []),
      parent === null
        ? (source.rootValue !== undefined ? { field: parentField, operator: 'eq', value: source.rootValue } : { field: parentField, operator: 'null', value: true })
        : { field: parentField, operator: 'eq', value: parent },
    ]
    const params = { pagination: { page: 1, pageSize }, filters, meta: source.meta }
    return {
      queryKey: listQueryKey(source.resource, params, source.dataProviderName),
      retry: false as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        const resolved = resolveDataTarget(lumi, { resource: source.resource, dataProviderName: source.dataProviderName })
        return executeRequest(lumi, () => resolved.dataProvider.getList<Row>({ resource: resolved.resource, ...params, signal }), queryClient)
      },
    }
  }, [lumi, queryClient, parentField, pageSize, source.dataProviderName, source.filters, source.meta, source.resource, source.rootValue])

  // Full: one list of every row.
  const full = useList<Row>({ ...target, filters: source.filters as Filter[] | undefined, pagination: { page: 1, pageSize }, enabled: !lazy })

  // Lazy: the root level plus every requested parent's level.
  const [requested, setRequested] = useState<ID[]>([])
  const levels = useQueries({
    queries: lazy ? [null, ...requested].map(parent => levelQuery(parent)) : [],
  }) as { data?: GetListResult<Row>, isLoading: boolean, dataUpdatedAt: number }[]

  const [query, setQuery] = useState('')
  const [needle, setNeedle] = useState('')
  useEffect(() => {
    const timer = setTimeout(setNeedle, SEARCH_DELAY, query.trim())
    return () => clearTimeout(timer)
  }, [query])
  const searchable = lazy && Boolean(source.searchField)
  const hits = useList<Row>({
    ...target,
    filters: [...(source.filters as Filter[] | undefined ?? []), { field: source.searchField ?? '', operator: 'like', value: needle }],
    pagination: { page: 1, pageSize: 50 },
    enabled: searchable && needle !== '',
  })

  const chosenIds = valueIds(options.value)
  const [extraIds, setExtraIds] = useState<ID[]>([])
  const knownRows = new Map<string, Row>()
  const remember = (rows: readonly Row[] | undefined): void => rows?.forEach(row => knownRows.set(keyOf(row[valueField]), row))
  if (lazy) {
    levels.forEach(level => remember(level.data?.data))
    remember(searchable && needle ? hits.data?.data : undefined)
  }
  else {
    remember(full.data?.data)
  }
  const missing = [...new Set([...chosenIds, ...extraIds])].filter(id => !knownRows.has(keyOf(id)))
  const missingKey = missing.map(keyOf).sort().join('|')
  const many = useMany<Row>({ ...target, ids: missing, enabled: missing.length > 0 && (lazy || full.isSuccess) })
  const echoed = new Map<string, Row>()
  many.data?.data.forEach(row => echoed.set(keyOf(row[valueField]), row))
  for (const [key, row] of echoed) {
    if (!knownRows.has(key))
      knownRows.set(key, row)
  }

  // Walk from each chosen node and search hit up to its root: every parent
  // on the way has its level requested, and unknown parents are read by ID.
  const revealIds = [...chosenIds, ...(searchable && needle ? (hits.data?.data ?? []).map(row => row[valueField] as ID) : [])]
  const revealKey = `${revealIds.map(keyOf).join('|')}#${[...knownRows.keys()].sort().join('|')}#${missingKey}`
  useEffect(() => {
    if (!lazy)
      return
    const parents = new Set(requested.map(keyOf))
    const addParents: ID[] = []
    const addIds: ID[] = []
    for (const id of revealIds) {
      let row = knownRows.get(keyOf(id))
      const seen = new Set<string>()
      while (row && isPresent(row[parentField]) && row[parentField] !== source.rootValue) {
        const parent = row[parentField] as ID
        const key = keyOf(parent)
        if (seen.has(key))
          break
        seen.add(key)
        if (!parents.has(key)) {
          parents.add(key)
          addParents.push(parent)
        }
        row = knownRows.get(key)
        if (!row && !extraIds.some(item => keyOf(item) === key))
          addIds.push(parent)
      }
    }
    if (addParents.length)
      setRequested(current => [...current, ...addParents])
    if (addIds.length)
      setExtraIds(current => [...current, ...addIds])
  }, [lazy, revealKey])

  const levelData = levels.map(level => level.data?.data)
  const levelKey = levels.map(level => level.dataUpdatedAt).join(',')
  const items = useMemo((): TreeSourceNode[] => {
    if (!lazy) {
      const rows = full.data?.data ?? []
      if (source.childrenField) {
        const field = source.childrenField
        const nest = (list: readonly Row[]): TreeSourceNode[] => list.map((row) => {
          const node = toNode(row)
          const children = row[field]
          if (Array.isArray(children) && children.length)
            node.children = nest(children as Row[])
          return node
        })
        return nest(rows)
      }
      const nodes = new Map<string, TreeSourceNode>()
      rows.forEach(row => nodes.set(keyOf(row[valueField]), toNode(row)))
      const roots: TreeSourceNode[] = []
      rows.forEach((row) => {
        const node = nodes.get(keyOf(row[valueField]))!
        const parent = isPresent(row[parentField]) ? nodes.get(keyOf(row[parentField])) : undefined
        if (parent && parent !== node)
          (parent.children ??= []).push(node)
        else
          roots.push(node)
      })
      return roots
    }
    const byParent = new Map<string, readonly Row[]>()
    requested.forEach((parent, at) => {
      const rows = levelData[at + 1]
      if (rows)
        byParent.set(keyOf(parent), rows)
    })
    const build = (rows: readonly Row[], trail: Set<string>): TreeSourceNode[] => rows.map((row) => {
      const node = toNode(row)
      const key = keyOf(node.value)
      const children = byParent.get(key)
      if (children && !trail.has(key))
        node.children = build(children, new Set(trail).add(key))
      return node
    })
    return build(levelData[0] ?? [], new Set())
  }, [lazy, full.data, source.childrenField, parentField, valueField, toNode, requested, levelKey])

  const loadChildren = useCallback(async (node: { value: unknown }): Promise<void> => {
    const parent = node.value as ID
    await queryClient.fetchQuery(levelQuery(parent))
    setRequested(current => current.some(item => keyOf(item) === keyOf(parent)) ? current : [...current, parent])
  }, [levelQuery, queryClient])

  const selectedNodes = chosenIds.flatMap((id) => {
    const row = knownRows.get(keyOf(id))
    return row ? [toNode(row)] : []
  })

  return {
    items,
    loading: lazy ? Boolean(levels[0]?.isLoading) : full.isLoading,
    loadChildren: lazy ? loadChildren : undefined,
    search: searchable ? setQuery : undefined,
    searching: searchable && (query.trim() !== needle || hits.isFetching),
    selectedNodes,
  }
}

export interface ConnectTreeConfig {
  /** The host prop that takes the nodes: `items` (Tree, TreeSelect) or `options` (Cascader, CascaderPanel). */
  itemsProp?: 'items' | 'options'
  /** Also binds `expandedValue`, emitting `expandedChange` (Tree). */
  expanded?: boolean
}

interface BoundTree {
  rest: Record<string, unknown>
  value: unknown
  hostProps: Record<string, unknown>
}

function useBoundTree({ props, bindings, emit }: BaseComponentProps, config: ConnectTreeConfig): BoundTree {
  const { checks, source: _source, ...rest } = props as Record<string, unknown> & { checks?: ValidationCheck[], source?: unknown }
  const [value, setValue] = useBoundProp(props.value, bindings?.value)
  const [expanded, setExpanded] = useBoundProp(props.expandedValue, bindings?.expandedValue)
  const checkConfig = useMemo(() => (checks ? { checks } : undefined), [checks])
  const validation = useFieldValidation(bindings?.value ?? '', checkConfig)
  const controlled = bindings?.value !== undefined || props.value !== undefined
  const tracked = config.expanded && (bindings?.expandedValue !== undefined || props.expandedValue !== undefined)
  return {
    rest,
    value,
    hostProps: {
      ...rest,
      ...(controlled ? { value } : {}),
      ...(tracked ? { expandedValue: expanded ?? [] } : {}),
      ...(config.expanded
        ? {
            onExpandedChange: (next: unknown) => {
              setExpanded(next)
              emit('expandedChange')
            },
          }
        : {}),
      invalid: Boolean(props.invalid) || !validation.isValid,
      error: props.error ?? validation.errors[0],
      onChange: (next: unknown) => {
        setValue(next)
        emit('change')
      },
    },
  }
}

interface ConnectedProps {
  context: BaseComponentProps
  Component: ComponentType<any>
  config: ConnectTreeConfig
}

function StaticTree({ context, Component, config }: ConnectedProps): ReactElement {
  const { hostProps } = useBoundTree(context, config)
  return <Component {...hostProps} />
}

function RemoteTree({ context, Component, config }: ConnectedProps): ReactElement {
  const { rest, value, hostProps } = useBoundTree(context, config)
  const source = useMemo(() => treeSourceSchema.parse(context.props.source), [context.props.source])
  const tree = useTreeSource(source, { value })
  const itemsProp = config.itemsProp ?? 'items'
  return (
    <Component
      {...hostProps}
      {...{ [itemsProp]: tree.items }}
      selectedNodes={itemsProp === 'items' ? tree.selectedNodes : undefined}
      loading={Boolean(rest.loading) || tree.loading}
      onLoadChildren={tree.loadChildren}
      onSearch={tree.search}
    />
  )
}

/**
 * Compose a native registry entry for a hierarchical control whose nodes may
 * come from a `source` resource. Without `source` the control keeps its
 * static nodes and needs no Lumi data services.
 */
export function connectTree(Component: ComponentType<any>, config: ConnectTreeConfig = {}) {
  return function ConnectedTree(context: BaseComponentProps): ReactElement {
    return context.props.source
      ? <RemoteTree context={context} Component={Component} config={config} />
      : <StaticTree context={context} Component={Component} config={config} />
  }
}
