import type { ReactElement, ReactNode } from 'react'
import type { AvatarGroupProps, AvatarProps } from '../catalog/types-public.js'
import { cn } from '../internal/utils.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'role'?: string }

const WHITESPACE = /\s+/
// Avatars line up with the control beside them: sm/md/lg match the control heights.
// xl leads a profile header, two control rows tall.
const avatarSize = { sm: 'size-control-sm text-[0.625rem]', md: 'size-control-md text-xs', lg: 'size-control-lg text-label', xl: 'size-[calc(var(--lumi-control-md)*2)] text-(length:--lumi-fs-page)' } as const

// A name always gets the same tint, so a person is recognisable across pages.
const AVATAR_TINTS = 5
function avatarTint(name: string): number {
  let hash = 0
  for (const char of name)
    hash = (hash * 31 + char.codePointAt(0)!) | 0
  return Math.abs(hash) % AVATAR_TINTS
}

function initials(name: string): string {
  const parts = name.trim().split(WHITESPACE).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase() || '?'
}

export function LumiAvatar(props: AvatarProps & HostProps): ReactElement {
  const { name, src, description, showName, size: sizeProp, className, children: _children, role: _role, ...rest } = props
  const size = sizeProp ?? 'md'
  const mark = src
    ? <img src={src} alt={showName ? '' : name} className={cn('shrink-0 rounded-full object-cover', avatarSize[size])} data-slot="avatar" />
    : (
        <span role={showName ? undefined : 'img'} aria-label={showName ? undefined : name} aria-hidden={showName || undefined} className={cn('grid shrink-0 place-items-center rounded-full font-medium', avatarSize[size])} data-slot="avatar" data-tint={avatarTint(name)}>
          {initials(name)}
        </span>
      )
  if (!showName)
    return <span {...rest} className={cn('inline-flex', className)}>{mark}</span>
  return (
    <span {...rest} className={cn('inline-flex min-w-0 items-center gap-2.5', className)} data-slot="avatar-persona">
      {mark}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        {description && <span className="truncate text-[length:var(--lumi-fs-caption)] text-muted-foreground">{description}</span>}
      </span>
    </span>
  )
}

export function LumiAvatarGroup(props: AvatarGroupProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { items, max, size: sizeProp, label, className, children: _children, role: _role, ...rest } = props
  const size = sizeProp ?? 'md'
  const shown = max && items.length > max ? items.slice(0, max - 1) : items
  const hidden = items.length - shown.length
  return (
    <span
      {...rest}
      role="group"
      aria-label={label ?? items.map(item => item.name).join(', ')}
      className={cn('inline-flex items-center', className)}
      data-slot="avatar-group"
      data-size={size}
    >
      {shown.map(item => <LumiAvatar key={item.name} name={item.name} src={item.src} size={size} />)}
      {hidden > 0 && (
        <span role="img" aria-label={t('lumi.avatar.more', '+{count}', { count: hidden })} className={cn('grid shrink-0 place-items-center rounded-full bg-muted font-medium text-foreground tabular-nums', avatarSize[size])} data-slot="avatar" data-overflow="">
          +
          {hidden}
        </span>
      )}
    </span>
  )
}
