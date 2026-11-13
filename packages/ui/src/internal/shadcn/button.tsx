import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'

import { cn } from '../utils.js'

const buttonVariants = cva(
  'group/button inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding text-control font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        brand: 'bg-brand text-brand-foreground hover:bg-brand/90',
        outline:
          'border-input bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Heights, insets and radius come from the control tokens, so a button
        // matches the input beside it at every size.
        'default':
          'h-control-md gap-1.5 px-inset-md has-data-[icon=inline-end]:pr-inset-sm has-data-[icon=inline-start]:pl-inset-sm',
        'xs': 'h-control-xs gap-1 rounded-item px-inset-sm text-xs has-data-[icon=inline-end]:pr-inset-xs has-data-[icon=inline-start]:pl-inset-xs [&_svg:not([class*="size-"])]:size-3',
        'sm': 'h-control-sm gap-1 px-inset-sm has-data-[icon=inline-end]:pr-inset-xs has-data-[icon=inline-start]:pl-inset-xs [&_svg:not([class*="size-"])]:size-3.5',
        'lg': 'h-control-lg gap-1.5 px-inset-lg has-data-[icon=inline-end]:pr-inset-md has-data-[icon=inline-start]:pl-inset-md',
        'icon': 'size-control-md',
        'icon-xs':
          'size-control-xs rounded-item [&_svg:not([class*="size-"])]:size-3',
        'icon-sm':
          'size-control-sm',
        'icon-lg': 'size-control-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'>
  & VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }): React.ReactElement | null {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
