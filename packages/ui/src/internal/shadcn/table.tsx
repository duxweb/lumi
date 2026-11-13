import * as React from 'react'

import { cn } from '../utils.js'

/**
 * True while the container scrolls horizontally. A scrolling region must be
 * reachable by keyboard, but a tab stop on every table that fits would be noise.
 */
function useOverflowing(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [overflowing, setOverflowing] = React.useState(false)
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined')
      return
    const measure = (): void => setOverflowing(element.scrollWidth > element.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild)
      observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [ref])
  return overflowing
}

function Table({ className, ...props }: React.ComponentProps<'table'>): React.ReactElement | null {
  const container = React.useRef<HTMLDivElement>(null)
  const overflowing = useOverflowing(container)
  return (
    <div
      ref={container}
      data-slot="table-container"
      className="relative w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...(overflowing ? { 'tabIndex': 0, 'role': 'region', 'aria-label': props['aria-label'] ?? 'Scrollable table' } : {})}
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>): React.ReactElement | null {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b-0 [&_tr]:hover:bg-transparent', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>): React.ReactElement | null {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>): React.ReactElement | null {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t font-medium [&>tr]:border-b-0 [&>tr:hover]:bg-transparent [&>tr>td]:py-2 [&>tr:first-child>td]:pt-3 [&>tr:last-child>td]:pb-3',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>): React.ReactElement | null {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[highlighted]:[&_.text-muted-foreground]:text-(--lumi-fg-secondary) data-[state=selected]:bg-selected data-[state=selected]:[&_.text-muted-foreground]:text-(--lumi-fg-secondary)',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>): React.ReactElement | null {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-control-lg border-y border-border px-3 text-left align-middle font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4 [&:has([role=checkbox])]:w-px [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>): React.ReactElement | null {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'px-3 py-2 align-middle whitespace-nowrap first:pl-4 last:pr-4 [&:has([role=checkbox])]:w-px [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>): React.ReactElement | null {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
}
