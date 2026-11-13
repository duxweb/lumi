import type { ReactElement, ReactNode } from 'react'
import type { EmptyProps } from '../catalog/types-public.js'
import { Children } from 'react'
import { InboxIcon, LumiIcon } from '../icons.js'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../internal/shadcn/empty.js'
import { cn } from '../internal/utils.js'
import { useUiText } from './text.js'

type EmptySize = NonNullable<EmptyProps['size']>
type EmptyTone = NonNullable<EmptyProps['tone']>

interface HostProps {
  'className'?: string
  'children'?: ReactNode
  'data-testid'?: string
  'aria-label'?: string
  'id'?: string
  /** `status` makes the message a polite live region, `alert` an assertive one; omitted, it is plain content. */
  'role'?: 'status' | 'alert'
}

export type LumiEmptyProps = Omit<EmptyProps, 'description' | 'icon'> & HostProps & {
  /** Plain text in JSON; a React host may pass several lines. */
  description?: ReactNode
  /** A HugeIcons name, or an icon element the host already holds. */
  icon?: string | ReactElement | null
  /** Speaks the title as a heading of this level, for a state that stands in for a whole page or region. */
  headingLevel?: 2 | 3 | 4
}

const ROOT: Record<EmptySize, string | undefined> = {
  xs: 'gap-2 px-3 py-3',
  sm: undefined,
  md: 'gap-4 px-6 py-12',
}
const HEADER: Record<EmptySize, string | undefined> = {
  xs: 'max-w-none flex-row flex-wrap justify-center gap-x-1.5 gap-y-0.5',
  sm: undefined,
  md: undefined,
}
// A state that stands for the whole page titles it like a page section.
const TITLE: Record<EmptySize, string | undefined> = {
  xs: 'text-(length:--lumi-fs-label) font-normal text-muted-foreground',
  sm: undefined,
  md: 'text-(length:--lumi-fs-section) leading-6 font-semibold',
}
const MEDIA: Record<EmptySize, string | undefined> = {
  xs: 'mb-0 [&_svg:not([class*=\'size-\'])]:size-4',
  sm: undefined,
  md: 'mb-3 size-12 [&_svg:not([class*=\'size-\'])]:size-6',
}
// The tint sits behind the glyph; the glyph itself takes the text-safe tier.
const TINT: Record<EmptyTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-(--lumi-info)/10 text-(--lumi-text-info)',
  success: 'bg-(--lumi-success)/10 text-(--lumi-text-success)',
  warning: 'bg-(--lumi-warning)/14 text-(--lumi-text-warning)',
  danger: 'bg-(--lumi-danger)/10 text-(--lumi-text-danger)',
}
const GLYPH: Record<EmptyTone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-(--lumi-text-info)',
  success: 'text-(--lumi-text-success)',
  warning: 'text-(--lumi-text-warning)',
  danger: 'text-(--lumi-text-danger)',
}

/**
 * Says why an area is empty and what to do next: a glyph on a soft tint, a
 * title, a quieter description and an optional way forward. `sm` stands in
 * for rows inside a table, card or panel; `md` for a whole page; `xs` is one
 * quiet line for option panels and narrow columns, so a dropdown stays short.
 */
export function LumiEmpty(props: LumiEmptyProps): ReactElement {
  const { t } = useUiText()
  const { title, description, icon, tone: toneProp, size: sizeProp, headingLevel, className, children, ...rest } = props
  const size = sizeProp ?? 'sm'
  const tone = toneProp ?? 'neutral'
  const glyph = typeof icon === 'string' || icon == null
    ? <LumiIcon name={icon ?? 'inbox'} fallback={<InboxIcon aria-hidden focusable="false" />} />
    : icon
  return (
    <Empty {...rest} data-size={size} data-tone={tone} className={cn(ROOT[size], className)}>
      <EmptyHeader className={HEADER[size]}>
        <EmptyMedia aria-hidden variant={size === 'xs' ? 'default' : 'icon'} className={cn(MEDIA[size], size === 'xs' ? GLYPH[tone] : TINT[tone])}>
          {glyph}
        </EmptyMedia>
        <EmptyTitle
          role={headingLevel ? 'heading' : undefined}
          aria-level={headingLevel}
          className={TITLE[size]}
        >
          {title ?? t('lumi.empty.title', 'No data')}
        </EmptyTitle>
        {description !== undefined && description !== null && description !== '' && (
          <EmptyDescription className={size === 'xs' ? 'basis-full text-(length:--lumi-fs-caption)' : undefined}>{description}</EmptyDescription>
        )}
      </EmptyHeader>
      {Children.count(children) > 0 && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  )
}
