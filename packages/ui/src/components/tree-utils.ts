import type { CascaderOption, OptionValue, TreeCheckStrategy } from '../catalog/types-public.js'
import { optionKey } from './control.js'

export type TreeItem = CascaderOption

/** A node has children to show or, unless marked a leaf, children the host can still load. */
export function treeHasChildren(node: TreeItem, lazy: boolean): boolean {
  return node.children ? node.children.length > 0 : lazy && node.isLeaf !== true
}

export function treeNeedsLoad(node: TreeItem, lazy: boolean): boolean {
  return lazy && node.children === undefined && node.isLeaf !== true
}

/** Every node by key, with its parent key and ancestor path. */
export interface TreeIndexEntry { node: TreeItem, parent?: string, path: TreeItem[] }

export function indexTree(items: readonly TreeItem[]): Map<string, TreeIndexEntry> {
  const index = new Map<string, TreeIndexEntry>()
  const walk = (nodes: readonly TreeItem[], parent: TreeItem[]): void => {
    for (const node of nodes) {
      const path = [...parent, node]
      index.set(optionKey(node.value), { node, parent: parent.length ? optionKey(parent.at(-1)!.value) : undefined, path })
      if (node.children)
        walk(node.children, path)
    }
  }
  walk(items, [])
  return index
}

export function treeLeaves(node: TreeItem): TreeItem[] {
  return node.children?.length ? node.children.flatMap(treeLeaves) : [node]
}

function descendants(node: TreeItem): TreeItem[] {
  return node.children?.flatMap(child => [child, ...descendants(child)]) ?? []
}

/** The node and every loaded node below it, in document order. */
export function treeSubtree(node: TreeItem): TreeItem[] {
  return [node, ...descendants(node)]
}

export type CheckState = boolean | 'mixed'

/**
 * Check state lives on the leaves: a checked parent stands for all of its
 * leaves, and a parent is checked when every leaf below it is. A node whose
 * children are not loaded yet is its own leaf until they arrive.
 */
export function checkedLeafKeys(items: readonly TreeItem[], values: readonly OptionValue[]): Set<string> {
  const index = indexTree(items)
  const leaves = new Set<string>()
  for (const value of values) {
    const entry = index.get(optionKey(value))
    if (!entry) {
      leaves.add(optionKey(value))
      continue
    }
    for (const leaf of treeLeaves(entry.node))
      leaves.add(optionKey(leaf.value))
  }
  return leaves
}

export function treeCheckStates(items: readonly TreeItem[], leaves: ReadonlySet<string>): Map<string, CheckState> {
  const states = new Map<string, CheckState>()
  const visit = (node: TreeItem): CheckState => {
    let state: CheckState
    if (!node.children?.length) {
      state = leaves.has(optionKey(node.value))
    }
    else {
      const children = node.children.map(visit)
      state = children.every(child => child === true) ? true : children.some(child => child !== false) ? 'mixed' : false
    }
    states.set(optionKey(node.value), state)
    return state
  }
  items.forEach(visit)
  return states
}

/** Toggles a node: checks every enabled leaf below it, or clears them when it is already checked. */
export function toggleChecked(node: TreeItem, leaves: ReadonlySet<string>, states: ReadonlyMap<string, CheckState>): Set<string> {
  const next = new Set(leaves)
  const on = states.get(optionKey(node.value)) !== true
  for (const leaf of treeLeaves(node)) {
    if (leaf.disabled && leaf !== node)
      continue
    if (on)
      next.add(optionKey(leaf.value))
    else
      next.delete(optionKey(leaf.value))
  }
  return next
}

/** Reports the checked set as values, per strategy, in document order. Keys unknown to the tree are kept. */
export function checkedValues(items: readonly TreeItem[], leaves: ReadonlySet<string>, strategy: TreeCheckStrategy, previous: readonly OptionValue[] = []): OptionValue[] {
  const states = treeCheckStates(items, leaves)
  const out: OptionValue[] = []
  const seen = new Set<string>()
  const visit = (node: TreeItem, parentChecked: boolean): void => {
    const state = states.get(optionKey(node.value))
    const leaf = !node.children?.length
    seen.add(optionKey(node.value))
    if (state === true && (strategy === 'all' || (strategy === 'leaf' && leaf) || (strategy === 'parent' && !parentChecked)))
      out.push(node.value)
    node.children?.forEach(child => visit(child, state === true))
  }
  items.forEach(node => visit(node, false))
  for (const value of previous) {
    if (!seen.has(optionKey(value)) && leaves.has(optionKey(value)))
      out.push(value)
  }
  return out
}

/**
 * One connector per indent column of a row, left to right: `line` passes an
 * ancestor's line through, `tee` and `end` branch to this row (`end` for the
 * last child, where the line stops). Root rows have none.
 * `continues[i]` tells whether the row's ancestor at depth `i` has siblings below it.
 */
export type TreeGuide = 'none' | 'line' | 'tee' | 'end'

export function treeGuides(continues: readonly boolean[], last: boolean): TreeGuide[] {
  if (continues.length === 0)
    return []
  return [...continues.slice(1).map((more): TreeGuide => more ? 'line' : 'none'), last ? 'end' : 'tee']
}

/** Label match for a search query, case-insensitive. */
export function treeMatches(node: TreeItem, needle: string): boolean {
  return needle !== '' && node.label.toLocaleLowerCase().includes(needle)
}

/**
 * Keeps the nodes that match and the ancestors leading to them, and returns
 * the keys of those ancestors so the tree can open them.
 */
export function filterTree(items: readonly TreeItem[], needle: string): { items: TreeItem[], open: Set<string> } {
  const open = new Set<string>()
  const walk = (nodes: readonly TreeItem[]): TreeItem[] => nodes.flatMap((node) => {
    const children = node.children ? walk(node.children) : []
    if (children.length) {
      open.add(optionKey(node.value))
      return [{ ...node, children }]
    }
    return treeMatches(node, needle) ? [node] : []
  })
  return { items: walk(items), open }
}

/** Splits a label around a search match for highlighting. */
export function splitMatch(label: string, needle: string): [string, string, string] | undefined {
  if (!needle)
    return undefined
  const at = label.toLocaleLowerCase().indexOf(needle)
  return at < 0 ? undefined : [label.slice(0, at), label.slice(at, at + needle.length), label.slice(at + needle.length)]
}

export function toValueArray(value: OptionValue | readonly OptionValue[] | null | undefined): OptionValue[] {
  if (value === null || value === undefined)
    return []
  return Array.isArray(value) ? [...value] : [value as OptionValue]
}
