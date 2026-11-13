import type { ComponentProps } from 'react'
import { cn } from '../utils.js'

export function Filters({ className, ...props }: ComponentProps<'div'>): React.ReactElement {
  return <div className={cn('flex flex-wrap items-end gap-3', className)} data-slot="filters" {...props} />
}

export function FiltersField({ className, ...props }: ComponentProps<'div'>): React.ReactElement {
  return <div className={cn('flex min-w-44 flex-col gap-1.5', className)} data-slot="filters-field" {...props} />
}

export function FiltersActions({ className, ...props }: ComponentProps<'div'>): React.ReactElement {
  return <div className={cn('flex items-center gap-2', className)} data-slot="filters-actions" {...props} />
}
