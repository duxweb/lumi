'use client'

import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '../utils.js'

function ScrollArea({
  className,
  children,
  viewportProps,
  scrollbars = ['vertical'],
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportProps?: React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>
  scrollbars?: Array<'vertical' | 'horizontal'>
}): React.ReactElement | null {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        {...viewportProps}
        className={cn('size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset', viewportProps?.className)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {scrollbars.map(orientation => <ScrollBar key={orientation} orientation={orientation} />)}
      {scrollbars.length > 1 && <ScrollAreaPrimitive.Corner />}
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>): React.ReactElement | null {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical'
        && 'h-full w-2 border-l border-l-transparent',
        orientation === 'horizontal'
        && 'h-2 flex-col border-t border-t-transparent',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
