import type { ClipboardEvent, KeyboardEvent, ReactElement } from 'react'
import type { InputOTPProps } from '../catalog/types-public.js'
import { Fragment, useLayoutEffect, useRef } from 'react'
import { Input } from '../internal/shadcn/input.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

const BOX = { sm: 'size-control-sm', md: 'size-control-md', lg: 'size-control-lg' } as const
const NUMERIC_RE = /\d/u
const ALPHANUMERIC_RE = /[\p{L}\d]/u
const MASK_CHAR = '•'

/** Typing into a filled box adds beside its character; the new one wins. Longer text is a paste or autofill. */
function typedText(raw: string, previous: string | undefined): string {
  if (!previous || Array.from(raw).length !== 2)
    return raw
  if (raw.startsWith(previous))
    return raw.slice(previous.length)
  return raw.endsWith(previous) ? raw.slice(0, -previous.length) : raw
}

/**
 * A code in separate boxes, one character each. The value never has holes:
 * focus goes to the first empty box, so the boxes always fill in order.
 */
export function LumiInputOTP(props: InputOTPProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, onComplete, length = 6, type = 'numeric', mask, group, size = 'md', name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const [current, setCurrent] = useControllableValue(value, defaultValue, onChange)
  const boxes = useRef<Array<HTMLInputElement | null>>([])
  const accepted = type === 'numeric' ? NUMERIC_RE : ALPHANUMERIC_RE
  const code = Array.from(current ?? '').filter(char => accepted.test(char)).slice(0, length)
  const label = ariaLabel ?? props['aria-label'] ?? t('lumi.otp.name', 'Verification code')
  const locked = disabled || readonly
  const pendingFocus = useRef<number>(undefined)
  const focus = (index: number): void => {
    const box = boxes.current[Math.max(0, Math.min(length - 1, index))]
    box?.focus()
    box?.select()
  }
  // Focus moves after the new code renders; the boxes' focus guard would
  // otherwise read the old code and send focus back.
  useLayoutEffect(() => {
    if (pendingFocus.current === undefined)
      return
    focus(pendingFocus.current)
    pendingFocus.current = undefined
  })
  const update = (next: string[], caret: number): void => {
    const text = next.join('').slice(0, length)
    if (text !== code.join('')) {
      pendingFocus.current = caret
      setCurrent(text)
      if (text.length === length)
        onComplete?.(text)
    }
    else {
      focus(caret)
    }
  }
  /** Writes characters from `index` on, as typing, pasting or autofill does. */
  const insert = (index: number, input: string): void => {
    const chars = Array.from(input).filter(char => accepted.test(char))
    if (!chars.length || locked)
      return
    const start = Math.min(index, code.length)
    const next = [...code.slice(0, start), ...chars, ...code.slice(start + chars.length)].slice(0, length)
    update(next, Math.min(start + chars.length, length - 1))
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number): void => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      if (locked)
        return
      if (event.key === 'Backspace' && !code[index] && index > 0)
        update([...code.slice(0, index - 1), ...code.slice(index)], index - 1)
      else
        update([...code.slice(0, index), ...code.slice(index + 1)], index)
    }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      focus(index + ((event.key === 'ArrowLeft') !== (document.dir === 'rtl') ? -1 : 1))
    }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      focus(event.key === 'Home' ? 0 : Math.min(code.length, length - 1))
    }
  }
  const onPaste = (event: ClipboardEvent<HTMLInputElement>, index: number): void => {
    event.preventDefault()
    insert(index, event.clipboardData.getData('text'))
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-slot="lumi-input-otp" data-testid={props['data-testid']}>
      {name && <input type="hidden" name={name} value={code.join('')} disabled={disabled} />}
      <div id={id} role="group" aria-label={label} aria-describedby={props['aria-describedby']} className="flex flex-wrap items-center gap-1.5" data-slot="input-otp-boxes">
        {Array.from({ length }, (_, index) => (
          // Boxes are positions in the code; the index is their identity.
          <Fragment key={index}>
            {group && index > 0 && index % group === 0 && <span className="w-2 text-center text-muted-foreground" data-slot="input-otp-separator" aria-hidden>–</span>}
            <Input
              ref={(element) => {
                boxes.current[index] = element
              }}
              className={cn(BOX[size], 'px-0 text-center tabular-nums')}
              data-lumi-control-size={size}
              data-filled={code[index] ? true : undefined}
              value={code[index] ? (mask ? MASK_CHAR : code[index]) : ''}
              inputMode={type === 'numeric' ? 'numeric' : 'text'}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              autoCapitalize="off"
              spellCheck={false}
              disabled={disabled}
              readOnly={readonly}
              aria-invalid={invalid}
              aria-label={t('lumi.otp.box', 'Character {index} of {count}', { index: index + 1, count: length })}
              onFocus={(event) => {
                if (index > code.length)
                  focus(code.length)
                else
                  event.currentTarget.select()
              }}
              onChange={event => insert(index, typedText(event.target.value.replaceAll(MASK_CHAR, ''), code[index]))}
              onKeyDown={event => onKeyDown(event, index)}
              onPaste={event => onPaste(event, index)}
            />
          </Fragment>
        ))}
      </div>
      {error && <p role="alert" className="text-meta text-destructive" data-slot="input-otp-error">{error}</p>}
    </div>
  )
}
