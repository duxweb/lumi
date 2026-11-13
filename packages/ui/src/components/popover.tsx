import type { ReactElement, ReactNode, RefObject } from 'react'
import type { PopconfirmProps, PopoverProps } from '../catalog/types-public.js'
import { Children, useEffect, useId, useRef } from 'react'
import { ChevronDownIcon, HelpCircleIcon, WarningIcon } from '../icons.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { cn } from '../internal/utils.js'
import { LumiButton } from './base.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'data-testid'?: string
  'aria-label'?: string
  'children'?: ReactNode
}

type TriggerButton = Pick<PopoverProps, 'label' | 'icon' | 'size' | 'shape'> & { appearance?: PopconfirmProps['appearance'] }

const WIDTH = { sm: 'w-64', md: 'w-72', lg: 'w-96' } as const
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * A slot trigger is wrapped in a span, so the open state is mirrored onto the
 * first focusable element inside it — the one a screen reader actually lands on.
 * Static content (an avatar, a badge) makes the span itself the button.
 */
function useMirroredExpanded(ref: RefObject<HTMLSpanElement | null>, open: boolean, popup: 'dialog', name: string | undefined): void {
  useEffect(() => {
    const span = ref.current
    if (!span)
      return
    let target = span.querySelector<HTMLElement>(FOCUSABLE)
    if (!target) {
      span.tabIndex = 0
      span.setAttribute('role', 'button')
      if (name)
        span.setAttribute('aria-label', name)
      target = span
    }
    target.setAttribute('aria-haspopup', popup)
    target.setAttribute('aria-expanded', String(open))
    if (target !== span) {
      // The trigger sets these on the wrapper too, where a role-less span may not carry them.
      const controls = span.getAttribute('aria-controls')
      if (controls)
        target.setAttribute('aria-controls', controls)
      for (const attribute of ['aria-haspopup', 'aria-expanded', 'aria-controls'])
        span.removeAttribute(attribute)
    }
  }, [ref, open, popup, name])
}

function Trigger({ slot, button, open, name, chevron = true, className, testId }: { slot: ReactNode, button: TriggerButton, open: boolean, name?: string | undefined, chevron?: boolean, className?: string | undefined, testId?: string | undefined }): ReactElement {
  const ref = useRef<HTMLSpanElement>(null)
  useMirroredExpanded(ref, open, 'dialog', name)
  if (Children.count(slot)) {
    return (
      <PopoverTrigger asChild>
        <span
          ref={ref}
          data-slot="popover-trigger"
          className={cn('inline-flex rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring/50', className)}
          data-testid={testId}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              event.currentTarget.click()
            }
          }}
        >
          {slot}
        </span>
      </PopoverTrigger>
    )
  }
  const iconOnly = (button.shape === 'circle' || button.shape === 'square') && Boolean(button.icon)
  return (
    <PopoverTrigger asChild>
      <LumiButton label={iconOnly ? button.label ?? undefined : undefined} icon={button.icon ?? undefined} appearance={button.appearance ?? 'outline'} size={button.size ?? 'md'} shape={button.shape ?? undefined} className={className} data-testid={testId}>
        {iconOnly
          ? null
          : (
              <>
                {button.label}
                {chevron ? <ChevronDownIcon aria-hidden data-icon="inline-end" className="opacity-60" /> : null}
              </>
            )}
      </LumiButton>
    </PopoverTrigger>
  )
}

const PANEL_CLASS = 'gap-3 max-h-[min(36rem,var(--radix-popover-content-available-height))] overflow-y-auto'

/**
 * A floating panel anchored to a trigger. The trigger is a host slot or a
 * button built from the label props; footer actions report through
 * `onConfirm`/`onCancel` and close the panel.
 */
