import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The Lumi role names registered in `style.css` `@theme`. Without them
// `twMerge` cannot tell `h-control-md` and `h-control-sm` conflict, keeps both,
// and the size a caller asked for loses to source order.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['control-xs', 'control-sm', 'control-md', 'control-lg', 'control-touch', 'inset-xs', 'inset-sm', 'inset-md', 'inset-lg'],
      radius: ['control', 'item', 'panel', 'overlay'],
      text: ['control', 'label', 'meta'],
      color: ['hover', 'hover-foreground', 'selected', 'selected-border', 'selected-foreground', 'selected-range', 'choice', 'choice-foreground', 'choice-border', 'focus'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
