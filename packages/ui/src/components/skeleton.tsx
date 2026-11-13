import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { Size, SkeletonProps } from '../catalog/types-public.js'
import { cn } from '../internal/utils.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string }

export interface SkeletonShapeProps {
  'className'?: string
  'style'?: CSSProperties
  'animated'?: boolean
  'data-slot'?: string
}

/**
 * One placeholder block. The shimmer lives in the stylesheet under
 * `[data-skeleton]`, so other components (table rows) can reuse the same look.
 */
export function LumiSkeletonShape({ className, style, animated = true, ...rest }: SkeletonShapeProps): ReactElement {
  return <span aria-hidden data-slot={rest['data-slot'] ?? 'skeleton-shape'} data-skeleton={animated ? 'shimmer' : 'static'} className={cn('block shrink-0', className)} style={style} />
}

// Paragraph lines are never one length; the last one is visibly short.
const LINE_WIDTHS = ['100%', '94%', '97%', '88%', '92%', '85%']
const LAST_LINE = '62%'
const LINE = { sm: 'h-2.5', md: 'h-3', lg: 'h-3.5' } as const
const LINE_GAP = { sm: 'gap-2', md: 'gap-2.5', lg: 'gap-3' } as const
const CIRCLE = { sm: 'size-control-sm', md: 'size-control-md', lg: 'size-control-lg' } as const
const RECT_HEIGHT = { sm: '5rem', md: '8rem', lg: '12rem' } as const
// Row titles and subtitles vary per row so a stack of them reads as a list.
const ROW_WIDTHS = [['42%', '68%'], ['55%', '80%'], ['36%', '62%'], ['48%', '74%']] as const

function lineWidth(index: number, count: number): string {
  return count > 1 && index === count - 1 ? LAST_LINE : LINE_WIDTHS[index % LINE_WIDTHS.length]!
}

export function LumiSkeleton(props: SkeletonProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { variant, lines, size: sizeProp, width, height, animated, label, className, children: _children, ...rest } = props
  const kind = variant ?? 'text'
  const size: Size = sizeProp ?? 'md'
  const shimmer = animated !== false
  let body: ReactNode
  if (kind === 'circle') {
    body = <LumiSkeletonShape animated={shimmer} className={cn('rounded-full', !width && !height && CIRCLE[size])} style={width || height ? { width: width ?? height ?? undefined, height: height ?? width ?? undefined } : undefined} />
  }
  else if (kind === 'rect') {
    body = <LumiSkeletonShape animated={shimmer} className="rounded-control" style={{ width: width ?? '100%', height: height ?? RECT_HEIGHT[size] }} />
  }
  else if (kind === 'list-row') {
    body = Array.from({ length: lines ?? 3 }, (_, index) => {
      const [title, subtitle] = ROW_WIDTHS[index % ROW_WIDTHS.length]!
      return (
        <span key={index} className="flex items-center gap-3 py-2" data-slot="skeleton-row">
          <LumiSkeletonShape animated={shimmer} className={cn('rounded-full', CIRCLE[size])} />
          <span className={cn('flex min-w-0 flex-1 flex-col', LINE_GAP.sm)}>
            <LumiSkeletonShape animated={shimmer} className={cn('rounded-sm', LINE[size])} style={{ width: title }} />
            <LumiSkeletonShape animated={shimmer} className={cn('rounded-sm', LINE.sm)} style={{ width: subtitle }} />
          </span>
          <LumiSkeletonShape animated={shimmer} className="h-5 w-12 rounded-md" />
        </span>
      )
    })
  }
  else {
    const count = lines ?? 3
    body = Array.from({ length: count }, (_, index) => <LumiSkeletonShape key={index} animated={shimmer} className={cn('rounded-sm', LINE[size])} style={{ width: lineWidth(index, count) }} />)
  }
  return (
    <div
      {...rest}
      role="status"
      aria-busy
      data-slot="skeleton"
      data-variant={kind}
      className={cn('flex min-w-0 flex-col', kind === 'text' && LINE_GAP[size], kind === 'list-row' && 'divide-y divide-border', kind === 'circle' && 'w-fit', className)}
      style={kind === 'text' && width ? { width } : undefined}
    >
      <span className="sr-only">{label ?? t('lumi.skeleton.loading', 'Loading')}</span>
      {body}
    </div>
  )
}
