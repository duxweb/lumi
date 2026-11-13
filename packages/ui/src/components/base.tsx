import type { ComponentType, CSSProperties, ReactElement, ReactNode } from 'react'
import type { ButtonProps, CardProps, FragmentProps, GridProps, HeadingProps, ProgressProps, SeparatorProps, StackProps, Tab, TabsProps } from '../catalog/types-public.js'
import { Children, Fragment } from 'react'
import { useOutlineIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../internal/shadcn/card.js'
import { Separator } from '../internal/shadcn/separator.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../internal/shadcn/tabs.js'
import { cn } from '../internal/utils.js'
import { LumiSegmentBar } from './segments.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string }

const appearanceMap = {
  solid: 'default',
  brand: 'brand',
  soft: 'secondary',
  outline: 'outline',
  ghost: 'ghost',
  link: 'link',
  danger: 'destructive',
} as const

const sizeMap = { sm: 'sm', md: 'default', lg: 'lg' } as const

/**
 * Grouping with no surface of its own. A bare React Fragment cannot carry the
 * protocol's `layout` props — the renderer refuses one that tries — so this
 * renders them: `stack` is a column, `split` puts the last child in an aside of
 * `asideWidth` and gives the rest the remaining measure.
 */
export function LumiFragment(props: FragmentProps & HostProps): ReactElement {
  const { layout, asideWidth, children, className, ...rest } = props
  if (!layout)
    return <Fragment>{children}</Fragment>
  const items = Children.toArray(children)
  if (layout === 'split' && items.length > 1) {
    const aside = items.at(-1)
    // Both directions are breakpoint variants: a later stylesheet's plain `flex-col` (the Admin
    // build) would otherwise beat `md:flex-row` and keep the split stacked on every screen.
    return (
      <div {...rest} className={cn('flex min-w-0 gap-4 max-md:flex-col md:items-start', className)} data-slot="fragment" data-layout="split">
        <div className="flex min-w-0 grow flex-col gap-4">{items.slice(0, -1)}</div>
        <div className={cn('min-w-0 shrink-0', asideWidth && 'md:w-(--lumi-fragment-aside)')} style={asideWidth ? { '--lumi-fragment-aside': `${asideWidth}px` } as CSSProperties : undefined}>{aside}</div>
      </div>
    )
  }
  return <div {...rest} className={cn('flex min-w-0 flex-col gap-4', className)} data-slot="fragment" data-layout="stack">{children}</div>
}

const GAP = { none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6', xl: 'gap-8' } as const
const GAP_SIZE = { none: '0px', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem' } as const
const GRID_MIN_COLUMN = '12rem'
const ALIGN = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' } as const
const JUSTIFY = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around' } as const

export function LumiStack(props: StackProps & HostProps): ReactElement {
  const { direction, gap, align, justify, wrap, children, className, ...rest } = props
  const horizontal = direction === 'horizontal'
  return (
    <div
      {...rest}
      data-slot="stack"
      data-direction={horizontal ? 'horizontal' : 'vertical'}
      className={cn('flex min-w-0', horizontal ? 'flex-row' : 'flex-col', GAP[gap ?? 'md'], align ? ALIGN[align] : horizontal && 'items-center',
        // A column stretches fields to its width; a button keeps its own width unless asked.
        !horizontal && !align && '[&>[data-slot=button]]:self-start', justify && JUSTIFY[justify], wrap && 'flex-wrap', className)}
    >
      {children}
    </div>
  )
}

export function LumiGrid(props: GridProps & HostProps): ReactElement {
  const { columns, gap, minColumnWidth, align, children, className, ...rest } = props
  const count = columns ?? 2
  // Columns follow the grid's own width, not the viewport, so a grid inside a
  // drawer, a card or an embedded preview keeps its columns while it has room
  // and drops them one at a time below GRID_MIN_COLUMN per track.
  const style = minColumnWidth
    ? { gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}px), 1fr))` }
    : { gridTemplateColumns: count === 1 ? 'minmax(0, 1fr)' : `repeat(auto-fill, minmax(min(100%, max(${GRID_MIN_COLUMN}, (100% - ${count - 1} * ${GAP_SIZE[gap ?? 'md']}) / ${count})), 1fr))` }
  return (
    <div
      {...rest}
      data-slot="grid"
      className={cn('grid min-w-0', align === 'stretch' ? 'items-stretch' : 'items-start', GAP[gap ?? 'md'], className)}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * A native `<progress>` carries the value for assistive tech and tests; the
 * visible meter is the shared segment bar, so progress reads like every other
 * proportion in the product.
 */
export function LumiProgress(props: ProgressProps & HostProps): ReactElement {
  const { value, max, label, tone, children: _children, className, 'aria-label': ariaLabel, ...rest } = props
  const limit = max && max > 0 ? max : 100
  const current = value == null ? 0 : Math.min(Math.max(value, 0), limit)
  const bar = (
    <span {...(label ? {} : rest)} data-slot="progress-meter" className={cn('relative block w-full', !label && className)}>
      <progress
        data-slot="progress"
        data-tone={tone ?? 'default'}
        max={limit}
        value={value == null ? undefined : current}
        aria-label={ariaLabel ?? label ?? undefined}
        className="sr-only"
      />
      <LumiSegmentBar value={current} max={limit} tone={tone ?? 'default'} />
    </span>
  )
  if (!label)
    return bar
  return (
    <div {...rest} data-slot="progress-field" className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="flex items-baseline justify-between gap-3 text-[length:var(--lumi-fs-meta)] text-muted-foreground">
        <span>{label}</span>
        {value != null && <span className="tabular-nums">{`${Math.round((current / limit) * 100)}%`}</span>}
      </span>
      {bar}
    </div>
  )
}

export function LumiSeparator(props: SeparatorProps & HostProps): ReactElement {
  const { orientation, children: _children, ...rest } = props
  return <Separator {...rest} orientation={orientation ?? 'horizontal'} />
}

const HEADING = {
  h1: 'text-[length:var(--lumi-fs-page)] font-semibold',
  h2: 'text-[length:var(--lumi-fs-section)] font-semibold',
  h3: 'text-[length:var(--lumi-fs-title)] font-semibold',
  h4: 'text-[length:var(--lumi-fs-label)] font-semibold',
} as const

export function LumiHeading(props: HeadingProps & HostProps): ReactElement {
  const { text: value, level, children, className, ...rest } = props
  const Tag = level ?? 'h2'
  return <Tag {...rest} data-slot="heading" className={cn('m-0 text-foreground', HEADING[Tag], className)}>{value ?? children}</Tag>
}

export function LumiButton(props: ButtonProps & HostProps): ReactElement {
  const { appearance = 'solid', size = 'md', shape = 'default', loading, icon, iconPosition = 'left', block, href, label, children, disabled, onClick, type = 'button', ...rest } = props
  const Icon = useOutlineIcon(icon)
  const unavailable = Boolean(disabled || loading)
  // Circle and square buttons hold one icon; the label names it for assistive
  // technology instead of spilling out of the fixed square.
  const iconOnly = (shape === 'circle' || shape === 'square') && Boolean(Icon)
  const iconLabel = iconOnly && typeof label === 'string' && !rest['aria-label'] ? { 'aria-label': label, 'title': label } : {}
  // The spinner takes the leading icon's place, so a loading button keeps its width.
  const leadingIcon = Icon && !loading && (iconOnly || iconPosition === 'left')
  const trailingIcon = Icon && !iconOnly && iconPosition === 'right'
  const content = (
    <>
      {loading && <Spinner data-icon="inline-start" />}
      {leadingIcon && <Icon aria-hidden data-icon="inline-start" />}
      {iconOnly ? null : (label ?? children)}
      {trailingIcon && <Icon aria-hidden data-icon="inline-end" />}
    </>
  )
  const className = [props.className, block ? 'w-full' : undefined, shape === 'pill' ? 'rounded-full' : undefined].filter(Boolean).join(' ')
  if (href) {
    return (
      <Button asChild variant={appearanceMap[appearance]} size={sizeMap[size]} className={className}>
        <a
          {...rest}
          {...iconLabel}
          href={unavailable ? undefined : href}
          aria-disabled={unavailable || undefined}
          tabIndex={unavailable ? -1 : undefined}
          data-lumi-control-size={size}
          data-lumi-shape={shape}
          onClick={(event) => {
            if (unavailable) {
              event.preventDefault()
              event.stopPropagation()
              return
            }
            onClick?.()
          }}
        >
          {content}
        </a>
      </Button>
    )
  }
  return <Button {...rest} {...iconLabel} type={type} className={className} variant={appearanceMap[appearance]} size={shape === 'circle' || shape === 'square' ? 'icon' : sizeMap[size]} disabled={unavailable} data-lumi-control-size={size} data-lumi-shape={shape} onClick={onClick}>{content}</Button>
}

/**
 * Host-side composition slot. Absent from CardProps, so a JSON document can
 * never reach it — only a host composing elements can.
 */
interface CardSlots {
  /** Rides the header's trailing edge, e.g. a total chip or a range picker. */
  headerEnd?: ReactNode
}

export function LumiCard(props: CardProps & CardSlots & HostProps): ReactElement {
  const { title, description, appearance, icon, href, headerEnd, children, className, ...rest } = props
  const Icon = useOutlineIcon(icon ?? undefined)
  // A link card stretches its title link over the surface, so the card reads as one target.
  const heading = href
    ? <a href={href} className="text-inherit no-underline outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring">{title}</a>
    : title
  const text = (
    <>
      {title && <CardTitle>{heading}</CardTitle>}
      {description && <CardDescription>{description}</CardDescription>}
    </>
  )
  return (
    <Card {...rest} className={cn(href && 'relative transition-colors hover:bg-muted', className)} data-appearance={appearance ?? 'outline'} {...(href ? { 'data-link': '' } : {})}>
      {(title || description || headerEnd || Icon) && (
        <CardHeader className={Icon ? 'flex items-center gap-3' : undefined}>
          {Icon
            ? (
                <>
                  <span data-slot="card-icon" className="grid size-8.5 shrink-0 place-items-center rounded-(--lumi-radius-control) border border-border bg-muted text-(--lumi-fg-secondary)">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-0.5">{text}</div>
                </>
              )
            : text}
          {headerEnd && <CardAction>{headerEnd}</CardAction>}
        </CardHeader>
      )}
      {/* A Spec drops children straight into the card, so the body spaces them itself. */}
      {Children.count(children) > 0 && <CardContent className="flex min-w-0 flex-col gap-4 [&>[data-slot=button]]:self-start">{children}</CardContent>}
    </Card>
  )
}

export function LumiTabs(props: TabsProps & HostProps): ReactElement {
  const { value, defaultValue, onChange, items, children, 'aria-label': ariaLabel, ...rest } = props
  const initial = defaultValue ?? items.find(item => !item.disabled)?.value
  const childArray = Children.toArray(children)
  return (
    <Tabs {...rest} value={value} defaultValue={initial} onValueChange={onChange}>
      <TabsList aria-label={ariaLabel}>{items.map(item => <TabsTrigger key={item.value} value={item.value} disabled={item.disabled}>{item.label}</TabsTrigger>)}</TabsList>
      {items.map((item: Tab, index) => <TabsContent key={item.value} value={item.value}>{item.content ?? childArray?.[index]}</TabsContent>)}
    </Tabs>
  )
}

export type LumiComponent = ComponentType<Record<string, unknown>>
