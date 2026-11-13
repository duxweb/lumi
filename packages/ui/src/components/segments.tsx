import type { CSSProperties, ReactElement } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../internal/utils.js'

export type LumiSegmentTone = 'default' | 'brand' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface LumiSegmentBarProps {
  /** Filled amount, from 0 to `max`. */
  value: number
  max?: number
  orientation?: 'horizontal' | 'vertical'
  /**
   * Fixed number of segments. Without it the bar fits as many `size`-long
   * segments as its length allows, so every bar on a page shares one pitch.
   */
  count?: number
  /** Length of one segment along the bar, in px, when `count` is not set (5 across, 6 up). */
  size?: number
  /** Gap between segments, in px (4 across, 3 up). */
  gap?: number
  /**
   * Segments lit even at zero. Charts keep one so an empty value still reads
   * as a column; progress keeps none so 0% looks empty.
   */
  minFilled?: number
  tone?: LumiSegmentTone
  className?: string
  style?: CSSProperties
}

const FALLBACK_COUNT = 20

/**
 * A meter drawn as a row (or column) of rounded segments, lit from the start.
 * It is decoration: the reading belongs to the element that owns it, which
 * carries the number as text or an ARIA value.
 */
export function LumiSegmentBar({ value, max = 100, orientation = 'horizontal', count, size: sizeProp, gap: gapProp, minFilled = 0, tone = 'default', className, style }: LumiSegmentBarProps): ReactElement {
  // Across a bar the segments are narrow pills; up a column they are short,
  // wide ones — the same mark turned to the bar's direction.
  const size = sizeProp ?? (orientation === 'horizontal' ? 5 : 6)
  const gap = gapProp ?? (orientation === 'horizontal' ? 4 : 3)
  const host = useRef<HTMLSpanElement>(null)
  const [measured, setMeasured] = useState<number>()
  useLayoutEffect(() => {
    const element = host.current
    if (count || !element || typeof ResizeObserver === 'undefined')
      return
    const fit = (): void => {
      const length = orientation === 'horizontal' ? element.clientWidth : element.clientHeight
      if (length > 0)
        setMeasured(Math.max(1, Math.floor((length + gap) / (size + gap))))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [count, orientation, size, gap])
  const total = count ?? measured ?? FALLBACK_COUNT
  const share = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
  const filled = Math.min(total, Math.max(minFilled, Math.round(share * total)))
  return (
    <span
      ref={host}
      aria-hidden
      data-slot="segment-bar"
      data-orientation={orientation}
      data-tone={tone}
      className={cn(className)}
      style={{ ...style, '--lumi-segment-gap': `${gap}px` } as CSSProperties}
    >
      {Array.from({ length: total }, (_, index) => (
        // Segments are positional; the bar owns their identity.
        <i key={index} data-filled={index < filled || undefined} />
      ))}
    </span>
  )
}
