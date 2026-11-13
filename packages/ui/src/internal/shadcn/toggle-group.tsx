'use client'

import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '../utils.js'

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>): React.ReactElement | null {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('group/toggle-group flex flex-wrap items-center gap-1.5', className)}
      {...props}
    />
  )
}

/**
 * A chip that toggles. Chosen, it takes the shared selection tint (see
 * form-controls-plus.css); resting, it is a quiet outlined tag.
 */
function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>): React.ReactElement | null {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-control border border-border bg-background text-control whitespace-nowrap text-muted-foreground transition-colors outline-none hover:border-input hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
