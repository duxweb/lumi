import type { ComponentProps } from 'react'
import { cn } from '../utils.js'

interface FrameProps extends ComponentProps<'section'> {
  variant?: 'default' | 'inverse'
}

/**
 * ReUI Frame. Surfaces live here rather than in the package stylesheet so the
 * component matches upstream: a translucent `muted` well holds a `background`
 * panel inset by 3px, and the panel carries the hairline plus the small shadow
 * that lifts it off the well.
 */
export function Frame({ className, variant = 'default', ...props }: FrameProps): React.ReactElement {
  return (
    <section
      className={cn(
        'relative flex flex-col gap-0.75 rounded-xl border p-0.75 [--frame-panel-p:--spacing(4)]',
        // Muted text on the secondary fill misses 4.5:1, so the well's own copy steps up a shade.
        variant === 'inverse' ? 'border-transparent bg-secondary [&>header_.text-muted-foreground]:text-(--lumi-fg-secondary) [&>footer.text-muted-foreground]:text-(--lumi-fg-secondary)' : 'bg-muted/50 bg-clip-padding',
        className,
      )}
      data-slot="frame"
      data-variant={variant}
      {...props}
    />
  )
}

export function FrameHeader({ className, ...props }: ComponentProps<'header'>): React.ReactElement {
  return <header className={cn('flex flex-col gap-1 px-4 py-3', className)} data-slot="frame-header" {...props} />
}

export function FrameTitle({ className, ...props }: ComponentProps<'h2'>): React.ReactElement {
  return <h2 className={cn('text-sm font-semibold', className)} data-slot="frame-title" {...props} />
}

export function FrameDescription({ className, ...props }: ComponentProps<'p'>): React.ReactElement {
  return <p className={cn('text-sm text-muted-foreground', className)} data-slot="frame-description" {...props} />
}

export function FramePanel({ className, ...props }: ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn(
        'relative grow overflow-hidden rounded-xl border bg-background bg-clip-padding p-(--frame-panel-p) shadow-xs',
        className,
      )}
      data-slot="frame-panel"
      {...props}
    />
  )
}

export function FrameFooter({ className, ...props }: ComponentProps<'footer'>): React.ReactElement {
  return <footer className={cn('px-4 py-3 text-sm text-muted-foreground', className)} data-slot="frame-footer" {...props} />
}
