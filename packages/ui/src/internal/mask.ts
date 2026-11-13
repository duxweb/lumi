import type { MutableRefObject, RefCallback } from 'react'
import { format, generatePattern, unformat, useMask } from '@react-input/mask'
import { useCallback, useRef } from 'react'

/**
 * Lumi's mask pattern (`9` digit, `A` letter, `*` letter or digit, `\`
 * escapes the next character) compiled for @react-input/mask. Slots become
 * private-use characters, so a literal `9`, `A`, `*` or `_` in the pattern can
 * never be taken for a slot. The mask is never shown with its slots, so they
 * stay invisible.
 */
const SLOT = { '9': '\uE000', 'A': '\uE001', '*': '\uE002' } as const
const REPLACEMENT = { '\uE000': /\d/, '\uE001': /\p{L}/u, '\uE002': /[\p{L}\d]/u }

export interface CompiledMask { mask: string, replacement: typeof REPLACEMENT }

export function compileMask(pattern: string): CompiledMask {
  let mask = ''
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]!
    if (char === '\\' && index + 1 < pattern.length)
      mask += pattern[++index]!
    else
      mask += char in SLOT ? SLOT[char as keyof typeof SLOT] : char
  }
  return { mask, replacement: REPLACEMENT }
}

/** Whether a slot accepts only digits everywhere, for the on-screen keyboard. */
export function isNumericMask(pattern: string): boolean {
  return !compileMask(pattern).mask.includes(SLOT.A) && !compileMask(pattern).mask.includes(SLOT['*'])
}

/** The display text for typed characters. */
export function formatTyped(typed: string, compiled: CompiledMask): string {
  return format(typed, compiled)
}

/** The typed characters of a value: a masked value is read by position, anything else as typed text. */
export function typedOf(value: string, compiled: CompiledMask): string {
  if (value === '')
    return ''
  if (new RegExp(generatePattern('partial', compiled)).test(value))
    return unformat(value, compiled)
  return unformat(format(value, compiled), compiled)
}

/** The element ref that masks typing, paste and deletion in place, caret included. */
export function useMaskedInput(compiled: CompiledMask | undefined): RefCallback<HTMLInputElement> {
  const mask = useMask({ mask: compiled?.mask ?? '', replacement: compiled?.replacement ?? {} }) as MutableRefObject<HTMLInputElement | null>
  const attached = useRef<HTMLInputElement | null>(null)
  return useCallback((element: HTMLInputElement | null) => {
    // The library polls the selection until `blur`, which a focused element removed from the page never gets.
    if (!element)
      attached.current?.dispatchEvent(new FocusEvent('blur'))
    attached.current = element
    mask.current = element
  }, [mask])
}
