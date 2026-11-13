import type { ReactElement, ReactNode } from 'react'
import type { LoadingProps, Size, SpinnerProps } from '../catalog/types-public.js'
import { cn } from '../internal/utils.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string }

type SpinnerTone = NonNullable<SpinnerProps['tone']>

// Same steps as the Icon sizes, so a spinner can stand in for an icon.
const GLYPH = { sm: 'size-3.5', md: 'size-4', lg: 'size-6' } as const
const TONE: Record<SpinnerTone, string> = {
  default: 'text-current',
  muted: 'text-muted-foreground',
  brand: 'text-brand',
  success: 'text-(--lumi-text-success)',
  warning: 'text-(--lumi-text-warning)',
  danger: 'text-destructive',
  info: 'text-(--lumi-ui-tone-info)',
}
const LABEL = { sm: 'text-xs', md: 'text-control', lg: 'text-sm' } as const

/** The ring: a faint full track with a rotating quarter arc in the current colour. */
export function SpinnerGlyph({ size = 'md', tone = 'default', className }: { size?: Size, tone?: SpinnerTone, className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden data-spinner-glyph="" className={cn('shrink-0 animate-spin', GLYPH[size], TONE[tone], className)}>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="17 60" />
    </svg>
  )
}

export function LumiSpinner(props: SpinnerProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { size: sizeProp, tone, label, showLabel, className, children: _children, ...rest } = props
  const size = sizeProp ?? 'md'
  const name = label ?? t('lumi.spinner.loading', 'Loading')
  return (
    <span {...rest} role="status" data-slot="spinner" data-size={size} data-tone={tone ?? 'default'} className={cn('inline-flex items-center gap-2 align-middle', className)}>
      <SpinnerGlyph size={size} tone={tone ?? 'default'} />
      {showLabel && label ? <span className={cn('text-muted-foreground', LABEL[size])}>{label}</span> : <span className="sr-only">{name}</span>}
    </span>
  )
}

/** A section that is loading: the spinner and its text centred in the space the content will take. */
export function LumiLoading(props: LoadingProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { label, description, size: sizeProp, minHeight, className, children: _children, ...rest } = props
  const size = sizeProp ?? 'lg'
  return (
    <div
      {...rest}
      role="status"
      data-slot="loading"
      className={cn('flex w-full flex-col items-center justify-center gap-2.5 px-4 py-8 text-center', className)}
      style={minHeight ? { minHeight } : undefined}
    >
      <SpinnerGlyph size={size} tone="muted" />
      <span className="flex flex-col items-center gap-1">
        <span className={cn('text-foreground', size === 'sm' ? 'text-xs' : 'text-control')} data-slot="loading-label">{label ?? t('lumi.loading.label', 'Loading…')}</span>
        {description && <span className="max-w-[44ch] text-meta text-muted-foreground" data-slot="loading-description">{description}</span>}
      </span>
    </div>
  )
}
