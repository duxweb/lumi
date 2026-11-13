import type { ReactNode } from 'react'
import { RepeatScopeProvider } from '@json-render/react'

/**
 * Draws a table's `rowActions` slot once per row inside a native repeat scope.
 *
 * - Props read the row through `$item` and `$index`, e.g. a label, `visible` or
 *   `disabled` per row.
 * - Before a control's own `on` runs, `activate` receives the row, so the
 *   table's bound `activeRow` already holds it: action params read it with
 *   `{ "$state": "/table/row/id" }`. Native `$item` in action params is a state
 *   path, not a value, and only exists when the rows were bound with
 *   `$bindState` (`rowsPath`).
 */
export function rowActionsRenderer(
  nodes: ReactNode,
  activate: (row: Record<string, unknown>) => void,
  rowsPath?: string,
): ((row: Record<string, unknown>, index: number) => ReactNode) | undefined {
  if (nodes === undefined || nodes === null || (Array.isArray(nodes) && nodes.length === 0))
    return undefined
  return (row, index) => (
    <RepeatScopeProvider
      item={row}
      index={index}
      // Upstream types the path as a string, but reads a missing one as "outside a repeat".
      basePath={(rowsPath === undefined ? undefined : `${rowsPath}/${index}`) as string}
    >
      {/* Capture runs before the control's own handler, popovers included: React events cross portals. */}
      <span className="contents" onClickCapture={() => activate(row)}>{nodes}</span>
    </RepeatScopeProvider>
  )
}
