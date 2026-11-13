import { useEffect, useRef } from 'react'
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from '../icons.js'

export type LumiFeedbackTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

/** A queue of entries keyed by string, shared by the toaster and the notifier. */
export interface LumiFeedbackQueue<TInput, TEntry> {
  open: (input: TInput) => string
  close: (key: string) => void
  clear: () => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => readonly TEntry[]
}

/** Builds a keyed queue: a reopened key replaces its entry, the oldest leave first past `max`. */
export function createFeedbackQueue<TInput extends { key?: string }, TEntry extends { key: string, version: number }>(
  prefix: string,
  max: number,
  build: (input: TInput, key: string, version: number) => TEntry,
): LumiFeedbackQueue<TInput, TEntry> {
  let entries: readonly TEntry[] = []
  let sequence = 0
  const listeners = new Set<() => void>()
  const emit = (next: readonly TEntry[]): void => {
    entries = next
    for (const listener of listeners)
      listener()
  }
  return {
    open(input) {
      const key = input.key ?? `${prefix}-${++sequence}`
      const previous = entries.find(entry => entry.key === key)
      // Newest last; the oldest leave first once the stack is full.
      emit([...entries.filter(item => item.key !== key), build(input, key, (previous?.version ?? 0) + 1)].slice(-max))
      return key
    },
    close(key) {
      if (entries.some(entry => entry.key === key))
        emit(entries.filter(entry => entry.key !== key))
    },
    clear() {
      if (entries.length)
        emit([])
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => entries,
  }
}

export const FEEDBACK_ICONS = { neutral: InfoIcon, info: InfoIcon, success: CheckCircleIcon, warning: AlertCircleIcon, danger: AlertCircleIcon } as const

/**
 * Closes an entry after its duration. The timer pauses while the pointer or
 * focus rests on it and restarts in full when a keyed entry is reopened.
 */
export function useFeedbackTimer(entry: { key: string, duration: number, version: number }, close: (key: string) => void): { pause: () => void, resume: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const remaining = useRef(entry.duration)
  const started = useRef(0)
  const resume = (): void => {
    if (!entry.duration || timer.current)
      return
    started.current = Date.now()
    timer.current = setTimeout(close, remaining.current, entry.key)
  }
  const pause = (): void => {
    if (!timer.current)
      return
    clearTimeout(timer.current)
    timer.current = undefined
    remaining.current = Math.max(0, remaining.current - (Date.now() - started.current))
  }
  useEffect(() => {
    remaining.current = entry.duration
    resume()
    return () => {
      clearTimeout(timer.current)
      timer.current = undefined
    }
  }, [entry.version, entry.duration])
  return { pause, resume }
}
