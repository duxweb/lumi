import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Distance from the end of a list at which the next page is requested. */
const LOAD_MORE_THRESHOLD = 48

interface LoadMoreOptions {
  /** Rows currently loaded; one request is made per length. */
  length: number
  /** Identifies the result set, e.g. the search query, so a new set starts over. */
  resetKey?: string
  hasMore?: boolean | undefined
  busy?: boolean | undefined
  active?: boolean
  onLoadMore?: (() => void) | undefined
}

/**
 * Asks for the next page when a scrolling list nears its end, or at once when
 * the loaded rows do not fill it. Returns a ref for the list, the scroll
 * handler and an explicit request for keyboard navigation reaching the last rows.
 */
export function useLoadMore(list: RefObject<HTMLElement | null>, { length, resetKey = '', hasMore, busy, active = true, onLoadMore }: LoadMoreOptions): { ref: (node: HTMLElement | null) => void, onScroll: () => void, request: () => void } {
  // The list may mount later than its owner (inside a portal), so mounting re-runs the check.
  const [, setMounted] = useState<HTMLElement | null>(null)
  const ref = useCallback((node: HTMLElement | null) => {
    list.current = node
    setMounted(node)
  }, [list])
  // Renders before the host reports `busy` must not ask twice.
  const requestedAt = useRef('')
  const can = Boolean(active && hasMore && onLoadMore && !busy)
  const request = (): void => {
    const at = `${resetKey}\u0000${length}`
    if (!can || requestedAt.current === at)
      return
    requestedAt.current = at
    onLoadMore!()
  }
  const onScroll = (): void => {
    const element = list.current
    if (element && element.scrollTop + element.clientHeight >= element.scrollHeight - LOAD_MORE_THRESHOLD)
      request()
  }
  useEffect(onScroll)
  return { ref, onScroll, request }
}
