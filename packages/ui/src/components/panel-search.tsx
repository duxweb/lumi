import type { InputHTMLAttributes, KeyboardEvent, ReactElement, Ref } from 'react'
import { useRef } from 'react'
import { SearchIcon, XIcon } from '../icons.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { useUiText } from './text.js'

type NativeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'className'>

export interface PanelSearchProps extends NativeInputProps {
  value: string
  onValueChange: (value: string) => void
  /** Spinner at the end of the row while results load. */
  loading?: boolean | undefined
  /** Clear button at the end of the row while there is text. */
  clearable?: boolean
  inputRef?: Ref<HTMLInputElement>
  /**
   * `divider` is a full-width row ruled off from the list, for floating
   * panels; `inset` is a compact filled bar inside the list's top padding,
   * for inline panels that already have a header.
   */
  variant?: 'divider' | 'inset'
  className?: string
}

/**
 * The search row at the top of a list panel (dropdowns, transfer lists,
 * pickers): an inline icon and a borderless input. Escape with text clears it and is not passed on, so
 * the next Escape reaches the panel. Inside a Radix layer, Escape is seen by
 * the layer first: the host's `onEscapeKeyDown` should call `preventDefault()`
 * while the query is not empty.
 */
export function PanelSearch({ value, onValueChange, loading, clearable = true, inputRef, variant = 'divider', className, placeholder, onKeyDown, disabled, ...input }: PanelSearchProps): ReactElement {
  const { t } = useUiText()
  const own = useRef<HTMLInputElement | null>(null)
  const attach = (node: HTMLInputElement | null): void => {
    own.current = node
    if (typeof inputRef === 'function')
      inputRef(node)
    else if (inputRef)
      inputRef.current = node
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.key !== 'Escape' || !value)
      return
    event.preventDefault()
    event.stopPropagation()
    onValueChange('')
  }
  return (
    <div className={cn('lumi-panel-search', className)} data-slot="panel-search" data-variant={variant} data-disabled={disabled || undefined}>
      <SearchIcon className="lumi-panel-search__icon" aria-hidden />
      <input
        {...input}
        ref={attach}
        type="text"
        className="lumi-panel-search__input"
        value={value}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder ?? t('lumi.select.search', 'Search…')}
        onChange={event => onValueChange(event.target.value)}
        onKeyDown={keyDown}
      />
      {loading && <Spinner className="lumi-panel-search__status" />}
      {clearable && value && !disabled && !loading && (
        <button
          type="button"
          className="lumi-panel-search__clear"
          aria-label={t('lumi.common.clear', 'Clear')}
          onPointerDown={event => event.preventDefault()}
          onClick={() => {
            onValueChange('')
            own.current?.focus()
          }}
        >
          <XIcon aria-hidden />
        </button>
      )}
    </div>
  )
}
