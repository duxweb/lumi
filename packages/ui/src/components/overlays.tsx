import type { ReactElement, ReactNode } from 'react'
import type { DialogProps, DrawerProps } from '../catalog/types-public.js'
import type { OutlineIconComponent } from '../icons.js'
import { Children, useEffect, useRef } from 'react'
import { CheckCircleIcon, HelpCircleIcon, InfoIcon, LumiIcon, WarningIcon, XIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../internal/shadcn/dialog.js'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../internal/shadcn/drawer.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string }

function useRestoreFocus(open: boolean): { capture: () => void, restore: (event: Event) => void } {
  const focusTarget = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null)
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) {
      const target = focusTarget.current
      if (target?.isConnected)
        queueMicrotask(() => target.focus())
    }
    wasOpen.current = open
  }, [open])
  return {
    capture() {
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body)
        focusTarget.current = document.activeElement
    },
    restore(event) {
      const target = focusTarget.current
      if (!target?.isConnected)
        return
      event.preventDefault()
      queueMicrotask(() => target.focus())
    },
  }
}

/**
 * Host-side composition slots. Absent from DialogProps / DrawerProps, so a JSON
 * document can never reach them — only a host composing elements can.
 */
interface OverlaySlots {
  /** Leading footer content, e.g. an unsaved marker. */
  footerStart?: ReactNode
  /** Trailing footer controls, replacing the declared confirm/cancel pair. */
  footerEnd?: ReactNode
}

type DialogTone = NonNullable<DialogProps['tone']>

const CONFIRM_GLYPH: Partial<Record<DialogTone, OutlineIconComponent>> = {
  danger: WarningIcon,
  warning: WarningIcon,
  info: InfoIcon,
  success: CheckCircleIcon,
}
// The same soft tints as an empty state: the tint behind, the text-safe tier on the glyph.
const CONFIRM_TINT: Partial<Record<DialogTone, string>> = {
  info: 'bg-(--lumi-info)/10 text-(--lumi-text-info)',
  success: 'bg-(--lumi-success)/10 text-(--lumi-text-success)',
  warning: 'bg-(--lumi-warning)/14 text-(--lumi-text-warning)',
  danger: 'bg-(--lumi-danger)/10 text-(--lumi-text-danger)',
}

function ConfirmMedia({ tone, icon, question }: { tone: DialogTone | undefined, icon: string | undefined, question: boolean }): ReactElement {
  // An untoned dialog that offers a way back asks a question; one that only acknowledges informs.
  const Glyph = (tone && CONFIRM_GLYPH[tone]) ?? (question ? HelpCircleIcon : InfoIcon)
  const glyph = <Glyph aria-hidden focusable="false" />
  return (
    <span aria-hidden data-slot="dialog-media" className={cn('flex size-10 shrink-0 items-center justify-center rounded-panel [&_svg]:size-5', (tone && CONFIRM_TINT[tone]) ?? 'bg-muted text-muted-foreground')}>
      {icon ? <LumiIcon name={icon} fallback={glyph} /> : glyph}
    </span>
  )
}

export function LumiDialog(props: DialogProps & OverlaySlots & HostProps): ReactElement {
  const { open, defaultOpen, onOpenChange, title, description, size, tone, icon, confirmText, cancelText, loading, onConfirm, onCancel, footerStart, footerEnd, children, className } = props
  const [currentOpen, setCurrentOpen] = useControllableValue(open, defaultOpen ?? false, onOpenChange)
  const focus = useRestoreFocus(currentOpen)
  // Every way out but the confirm button is a cancel: the Cancel button, the
  // close icon, Escape, a click outside. None of them works while the confirm
  // is still running. `open` is written first, so a `cancel` handler reads it closed.
  const close = (): void => {
    if (loading)
      return
    setCurrentOpen(false)
    onCancel?.()
  }
  const change = (next: boolean): void => {
    if (next)
      setCurrentOpen(true)
    else
      close()
  }
  const hasBody = Children.toArray(children).length > 0
  // Without a body the dialog is a confirmation: one compact block whose own
  // buttons are the way out, so it drops the scrolling band and the close icon.
  const confirm = !hasBody && Boolean(confirmText || cancelText || footerEnd)
  const heading = (
    <>
      <DialogTitle>{title}</DialogTitle>
      {description && <DialogDescription>{description}</DialogDescription>}
    </>
  )
  return (
    <Dialog open={currentOpen} onOpenChange={change}>
      <DialogContent
        className={className}
        data-size={size ?? (confirm ? undefined : 'md')}
        data-layout={confirm ? 'confirm' : undefined}
        data-tone={tone}
        showCloseButton={!confirm}
        onOpenAutoFocus={focus.capture}
        onCloseAutoFocus={focus.restore}
      >
        <DialogHeader>
          {confirm && icon !== false
            ? (
                <>
                  <ConfirmMedia tone={tone} icon={icon} question={Boolean(cancelText)} />
                  {/* Short text centres on the icon; taller text hangs from its top edge. */}
                  <div data-slot="dialog-heading" className="flex min-h-10 min-w-0 flex-1 flex-col justify-center gap-1">{heading}</div>
                </>
              )
            : heading}
        </DialogHeader>
        {/* Three bands: the header names it, the body scrolls, the footer keeps
            the commit in reach however long the body runs. */}
        {/* The body scrolls on its own, so it must be reachable by keyboard. */}
        {hasBody && <div tabIndex={0} className="overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" data-slot="lumi-overlay-body">{children}</div>}
        {(confirmText || cancelText || footerStart || footerEnd) && (
          <DialogFooter>
            {footerStart && <div className="mr-auto flex items-center gap-2">{footerStart}</div>}
            {footerEnd ?? (
              <>
                {cancelText && <Button type="button" variant="outline" disabled={loading} onClick={close}>{cancelText}</Button>}
                {confirmText && (
                  <Button type="button" variant={tone === 'danger' ? 'destructive' : 'default'} disabled={loading} onClick={onConfirm}>
                    {loading && <Spinner data-icon="inline-start" />}
                    {confirmText}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function LumiDrawer(props: DrawerProps & OverlaySlots & HostProps): ReactElement {
  const { t } = useUiText()
  const { open, defaultOpen, onOpenChange, title, description, side = 'right', size = 'md', footerStart, footerEnd, children, className } = props
  const [currentOpen, setCurrentOpen] = useControllableValue(open, defaultOpen ?? false, onOpenChange)
  const focus = useRestoreFocus(currentOpen)
  return (
    <Drawer open={currentOpen} onOpenChange={setCurrentOpen} direction={side}>
      <DrawerContent className={cn('outline-none', className)} data-size={size} onOpenAutoFocus={focus.capture} onCloseAutoFocus={focus.restore}>
        <DrawerClose asChild><Button type="button" variant="ghost" size="icon-sm" className="absolute" aria-label={t('lumi.drawer.close', 'Close drawer')}><XIcon className="size-4" /></Button></DrawerClose>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        {/* The body scrolls on its own, so it must be reachable by keyboard. */}
        <div tabIndex={0} className="min-h-0 flex-1 overflow-y-auto p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" data-slot="lumi-overlay-body">{children}</div>
        {/* The commit keeps the trailing edge whether or not footerStart is showing. */}
        {(footerStart || footerEnd) && (
          <DrawerFooter className="flex-row items-center justify-end">
            {footerStart && <div className="mr-auto flex items-center gap-2">{footerStart}</div>}
            {footerEnd}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}
