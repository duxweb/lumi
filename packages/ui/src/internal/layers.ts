import type { CSSProperties } from 'react'

/**
 * Stacking layers for Radix poppers, from the scale in `style.css`. A popper
 * copies its content's computed z-index onto the positioned wrapper that forms
 * the stacking context, so the layer goes inline on the content, where a host
 * `className` cannot drop it.
 */
export const POPOVER_LAYER: CSSProperties = { zIndex: 'var(--lumi-z-popover)' }

export const TOOLTIP_LAYER: CSSProperties = { zIndex: 'var(--lumi-z-tooltip)' }
