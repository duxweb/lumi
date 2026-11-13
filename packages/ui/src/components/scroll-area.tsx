import type { ReactElement, ReactNode } from 'react'
import type { ScrollAreaProps } from '../catalog/types-public.js'
import { ScrollArea } from '../internal/shadcn/scroll-area.js'
import { cn } from '../internal/utils.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string }

const length = (value: number | string | null | undefined): string | undefined => typeof value === 'number' ? `${value}px` : value ?? undefined

/**
 * Scrolls its content inside a fixed or maximum height with slim scrollbars
 * drawn in the theme. The viewport is a tab stop, so keyboard users can scroll.
 */
export function LumiScrollArea(props: ScrollAreaProps & HostProps): ReactElement {
  const { orientation, maxHeight, height, ariaLabel, className, children, 'aria-label': hostLabel, 'data-testid': testId } = props
  const axis = orientation ?? 'vertical'
  const horizontal = axis !== 'vertical'
  const name = ariaLabel ?? hostLabel
  return (
    <ScrollArea
      type="auto"
      data-orientation={axis}
      data-testid={testId}
      className={cn('min-w-0 overflow-hidden', className)}
      style={{ height: length(height) }}
      scrollbars={axis === 'both' ? ['vertical', 'horizontal'] : [axis]}
      viewportProps={{
        'tabIndex': 0,
        'role': name ? 'region' : undefined,
        'aria-label': name,
        // Radix lays content out as a table to measure its width; without
        // horizontal scrolling that table would stop long text from wrapping.
        'className': horizontal ? undefined : '[&>div]:block!',
        'style': { maxHeight: length(maxHeight) },
      }}
    >
      {children}
    </ScrollArea>
  )
}
