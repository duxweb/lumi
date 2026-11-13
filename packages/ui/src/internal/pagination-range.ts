/**
 * The page numbers to draw: every page up to seven, otherwise the first, the
 * last and the current page with its neighbours, with `gap` where a run is
 * folded. The strip keeps seven slots, so it does not reflow while paging.
 */
export function paginationRange(page: number, count: number): Array<number | 'gap'> {
  if (count <= 7)
    return Array.from({ length: count }, (_, at) => at + 1)
  if (page <= 4)
    return [1, 2, 3, 4, 5, 'gap', count]
  if (page >= count - 3)
    return [1, 'gap', count - 4, count - 3, count - 2, count - 1, count]
  return [1, 'gap', page - 1, page, page + 1, 'gap', count]
}
