/**
 * The one surface every form control wears, taken from Input: its edge, radius
 * and fill; on focus a ring-coloured edge plus a 0.5px inset ring over the
 * focus tint; when disabled a wash at half opacity. The invalid and `filled`
 * treatments are attribute rules in `style.css`, so they reach every control
 * the same way and beat these utilities.
 *
 * A wrapper that frames a field of its own (tags, rich text) takes the
 * `_WITHIN` forms: focus follows the field inside, and disabled follows the
 * wrapper's `data-disabled`, so a read-only field never looks disabled.
 */
export const FIELD_SURFACE = 'rounded-control border border-input bg-transparent aria-invalid:border-destructive dark:bg-input/30'

export const FIELD_FOCUS = 'focus-visible:border-ring focus-visible:bg-focus focus-visible:ring-[0.5px] focus-visible:ring-inset focus-visible:ring-ring aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive dark:focus-visible:bg-focus'

export const FIELD_FOCUS_WITHIN = 'focus-within:border-ring focus-within:bg-focus focus-within:ring-[0.5px] focus-within:ring-inset focus-within:ring-ring dark:focus-within:bg-focus'

export const FIELD_DISABLED = 'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:disabled:bg-input/80'

export const FIELD_DISABLED_WITHIN = 'data-disabled:cursor-not-allowed data-disabled:bg-input/50 data-disabled:opacity-50 dark:data-disabled:bg-input/80'

/** A field set inside a framed wrapper: the wrapper owns every surface state. */
export const FIELD_BARE = 'rounded-none border-0 bg-transparent shadow-none focus-visible:bg-transparent focus-visible:ring-0 disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:focus-visible:bg-transparent dark:disabled:bg-transparent'
