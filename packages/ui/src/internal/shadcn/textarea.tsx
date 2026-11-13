import * as React from 'react'

import { FIELD_DISABLED, FIELD_FOCUS, FIELD_SURFACE } from '../field-surface.js'
import { cn } from '../utils.js'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>): React.ReactElement | null {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        FIELD_SURFACE,
        FIELD_FOCUS,
        FIELD_DISABLED,
        'flex field-sizing-content min-h-16 w-full px-inset-md py-2 text-control transition-colors outline-none placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
