import * as React from 'react'

import { FIELD_DISABLED, FIELD_FOCUS, FIELD_SURFACE } from '../field-surface.js'
import { cn } from '../utils.js'

function Input({ className, type, ...props }: React.ComponentProps<'input'>): React.ReactElement | null {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        FIELD_SURFACE,
        FIELD_FOCUS,
        FIELD_DISABLED,
        'h-control-md w-full min-w-0 px-inset-md py-1 text-control transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
