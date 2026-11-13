import type { ReactElement, ReactNode } from 'react'
import type { AccordionProps, MenuItem, MenuProps, TooltipProps } from '../catalog/types-public.js'
import { Accordion as AccordionPrimitive, DropdownMenu as MenuPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui'
import { Children, isValidElement } from 'react'
import { ChevronDownIcon, useOutlineIcon } from '../icons.js'
import { POPOVER_LAYER, TOOLTIP_LAYER } from '../internal/layers.js'
import { cn } from '../internal/utils.js'
import { LumiButton } from './base.js'
import { MENU_PANEL_CLASS, OPTION_CLASS } from './control.js'

interface HostProps {
  'className'?: string
  'data-testid'?: string
  'aria-label'?: string
  'children'?: ReactNode
}

/** The floating hint surface, shared with the field error tooltip. */
export const TOOLTIP_CLASS = 'max-w-64 rounded-control px-2.5 py-1.5 text-[length:var(--lumi-fs-caption)] text-popover-foreground shadow-md ring-1 ring-foreground/10'

/**
 * A short hint on hover and keyboard focus of its single child. The child
 * keeps its own semantics; the hint is announced as its description.
 */
export function LumiTooltip(props: TooltipProps & HostProps): ReactElement {
  const { content, side, children, className } = props
  const only = Children.toArray(children)
  const trigger = only.length === 1 && isValidElement(only[0]) ? only[0] : <span tabIndex={0}>{children}</span>
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span data-slot="tooltip-trigger" className="inline-flex">{trigger}</span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            data-slot="tooltip"
            side={side ?? 'top'}
            sideOffset={6}
            style={TOOLTIP_LAYER}
            className={cn(TOOLTIP_CLASS, className)}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

function MenuEntry({ item, onSelect }: { item: MenuItem, onSelect: (key: string) => void }): ReactElement {
  const Icon = useOutlineIcon(item.icon ?? undefined)
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      data-tone={item.tone ?? undefined}
      disabled={item.disabled ?? undefined}
      onSelect={() => onSelect(item.key)}
      className={cn(OPTION_CLASS, 'cursor-default data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-hover data-[highlighted]:text-hover-foreground', item.tone === 'danger' && 'text-[color:var(--lumi-text-danger)] data-[highlighted]:text-[color:var(--lumi-text-danger)]')}
    >
      {Icon && <Icon aria-hidden className="size-4 shrink-0 opacity-70" />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.shortcut && <kbd className="ms-4 font-sans text-[length:var(--lumi-fs-caption)] text-muted-foreground">{item.shortcut}</kbd>}
    </MenuPrimitive.Item>
  )
}

/**
 * A button that opens a list of commands. Picking one reports its key — the
 * registry writes it to the bound `value` and emits `select`, so the page
 * decides what each key does through its own actions.
 */
export function LumiMenu(props: MenuProps & HostProps & { onSelect?: (key: string) => void }): ReactElement {
  const { label, icon, appearance, size, shape, align, items, onSelect, className, 'data-testid': testId } = props
  const iconOnly = (shape === 'circle' || shape === 'square') && Boolean(icon)
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger asChild>
        {/* An icon-only trigger takes the label as its spoken name; a labelled
            one trails a chevron so it reads as a menu, not a command. */}
        <LumiButton label={iconOnly ? label : undefined} icon={icon ?? undefined} appearance={appearance ?? 'outline'} size={size ?? 'md'} shape={shape ?? undefined} className={className} data-testid={testId}>
          {iconOnly
            ? null
            : (
                <>
                  {label}
                  <ChevronDownIcon aria-hidden data-icon="inline-end" className="opacity-60" />
                </>
              )}
        </LumiButton>
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          data-slot="menu"
          align={align ?? 'start'}
          sideOffset={4}
          style={POPOVER_LAYER}
          className={cn('flex flex-col rounded-overlay text-popover-foreground outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95', MENU_PANEL_CLASS)}
        >
          {items.map((item, index) => (
            <span key={item.key} className="contents">
              {item.separatorBefore && index > 0 && <MenuPrimitive.Separator className="my-1 h-px bg-border" />}
              {item.group && (index === 0 || items[index - 1]?.group !== item.group) && (
                <MenuPrimitive.Label className="px-inset-sm pt-1.5 pb-1 text-[length:var(--lumi-fs-caption)] text-muted-foreground">{item.group}</MenuPrimitive.Label>
              )}
              <MenuEntry item={item} onSelect={key => onSelect?.(key)} />
            </span>
          ))}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

/** Sections that fold open one at a time, or several when `multiple`. */
export function LumiAccordion(props: AccordionProps & HostProps): ReactElement {
  const { items, multiple, defaultOpen, className, 'data-testid': testId } = props
  const body = items.map(item => (
    <AccordionPrimitive.Item key={item.key} value={item.key} disabled={item.disabled ?? undefined} data-slot="accordion-item" className="border-b border-border last:border-b-0">
      <AccordionPrimitive.Header className="m-0 flex">
        <AccordionPrimitive.Trigger className="group/accordion flex flex-1 items-center justify-between gap-4 py-3.5 text-start text-[length:var(--lumi-fs-label)] font-medium outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40 rounded-item">
          {item.title}
          <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/accordion:rotate-180" />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden text-[length:var(--lumi-fs-label)] text-muted-foreground">
        <p className="m-0 pb-4 leading-relaxed">{item.content}</p>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  ))
  const shared = { 'data-slot': 'accordion', 'data-testid': testId, 'className': cn('w-full', className) }
  return multiple
    ? <AccordionPrimitive.Root {...shared} type="multiple" defaultValue={defaultOpen ?? []}>{body}</AccordionPrimitive.Root>
    : <AccordionPrimitive.Root {...shared} type="single" collapsible defaultValue={defaultOpen?.[0]}>{body}</AccordionPrimitive.Root>
}
