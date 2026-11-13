import type { ReactElement, ReactNode } from 'react'
import type { OptionValue, Size, TagGroupProps, TagProps } from '../catalog/types-public.js'
import { useEffect, useRef } from 'react'
import { LumiIcon, XIcon } from '../icons.js'
import { cn } from '../internal/utils.js'
import { CHOICE_CLASS, optionKey, useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string }

const TAG_SIZE = {
  sm: 'h-5 gap-1 px-1.5 text-xs has-data-[slot=tag-close]:pr-0.5 [&_svg]:size-3',
  md: 'h-6 gap-1.5 px-2 text-xs has-data-[slot=tag-close]:pr-1 [&_svg]:size-3.5',
  lg: 'h-control-sm gap-1.5 px-2.5 text-label has-data-[slot=tag-close]:pr-1 [&_svg]:size-3.5',
} as const
const AVATAR_SIZE = { sm: 'size-3.5 -ml-0.5 text-[0.5rem]', md: 'size-4 -ml-1 text-[0.5625rem]', lg: 'size-5 -ml-1.5 text-[0.625rem]' } as const
const CLOSE_SIZE = { sm: 'size-4', md: 'size-4.5', lg: 'size-5' } as const

const WHITESPACE = /\s+/
const AVATAR_TINTS = 5
function avatarTint(name: string): number {
  let hash = 0
  for (const char of name)
    hash = (hash * 31 + char.codePointAt(0)!) | 0
  return Math.abs(hash) % AVATAR_TINTS
}

function inOptionOrder(options: ReadonlyArray<{ value: OptionValue }>, values: readonly OptionValue[]): OptionValue[] {
  const rank = new Map(options.map((option, index) => [optionKey(option.value), index]))
  return [...values].sort((left, right) => (rank.get(optionKey(left)) ?? options.length) - (rank.get(optionKey(right)) ?? options.length))
}

function TagAvatar({ name, src, size }: { name: string, src?: string | null | undefined, size: Size }): ReactElement {
  if (src)
    return <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', AVATAR_SIZE[size])} data-slot="tag-avatar" />
  const parts = name.trim().split(WHITESPACE).filter(Boolean)
  const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase() || '?'
  return <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-full font-semibold leading-none', AVATAR_SIZE[size])} data-slot="avatar" data-tint={avatarTint(name)}>{initials}</span>
}

/**
 * A compact label in the Badge tones. Closable tags trail a remove button;
 * checkable tags are toggle buttons that take the choice fill when on.
 */
export function LumiTag(props: TagProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { label, tone, appearance, size: sizeProp, icon, avatar, dot, closable, checkable, checked, disabled, onClose, onCheckedChange, className, children: _children, ...rest } = props
  const size = sizeProp ?? 'md'
  const lead = (
    <>
      {avatar && <TagAvatar name={avatar.name} src={avatar.src} size={size} />}
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" data-slot="tag-dot" />}
      {icon && <LumiIcon name={icon} aria-hidden data-slot="tag-icon" />}
      <span className="min-w-0 truncate">{label}</span>
    </>
  )
  const base = cn('inline-flex max-w-full min-w-0 shrink-0 items-center rounded-item border font-medium whitespace-nowrap transition-colors', TAG_SIZE[size], disabled && 'pointer-events-none opacity-50')
  if (checkable) {
    return (
      <button
        {...rest}
        type="button"
        aria-pressed={Boolean(checked)}
        disabled={disabled ?? undefined}
        data-slot="tag"
        data-checkable=""
        data-state={checked ? 'on' : 'off'}
        data-size={size}
        className={cn(base, 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50', checked ? CHOICE_CLASS : 'border-border bg-transparent text-foreground hover:bg-hover hover:text-hover-foreground', className)}
        onClick={() => onCheckedChange?.(!checked)}
      >
        {lead}
      </button>
    )
  }
  return (
    <span {...rest} data-slot="tag" data-tone={tone ?? 'neutral'} data-appearance={appearance ?? 'soft'} data-size={size} aria-disabled={disabled || undefined} className={cn(base, className)}>
      {lead}
      {closable && (
        <button
          type="button"
          data-slot="tag-close"
          aria-label={t('lumi.tag.remove', 'Remove {label}', { label })}
          disabled={disabled ?? undefined}
          className={cn('-my-px grid shrink-0 cursor-pointer place-items-center rounded-sm opacity-70 outline-none transition-opacity hover:bg-current/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50', CLOSE_SIZE[size])}
          onClick={() => onClose?.()}
        >
          <XIcon aria-hidden />
        </button>
      )}
    </span>
  )
}

const EMPTY: OptionValue[] = []

/**
 * Tags bound to an array. Plain values are removable tags; with `options` the
 * tags become chips that toggle their value in and out of the array.
 */
export function LumiTagGroup(props: TagGroupProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = EMPTY, onChange, options, multiple, labels, tone, appearance, size, closable, empty, disabled, ariaLabel, className, children: _children, 'aria-label': hostLabel, ...rest } = props
  const [current, setCurrent] = useControllableValue<readonly OptionValue[]>(value, defaultValue, next => onChange?.([...next]))
  const root = useRef<HTMLDivElement>(null)
  // After a remove, focus moves to the tag that took its place so keyboard users stay in the row.
  const pendingFocus = useRef<number | null>(null)
  useEffect(() => {
    if (pendingFocus.current === null)
      return
    const buttons = root.current?.querySelectorAll<HTMLElement>('[data-slot="tag-close"]') ?? []
    const target = buttons[Math.min(pendingFocus.current, buttons.length - 1)]
    ;(target ?? root.current)?.focus()
    pendingFocus.current = null
  }, [current])
  const items = current ?? EMPTY
  const shared = { tone, appearance, size }
  let body: ReactNode
  if (options?.length) {
    body = options.map((option) => {
      const on = items.some(item => optionKey(item) === optionKey(option.value))
      return (
        <LumiTag
          key={optionKey(option.value)}
          label={option.label}
          icon={option.icon}
          size={size}
          checkable
          checked={on}
          disabled={disabled || option.disabled}
          onCheckedChange={(next) => {
            if (multiple === false)
              setCurrent(next ? [option.value] : [])
            else
              setCurrent(next ? inOptionOrder(options, [...items, option.value]) : items.filter(item => optionKey(item) !== optionKey(option.value)))
          }}
        />
      )
    })
  }
  else if (items.length) {
    body = items.map((item, index) => (
      <LumiTag
        key={optionKey(item)}
        {...shared}
        label={labels?.[String(item)] ?? String(item)}
        closable={closable !== false && !disabled}
        disabled={disabled}
        onClose={() => {
          pendingFocus.current = index
          setCurrent(items.filter((_, position) => position !== index))
        }}
      />
    ))
  }
  else {
    body = <span className="text-meta text-muted-foreground" data-slot="tag-group-empty">{empty ?? t('lumi.tagGroup.empty', 'No tags')}</span>
  }
  return (
    <div {...rest} ref={root} tabIndex={-1} role="group" aria-label={ariaLabel ?? hostLabel} aria-disabled={disabled || undefined} data-slot="tag-group" className={cn('flex flex-wrap items-center gap-1.5 outline-none', className)}>
      {body}
    </div>
  )
}
