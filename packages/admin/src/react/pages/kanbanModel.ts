export type LumiKanbanKey = string | number

/** Where a card went: the payload a page persists after `move`. */
export interface LumiKanbanMove {
  id: LumiKanbanKey
  from: string
  to: string
  /** Position inside the target column after the move, 0-based. */
  index: number
  /** Fractional rank between the new neighbours, for backends that sort by it. */
  rank: number
}

type Row = { id: LumiKanbanKey } & Record<string, unknown>

const RANK_STEP = 1024

function rankOf(row: Row | undefined, rankField: string, fallback: number): number {
  const value = row?.[rankField]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Cards of one column in board order. */
export function columnCards<T extends Row>(cards: readonly T[], column: string, columnField = 'status'): T[] {
  return cards.filter(card => String(card[columnField]) === column)
}

/**
 * A rank strictly between the neighbours at `index` of the target column, so
 * only the moved row needs saving. Rows without a rank count by position.
 */
export function rankBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined)
    return RANK_STEP
  if (before === undefined)
    return after! - RANK_STEP
  if (after === undefined)
    return before + RANK_STEP
  return (before + after) / 2
}

/**
 * Moves one card to `index` of column `to`. The flat array keeps every other
 * card where it was; the moved card is placed right after its new upper
 * neighbour (or before its lower one), so the column reads in the new order.
 */
export function moveCard<T extends Row>(
  cards: readonly T[],
  id: LumiKanbanKey,
  to: string,
  index: number,
  { columnField = 'status', rankField = 'rank' }: { columnField?: string, rankField?: string } = {},
): { cards: T[], move: LumiKanbanMove } | undefined {
  const card = cards.find(item => item.id === id)
  if (!card)
    return undefined
  const from = String(card[columnField])
  const rest = cards.filter(item => item.id !== id)
  const target = columnCards(rest, to, columnField)
  const at = Math.max(0, Math.min(index, target.length))
  const before = target[at - 1]
  const after = target[at]
  const rank = rankBetween(
    before ? rankOf(before, rankField, (at - 1) * RANK_STEP) : undefined,
    after ? rankOf(after, rankField, at * RANK_STEP) : undefined,
  )
  const moved = { ...card, [columnField]: to, [rankField]: rank } as T
  const anchor = before ? rest.indexOf(before) + 1 : after ? rest.indexOf(after) : rest.length
  const next = [...rest.slice(0, anchor), moved, ...rest.slice(anchor)]
  return { cards: next, move: { id, from, to, index: at, rank } }
}

/** The drop slot under a pointer: the first card whose midpoint lies below it. */
export function dropIndex(midpoints: readonly number[], pointerY: number): number {
  const slot = midpoints.findIndex(mid => pointerY < mid)
  return slot === -1 ? midpoints.length : slot
}

/**
 * Keyboard target after an arrow key while a card is picked up. Up/down walk
 * the slots of the current column; left/right jump to the neighbouring column,
 * keeping the row where the column has room for it.
 */
export function keyboardTarget(
  target: { column: string, index: number },
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  columns: readonly { value: string, size: number }[],
): { column: string, index: number } {
  const at = columns.findIndex(column => column.value === target.column)
  if (at === -1)
    return target
  if (key === 'ArrowUp')
    return { column: target.column, index: Math.max(0, target.index - 1) }
  if (key === 'ArrowDown')
    return { column: target.column, index: Math.min(columns[at]!.size, target.index + 1) }
  const next = columns[at + (key === 'ArrowLeft' ? -1 : 1)]
  return next ? { column: next.value, index: Math.min(target.index, next.size) } : target
}