export function LumiPopover(props: PopoverProps & HostProps & { trigger?: ReactNode, footer?: ReactNode }): ReactElement {
  const { label, icon, appearance, size, shape, title, description, side, align, width, open, defaultOpen, confirmText, cancelText, tone, onOpenChange, onConfirm, onCancel, trigger, footer, children, className, 'data-testid': testId, 'aria-label': ariaLabel } = props
  const [current, setOpen] = useControllableValue(open ?? undefined, defaultOpen ?? false, onOpenChange)
  const titleId = useId()
  const descriptionId = useId()
  const hasFooter = Boolean(confirmText || cancelText || Children.count(footer))
  return (
    <Popover open={current} onOpenChange={setOpen}>
      <Trigger slot={trigger} button={{ label, icon, appearance, size, shape }} open={current} name={ariaLabel ?? label ?? title ?? undefined} className={className} testId={testId} />
      <PopoverContent
        data-lumi-popover="panel"
        side={side ?? 'bottom'}
        align={align ?? 'center'}
        sideOffset={6}
        collisionPadding={8}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={title ? undefined : ariaLabel ?? label ?? undefined}
        className={cn(WIDTH[width ?? 'md'], PANEL_CLASS)}
      >
        {(title || description) && (
          <div data-slot="popover-header" className="flex flex-col gap-1">
            {title && <h3 id={titleId} className="m-0 text-[length:var(--lumi-fs-title)] leading-snug font-semibold text-popover-foreground">{title}</h3>}
            {description && <p id={descriptionId} className="m-0 text-[length:var(--lumi-fs-meta)] leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        )}
        {Children.count(children) > 0 && <div data-slot="popover-body" className="flex min-w-0 flex-col gap-2 text-[length:var(--lumi-fs-body)]">{children}</div>}
        {hasFooter && (
          <div data-slot="popover-footer" className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {footer}
            {cancelText && (
              <LumiButton
                size="sm"
                appearance="outline"
                label={cancelText}
                onClick={() => {
                  onCancel?.()
                  setOpen(false)
                }}
              />
            )}
            {confirmText && (
              <LumiButton
                size="sm"
                appearance={tone === 'danger' ? 'danger' : 'solid'}
                label={confirmText}
                onClick={() => {
                  onConfirm?.()
                  setOpen(false)
                }}
              />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

const CONFIRM_ICON = { danger: WarningIcon, warning: WarningIcon, neutral: HelpCircleIcon } as const
const CONFIRM_ICON_TONE = { danger: 'text-destructive', warning: 'text-[color:var(--lumi-text-warning)]', neutral: 'text-muted-foreground' } as const

/**
 * A compact "are you sure?" bubble for an inline destructive action. Opening
 * moves focus to Cancel, the safe choice; dismissing in any way counts as
 * cancel, and focus returns to the trigger.
 */
export function LumiPopconfirm(props: PopconfirmProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { title, description, confirmText, cancelText, tone: toneProp, side, align, open, defaultOpen, disabled, label, icon, appearance, size, shape, onOpenChange, onConfirm, onCancel, children, className, 'data-testid': testId } = props
  const tone = toneProp ?? 'danger'
  const [current, setOpen] = useControllableValue(open ?? undefined, defaultOpen ?? false, onOpenChange)
  const confirmed = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const Icon = CONFIRM_ICON[tone]
  const change = (next: boolean): void => {
    if (disabled && next)
      return
    if (!next && current && !confirmed.current)
      onCancel?.()
    confirmed.current = false
    setOpen(next)
  }
  return (
    <Popover open={current} onOpenChange={change}>
      <Trigger slot={children} button={{ label, icon, appearance: appearance ?? (tone === 'danger' ? 'danger' : 'outline'), size, shape }} open={current} name={props['aria-label'] ?? label ?? undefined} chevron={false} className={className} testId={testId} />
      <PopoverContent
        ref={panelRef}
        role="alertdialog"
        data-lumi-popover="confirm"
        data-tone={tone}
        side={side ?? 'top'}
        align={align ?? 'center'}
        sideOffset={6}
        collisionPadding={8}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-auto max-w-[min(20rem,calc(100vw-1rem))] min-w-56 gap-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          panelRef.current?.querySelector<HTMLElement>('[data-popconfirm="cancel"]')?.focus()
        }}
      >
        <div className="flex items-start gap-2.5">
          <Icon aria-hidden className={cn('mt-px size-4 shrink-0', CONFIRM_ICON_TONE[tone])} />
          <div className="flex min-w-0 flex-col gap-1">
            <p id={titleId} className="m-0 text-[length:var(--lumi-fs-label)] leading-snug font-medium text-popover-foreground">{title}</p>
            {description && <p id={descriptionId} className="m-0 text-[length:var(--lumi-fs-meta)] leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <LumiButton
            data-popconfirm="cancel"
            size="sm"
            appearance="outline"
            label={cancelText ?? t('lumi.common.cancel', 'Cancel')}
            onClick={() => change(false)}
          />
          <LumiButton
            size="sm"
            appearance={tone === 'danger' ? 'danger' : 'solid'}
            label={confirmText ?? t('lumi.common.confirm', 'Confirm')}
            onClick={() => {
              confirmed.current = true
              onConfirm?.()
              change(false)
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
