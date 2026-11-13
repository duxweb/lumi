import type { ReactElement } from 'react'
import type { BreadcrumbItem as BreadcrumbEntry, BreadcrumbProps } from '../catalog/types-public.js'
import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import { Fragment } from 'react'
import { MoreHorizontalIcon, useOutlineIcon } from '../icons.js'
import { POPOVER_LAYER } from '../internal/layers.js'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '../internal/shadcn/breadcrumb.js'
import { cn } from '../internal/utils.js'
import { MENU_PANEL_CLASS, OPTION_CLASS } from './control.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'data-testid'?: string
  'aria-label'?: string
}

const CRUMB_CLASS = 'inline-flex max-w-48 items-center gap-1.5 rounded-item outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

function CrumbLabel({ item }: { item: BreadcrumbEntry }): ReactElement {
  const Icon = useOutlineIcon(item.icon ?? undefined)
  return (
    <>
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
      <span className="truncate">{item.label}</span>
    </>
  )
}

function Crumb({ item, current, onSelect }: { item: BreadcrumbEntry, current: boolean, onSelect: (key: string) => void }): ReactElement {
  if (current)
    return <BreadcrumbPage className={CRUMB_CLASS} title={item.label}><CrumbLabel item={item} /></BreadcrumbPage>
  if (item.href)
    return <BreadcrumbLink href={item.href} className={CRUMB_CLASS} title={item.label}><CrumbLabel item={item} /></BreadcrumbLink>
  return (
    <BreadcrumbLink asChild className={cn(CRUMB_CLASS, 'cursor-pointer')}>
      <button type="button" title={item.label} onClick={() => onSelect(item.key)}><CrumbLabel item={item} /></button>
    </BreadcrumbLink>
  )
}

function Overflow({ items, onSelect }: { items: BreadcrumbEntry[], onSelect: (key: string) => void }): ReactElement {
  const { t } = useUiText()
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger
        data-slot="breadcrumb-overflow"
        aria-label={t('lumi.breadcrumb.more', 'Show {count} more', { count: items.length })}
        className="inline-flex size-control-xs items-center justify-center rounded-item outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-hover data-[state=open]:text-foreground"
      >
        <MoreHorizontalIcon aria-hidden className="size-4" />
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          data-slot="menu"
          align="start"
          sideOffset={4}
          style={POPOVER_LAYER}
          className={cn('flex flex-col rounded-overlay text-popover-foreground outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95', MENU_PANEL_CLASS)}
        >
          {items.map(item => (
            <MenuPrimitive.Item
              key={item.key}
              asChild={Boolean(item.href)}
              onSelect={item.href ? undefined : () => onSelect(item.key)}
              className={cn(OPTION_CLASS, 'cursor-default data-[highlighted]:bg-hover data-[highlighted]:text-hover-foreground')}
            >
              {item.href ? <a href={item.href}><CrumbLabel item={item} /></a> : <span className="contents"><CrumbLabel item={item} /></span>}
            </MenuPrimitive.Item>
          ))}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

/**
 * The path to the current page. Items with `href` are links; the rest report
 * their key so the page decides where to go. Past `maxItems` the middle of the
 * path folds into a menu, keeping the root and the nearest ancestors in view.
 */
export function LumiBreadcrumb(props: BreadcrumbProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { items, maxItems, separator, onSelect, className, 'data-testid': testId, 'aria-label': ariaLabel } = props
  const limit = Math.max(3, maxItems ?? 4)
  const select = (key: string): void => onSelect?.(key)
  const folded = items.length > limit
  const tailCount = limit - 2
  const head = folded ? items.slice(0, 1) : items
  const hidden = folded ? items.slice(1, items.length - tailCount) : []
  const tail = folded ? items.slice(items.length - tailCount) : []
  const divider = <BreadcrumbSeparator>{separator === 'slash' ? <span className="px-0.5">/</span> : undefined}</BreadcrumbSeparator>
  const render = (item: BreadcrumbEntry, index: number, last: boolean): ReactElement => (
    <Fragment key={item.key}>
      {index > 0 && divider}
      <BreadcrumbItem><Crumb item={item} current={last} onSelect={select} /></BreadcrumbItem>
    </Fragment>
  )
  return (
    <Breadcrumb aria-label={ariaLabel ?? t('lumi.breadcrumb.label', 'Breadcrumb')} className={cn('min-w-0', className)} data-testid={testId}>
      <BreadcrumbList>
        {head.map((item, index) => render(item, index, !folded && index === items.length - 1))}
        {folded && (
          <>
            {divider}
            <BreadcrumbItem><Overflow items={hidden} onSelect={select} /></BreadcrumbItem>
            {tail.map((item, index) => render(item, index + 1, index === tail.length - 1))}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
