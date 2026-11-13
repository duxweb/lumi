import type { ReactElement } from 'react'
import type { ControlAppearance, MentionProps, Option, Size } from '../catalog/types-public.js'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '../internal/shadcn/popover.js'
import { Textarea } from '../internal/shadcn/textarea.js'
import { cn } from '../internal/utils.js'
import { matchOptions, SuggestionList, useSuggestionKeys } from './autocomplete.js'
import { optionKey, useControllableValue } from './control.js'
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
const WHITESPACE = /\s/

export interface MentionMatch {
  /** Index of the trigger character. */
  start: number
  query: string
}

/** The mention being typed at `caret`: a trigger at a word start, then no whitespace up to the caret. */
export function findMention(text: string, caret: number, trigger: string): MentionMatch | null {
  const before = text.slice(0, caret)
  const start = before.lastIndexOf(trigger)
  if (start === -1 || (start > 0 && !WHITESPACE.test(before[start - 1]!)))
    return null
  const query = before.slice(start + trigger.length)
  return WHITESPACE.test(query) ? null : { start, query }
}

const MIRRORED = ['boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize'] as const

/**
 * Viewport box of the caret in a textarea, measured on an off-screen copy that
 * wraps the text the same way.
 */
function caretBox(element: HTMLTextAreaElement, position: number): DOMRect {
  const style = window.getComputedStyle(element)
  const mirror = document.createElement('div')
  for (const property of MIRRORED)
    mirror.style[property] = style[property]
  Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' })
  mirror.textContent = element.value.slice(0, position)
  const marker = document.createElement('span')
  marker.textContent = '\u200B'
  mirror.append(marker)
  document.body.append(mirror)
  const box = element.getBoundingClientRect()
  const left = box.left + (Number.parseFloat(style.borderLeftWidth) || 0) + marker.offsetLeft - element.scrollLeft
  const top = box.top + (Number.parseFloat(style.borderTopWidth) || 0) + marker.offsetTop - element.scrollTop
  const height = marker.offsetHeight || Number.parseFloat(style.lineHeight) || 16
  mirror.remove()
  return pointBox(left, top, height)
}

function pointBox(left: number, top: number, height: number): DOMRect {
  return { x: left, y: top, left, top, width: 0, height, right: left, bottom: top + height, toJSON: () => ({}) } as DOMRect
}

export function LumiMention(props: MentionProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue, onChange, onSearch, onSelect, options: input, trigger = '@', loading, rows = 3, autoResize, placeholder, size = 'md', appearance = 'outline', name, disabled, readonly, invalid, ariaLabel, className, id, required } = props
  const [text, setText] = useControllableValue(value, defaultValue ?? '', next => onChange?.(String(next)))
  const current = text ?? ''
  const field = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | undefined>(undefined)
  const [match, setMatch] = useState<MentionMatch | null>(null)
  const [dismissed, setDismissed] = useState<number>()
  const listId = useId()
  const unavailable = disabled || readonly
  const visible = matchOptions(input ?? NO_OPTIONS, match?.query ?? '', onSearch !== undefined)
  const enabled = visible.filter(option => !option.disabled)
  const showList = Boolean(match) && match!.start !== dismissed && !unavailable && (visible.length > 0 || Boolean(loading))
  const anchor = useMemo(() => ({ current: { getBoundingClientRect: () => field.current && match ? caretBox(field.current, match.start) : pointBox(0, 0, 0) } }), [match])

  const searched = useRef<string | undefined>(undefined)
  useEffect(() => {
    const query = match?.query
    if (query !== undefined && query !== searched.current)
      onSearch?.(query)
    searched.current = query
  }, [match?.query, onSearch])

  useLayoutEffect(() => {
    if (caret.current === undefined || !field.current)
      return
    field.current.setSelectionRange(caret.current, caret.current)
    caret.current = undefined
  }, [current])

  const sync = (element: HTMLTextAreaElement): void => {
    const next = element.selectionStart === element.selectionEnd ? findMention(element.value, element.selectionStart, trigger) : null
    setMatch(previous => previous?.start === next?.start && previous?.query === next?.query ? previous : next)
    if (!next)
      setDismissed(undefined)
  }
  const close = (): void => setDismissed(match?.start)
  const choose = (option: Option): void => {
    if (!match)
      return
    const end = match.start + trigger.length + match.query.length
    const inserted = `${trigger}${option.label} `
    caret.current = match.start + inserted.length
    setText(`${current.slice(0, match.start)}${inserted}${current.slice(end)}`)
    setMatch(null)
    onSelect?.(option)
  }
  const keys = useSuggestionKeys(enabled, showList, choose, close, () => {})

  return (
    <Popover open={showList} onOpenChange={next => !next && close()}>
      <PopoverAnchor virtualRef={anchor} />
      <Textarea
        ref={field}
        id={id}
        name={name}
        className={cn(autoResize && 'field-sizing-content resize-none', className)}
        value={current}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={props['aria-describedby']}
        aria-autocomplete="list"
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList && keys.active ? `${listId}-${visible.indexOf(keys.active)}` : undefined}
        data-slot="lumi-mention"
        data-appearance={appearance}
        data-auto-resize={autoResize || undefined}
        data-lumi-control-size={size}
        data-testid={props['data-testid']}
        onChange={(event) => {
          setText(event.target.value)
          keys.setActiveKey(undefined)
          sync(event.target)
        }}
        onSelect={event => sync(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229)
            return
          if (!keys.onKeyDown(event, true) && showList && event.key === 'Enter' && !keys.active && enabled[0]) {
            event.preventDefault()
            keys.pick(enabled[0])
          }
        }}
        onBlur={() => setMatch(null)}
      />
      <PopoverContent
        className="lumi-select-popover lumi-mention-popover gap-0 overflow-hidden p-0"
        side="bottom"
        align="start"
        sideOffset={6}
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
          query={match?.query ?? ''}
          loading={loading}
          label={ariaLabel ? t('lumi.mention.suggestionsOf', '{name} suggestions', { name: ariaLabel }) : t('lumi.mention.suggestions', 'Mention suggestions')}
          onActive={option => keys.setActiveKey(optionKey(option.value))}
          onChoose={keys.pick}
        />
      </PopoverContent>
    </Popover>
  )
}
