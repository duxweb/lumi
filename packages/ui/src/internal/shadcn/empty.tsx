import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '../utils.js'

function Empty({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="empty"
      className={cn(
        'flex w-full min-w-0 flex-col items-center justify-center gap-3 rounded-panel border-dashed px-4 py-6 text-center text-balance',
        className,
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        'flex max-w-sm flex-col items-center gap-1 text-center',
        className,
      )}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: 'flex size-9 shrink-0 items-center justify-center rounded-panel bg-muted text-muted-foreground [&_svg:not([class*=\'size-\'])]:size-4.5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>): React.ReactElement | null {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant }), className)}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="empty-title"
      className={cn('text-(length:--lumi-fs-body) leading-5 font-medium text-foreground', className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        'text-(length:--lumi-fs-label) leading-relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        className,
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        'flex w-full max-w-sm min-w-0 flex-col items-center gap-2 text-(length:--lumi-fs-label) text-balance',
        className,
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
}
