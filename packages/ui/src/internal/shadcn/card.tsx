import * as React from 'react'

import { cn } from '../utils.js'

function Card({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'div'> & { size?: 'default' | 'sm' }): React.ReactElement | null {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'group/card flex flex-col overflow-hidden rounded-panel bg-card text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:var(--lumi-surface-padding)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header @container/card-header grid min-h-12 auto-rows-min content-center items-center gap-x-2 gap-y-0.5 rounded-t-panel px-(--card-spacing) py-(--lumi-surface-band) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="card-title"
      className={cn(
        'text-sm leading-snug font-semibold',
        className,
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="card-description"
      className={cn('text-[length:var(--lumi-fs-meta)] text-muted-foreground', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="card-content"
      className={cn('px-(--card-spacing) pb-(--card-spacing) first:pt-(--card-spacing)', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center rounded-b-panel border-t bg-muted/50 px-(--card-spacing) py-(--lumi-surface-band)',
        className,
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
}
