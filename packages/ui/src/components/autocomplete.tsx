import type { KeyboardEvent, ReactElement } from 'react'
import type { AutoCompleteProps, ControlAppearance, Option, Size } from '../catalog/types-public.js'
import { useEffect, useId, useRef, useState } from 'react'
import { XIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Input } from '../internal/shadcn/input.js'
import { Popover, PopoverAnchor, PopoverContent } from '../internal/shadcn/popover.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { CONTROL_HEIGHT, optionKey, useControllableValue } from './control.js'
import { OptionContent } from './option-content.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'size'?: Size
  'appearance'?: ControlAppearance
  'required'?: boolean
  'aria-describedby'?: string
  'data-testid'?: string
}

const NO_OPTIONS: readonly Option[] = []

/** Suggestions that contain the typed text, unless the host searches for them. */
export function matchOptions(options: readonly Option[], query: string, remote: boolean): Option[] {
  const needle = query.trim().toLocaleLowerCase()
  if (remote || !needle)
    return [...options]
  return options.filter(option => `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(needle))
}

export interface SuggestionKeys {
  active: Option | undefined
  setActiveKey: (key: string | undefined) => void
  /** Takes a suggestion and forgets the active row. */
  pick: (option: Option) => void
  /** Returns whether the key was handled. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>, takeTab?: boolean) => boolean
}

/**
 * Moves an active suggestion through `enabled` with the arrow keys and takes
 * it with Enter. Shared by AutoComplete and Mention, whose input keeps focus
 * while the list is open.
 */
export function useSuggestionKeys(enabled: Option[], open: boolean, choose: (option: Option) => void, close: () => void, openList: () => void): SuggestionKeys {
  const [activeKey, setActiveKey] = useState<string>()
  const active = enabled.find(option => optionKey(option.value) === activeKey)
  const pick = (option: Option): void => {
    setActiveKey(undefined)
    choose(option)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, takeTab = false): boolean => {
    // Keys that confirm an input method's candidate are not ours; Safari ends
    // composition with keyCode 229 and isComposing already false.
    if (event.nativeEvent.isComposing || event.keyCode === 229)
      return false
    const index = active ? enabled.indexOf(active) : -1
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!open) {
        openList()
        return false
      }
      if (!enabled.length)
        return false
      event.preventDefault()
      const next = event.key === 'ArrowDown'
        ? enabled[(index + 1) % enabled.length]
        : enabled[index <= 0 ? enabled.length - 1 : index - 1]
      setActiveKey(next ? optionKey(next.value) : undefined)
      return true
    }
    if (!open)
      return false
    if ((event.key === 'Enter' || (takeTab && event.key === 'Tab')) && active) {
      event.preventDefault()
      pick(active)
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return true
    }
    if (event.key === 'Tab')
      close()
    return false
  }
  return { active, setActiveKey, pick, onKeyDown }
}

interface SuggestionListProps {
  listId: string
  options: Option[]
  active: Option | undefined
  query: string
  loading?: boolean | undefined
  label: string
  onActive: (option: Option) => void
  onChoose: (option: Option) => void
}

/** The listbox under an AutoComplete or Mention; focus stays in the text field. */
export function SuggestionList({ listId, options, active, query, loading, label, onActive, onChoose }: SuggestionListProps): ReactElement {
  const { t } = useUiText()
  useEffect(() => {
    if (active)
      document.getElementById(`${listId}-${options.indexOf(active)}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId, options])
  return (
    <>
      <div id={listId} className="lumi-select-options min-h-0 overflow-y-auto overscroll-contain" role="listbox" aria-label={label} aria-busy={loading || undefined}>
        {options.map((option, index) => (
          <div
            key={optionKey(option.value)}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={option === active}
            aria-disabled={option.disabled || undefined}
            className="lumi-select-option lumi-suggestion flex cursor-default items-center"
            data-active={option === active || undefined}
            onPointerMove={() => {
              if (!option.disabled)
                onActive(option)
            }}
            onPointerDown={event => event.preventDefault()}
            onClick={() => {
              if (!option.disabled)
                onChoose(option)
            }}
          >
            <OptionContent option={option} query={query} />
          </div>
        ))}
      </div>
      {loading && options.length === 0 && (
        <div className="lumi-select-empty m-0 flex items-center justify-center text-muted-foreground" role="status">
          <Spinner />
          {t('lumi.select.searching', 'Searching…')}
        </div>
      )}
    </>
  )
}

export function LumiAutoComplete(props: AutoCompleteProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue, onChange, onSearch, onSelect, options: input, loading, clearable, placeholder, size = 'md', appearance = 'outline', name, disabled, readonly, invalid, ariaLabel, className, id, required } = props
  const [text, setText] = useControllableValue(value, defaultValue ?? '', next => onChange?.(String(next)))
  const [open, setOpen] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const listId = useId()
  const unavailable = disabled || readonly
  const current = text ?? ''
  const visible = matchOptions(input ?? NO_OPTIONS, current, onSearch !== undefined)
  const enabled = visible.filter(option => !option.disabled)
  const showList = open && !unavailable && (visible.length > 0 || Boolean(loading))
  const close = (): void => setOpen(false)
  const choose = (option: Option): void => {
    setText(option.label)
    onSelect?.(option)
    setOpen(false)
  }
  const keys = useSuggestionKeys(enabled, showList, choose, close, () => setOpen(true))
  const listName = ariaLabel ?? t('lumi.autoComplete.suggestions', 'Suggestions')

  return (
    <Popover open={showList} onOpenChange={next => !next && close()}>
      <PopoverAnchor asChild>
        <div className={cn('relative w-full min-w-0', className)} data-slot="lumi-autocomplete">
          <Input
            ref={field}
            id={id}
            name={name}
            className={cn(CONTROL_HEIGHT[size], (clearable || loading) && 'pe-8')}
            value={current}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readonly}
            required={required}
            autoComplete="off"
            role="combobox"
            aria-label={ariaLabel}
            aria-invalid={invalid}
            aria-describedby={props['aria-describedby']}
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-activedescendant={showList && keys.active ? `${listId}-${visible.indexOf(keys.active)}` : undefined}
            data-appearance={appearance}
            data-lumi-control-size={size}
            data-testid={props['data-testid']}
            onChange={(event) => {
              setText(event.target.value)
              keys.setActiveKey(undefined)
              setOpen(true)
              onSearch?.(event.target.value)
            }}
            onKeyDown={event => keys.onKeyDown(event)}
            onClick={() => setOpen(true)}
            onBlur={close}
          />
          {loading
            ? <Spinner className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground" />
            : clearable && current !== '' && !unavailable && (
              <Button
                className="absolute top-1/2 right-1 -translate-y-1/2"
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('lumi.common.clear', 'Clear')}
                onClick={() => {
                  setText('')
                  onSearch?.('')
                  field.current?.focus()
                }}
              >
                <XIcon />
              </Button>
            )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="lumi-select-popover gap-0 overflow-hidden p-0"
        align="start"
        collisionPadding={8}
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
        onInteractOutside={(event) => {
          if (field.current?.contains(event.target as Node))
            event.preventDefault()
        }}
      >
        <SuggestionList
          listId={listId}
          options={visible}
          active={keys.active}
          query={current}
          loading={loading}
          label={listName}
          onActive={option => keys.setActiveKey(optionKey(option.value))}
          onChoose={keys.pick}
        />
      </PopoverContent>
    </Popover>
  )
}
