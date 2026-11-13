import type { ComponentProps } from 'react'
import { cn } from '../utils.js'

export function Timeline({ className, ...props }: ComponentProps<'ol'>): React.ReactElement {
  return <ol className={cn('flex flex-col', className)} data-slot="timeline" {...props} />
}

export function TimelineItem({ className, ...props }: ComponentProps<'li'>): React.ReactElement {
  return <li className={cn('group/timeline-item relative ms-6 flex flex-col gap-1 pb-6 last:pb-0', className)} data-slot="timeline-item" {...props} />
}

export function TimelineIndicator({ className, ...props }: ComponentProps<'span'>): React.ReactElement {
  return <span aria-hidden className={cn('absolute top-0 -left-6 flex size-4 -translate-x-1/2 items-center justify-center rounded-full border-2 text-[0.625rem] leading-none', className)} data-slot="timeline-indicator" {...props} />
}

export function TimelineSeparator({ className, ...props }: ComponentProps<'span'>): React.ReactElement {
  return <span aria-hidden className={cn('absolute top-4 -bottom-0 -left-6 w-0.5 -translate-x-1/2 bg-border group-last/timeline-item:hidden', className)} data-slot="timeline-separator" {...props} />
}

export function TimelineHeader({ className, ...props }: ComponentProps<'div'>): React.ReactElement {
  return <div className={cn('flex flex-wrap items-baseline justify-between gap-2', className)} data-slot="timeline-header" {...props} />
}

export function TimelineTitle({ className, ...props }: ComponentProps<'h3'>): React.ReactElement {
  return <h3 className={cn('font-medium', className)} data-slot="timeline-title" {...props} />
}

export function TimelineDate({ className, ...props }: ComponentProps<'time'>): React.ReactElement {
  return <time className={cn('text-xs text-muted-foreground', className)} data-slot="timeline-date" {...props} />
}

export function TimelineContent({ className, ...props }: ComponentProps<'p'>): React.ReactElement {
  return <p className={cn('text-muted-foreground', className)} data-slot="timeline-content" {...props} />
}
