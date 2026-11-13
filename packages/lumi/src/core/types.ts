export type ID = string | number
export type Meta = Record<string, unknown>
export type SortOrder = 'asc' | 'desc'

export interface Sorter {
  field: string
  order: SortOrder
}

export const FILTER_OPERATORS = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'like', 'nlike', 'in', 'nin', 'between', 'null', 'nnull'] as const
export type FilterOperator = typeof FILTER_OPERATORS[number]

export interface Filter {
  field: string
  operator: FilterOperator
  value: unknown
}

export interface Pagination {
  page: number
  pageSize: number
}

/**
 * When a write shows on screen. `pessimistic` waits for the server;
 * `optimistic` changes the cached lists and records at once and puts them
 * back if the server refuses; `undoable` does the same and waits
 * `undoableTimeout` before sending, offering Undo on a notice meanwhile.
 */
export type MutationMode = 'pessimistic' | 'optimistic' | 'undoable'
