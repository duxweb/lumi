import type { ChangeEvent, RefCallback } from 'react'
import { useMemo } from 'react'
import { compileMask, formatTyped, isNumericMask, typedOf, useMaskedInput } from '../internal/mask.js'

/**
 * Fits text into a mask pattern: `9` a digit, `A` a letter, `*` a letter or
 * digit, `\` makes the next character literal. Masked input is read by
 * position; `raw` input holds only typed characters, so a literal digit such
 * as the `86` of `+86 999` is never mistaken for one.
 */
export function applyMask(input: string, mask: string, raw = false): { masked: string, raw: string } {
  const compiled = compileMask(mask)
  const typed = raw ? typedOf(formatTyped(input, compiled), compiled) : typedOf(input, compiled)
  return { masked: formatTyped(typed, compiled), raw: typed }
}

export interface InputMaskBinding {
  ref: RefCallback<HTMLInputElement>
  display: string
  inputMode: 'numeric' | 'text'
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Masks an Input. The bound value is the masked text, or only the typed
 * characters with `unmask`. Typing, paste, deletion and the caret are handled
 * on the element itself; the value only ever holds what the mask accepts.
 */
export function useInputMask(mask: string | undefined, unmask: boolean | undefined, value: string, setValue: (next: string) => void): InputMaskBinding | undefined {
  const compiled = useMemo(() => mask ? compileMask(mask) : undefined, [mask])
  const ref = useMaskedInput(compiled)
  if (!compiled)
    return undefined
  const typed = unmask ? typedOf(formatTyped(value, compiled), compiled) : typedOf(value, compiled)
  return {
    ref,
    display: formatTyped(typed, compiled),
    inputMode: isNumericMask(mask!) ? 'numeric' : 'text',
    onChange: (event) => {
      const next = event.target.value
      setValue(unmask ? typedOf(next, compiled) : next)
    },
  }
}
