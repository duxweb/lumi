import type { CSSProperties, KeyboardEvent, PointerEvent, ReactElement } from 'react'
import type { ImageProps, LightboxItem, LightboxProps } from '../catalog/types-public.js'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon, XIcon, ZoomInIcon, ZoomOutIcon } from '../icons.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'data-testid'?: string
  'aria-label'?: string
}

type LoadStatus = 'loading' | 'loaded' | 'error'

/** Tracks one image's load, including one already decoded from cache before the listener ran. */
function useImageStatus(src: string): [LoadStatus, (node: HTMLImageElement | null) => void, { onLoad: () => void, onError: () => void }] {
  const [state, setState] = useState<{ src: string, status: LoadStatus }>({ src, status: src ? 'loading' : 'error' })
  const status = state.src === src ? state.status : (src ? 'loading' : 'error')
  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.currentSrc)
      setState({ src, status: node.naturalWidth > 0 ? 'loaded' : 'error' })
  }, [src])
  return [status, ref, { onLoad: () => setState({ src, status: 'loaded' }), onError: () => setState({ src, status: 'error' }) }]
}

const RADIUS = { none: 'rounded-none', sm: 'rounded-item', md: 'rounded-control', lg: 'rounded-panel', full: 'rounded-full' } as const

/** `aspect-ratio` values for the catalog's ratio names; `auto` keeps the image's own. */
export function aspectRatioStyle(ratio: string | null | undefined, fallback = '4/3'): CSSProperties | undefined {
  const value = ratio ?? fallback
  return value === 'auto' ? undefined : { aspectRatio: value.replace('/', ' / ') }
}

export function LumiImage(props: ImageProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { src, alt, aspectRatio, fit, radius, width, caption, preview, className, 'data-testid': testId } = props
  const [status, imageRef, handlers] = useImageStatus(src)
  const [open, setOpen] = useState(false)
  const name = caption || alt || ''
  const ratio = aspectRatioStyle(aspectRatio)
  const frameClass = cn('relative block w-full overflow-hidden bg-muted', RADIUS[radius ?? 'md'])
  const content = (
    <>
      {status === 'loading' && <span aria-hidden data-slot="image-skeleton" className="absolute inset-0 animate-pulse bg-muted motion-reduce:animate-none" />}
      {status === 'error'
        ? (
            <span data-slot="image-fallback" role={alt ? 'img' : undefined} aria-label={alt || undefined} className={cn('flex flex-col items-center justify-center gap-1.5 p-3 text-center text-muted-foreground', ratio ? 'absolute inset-0' : 'min-h-32')}>
              <ImageOffIcon aria-hidden className="size-6 opacity-70" />
              <span className="text-[length:var(--lumi-fs-caption)]">{t('lumi.image.failed', 'Image unavailable')}</span>
            </span>
          )
        : (
            <img
              ref={imageRef}
              src={src}
              alt={alt ?? ''}
              loading="lazy"
              decoding="async"
              {...handlers}
              className={cn('block size-full transition-opacity duration-200 motion-reduce:transition-none', ratio ? 'absolute inset-0' : 'h-auto', fit === 'contain' ? 'object-contain' : 'object-cover', status === 'loaded' ? 'opacity-100' : 'opacity-0')}
            />
          )}
    </>
  )
  return (
    <figure data-slot="image" data-status={status} data-testid={testId} className={cn('m-0 flex w-full min-w-0 flex-col gap-2', className)} style={width ? { maxWidth: `${width}px` } : undefined}>
      {preview && status !== 'error'
        ? (
            <button
              type="button"
              data-slot="image-preview-trigger"
              aria-label={t('lumi.image.preview', 'Preview {name}', { name: name || t('lumi.image.image', 'image') })}
              aria-haspopup="dialog"
              className={cn(frameClass, 'group/image cursor-zoom-in outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid')}
              style={ratio}
              onClick={() => setOpen(true)}
            >
              {content}
              <span aria-hidden data-slot="image-preview-hint" className="absolute end-2 bottom-2 grid size-control-sm place-items-center rounded-full text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover/image:opacity-100 group-focus-visible/image:opacity-100">
                <ZoomInIcon className="size-4" />
              </span>
            </button>
          )
        : <span data-slot="image-frame" className={frameClass} style={ratio}>{content}</span>}
      {caption && <figcaption className="text-[length:var(--lumi-fs-meta)] text-muted-foreground">{caption}</figcaption>}
      {preview && <LumiLightbox items={[{ url: src, alt, caption }]} open={open} onOpenChange={setOpen} />}
    </figure>
  )
}

/* -------------------------------------------------------------------------- */
/* Lightbox                                                                    */
/* -------------------------------------------------------------------------- */

const NO_LIGHTBOX_ITEMS: readonly LightboxItem[] = []
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 1.5
const SWIPE_DISTANCE = 48

interface View { scale: number, x: number, y: number }
const RESET: View = { scale: 1, x: 0, y: 0 }

function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))
}

function LightboxStage({ item, view, onView, onSwipe }: { item: LightboxItem, view: View, onView: (next: View | ((view: View) => View)) => void, onSwipe: (direction: 1 | -1) => void }): ReactElement {
  const { t } = useUiText()
  const [status, imageRef, handlers] = useImageStatus(item.url)
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number, x: number, y: number, view: View } | null>(null)

  // React's wheel listener is passive, and zooming must not scroll the page behind.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage)
      return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      onView((current) => {
        const scale = clampZoom(current.scale * Math.exp(-event.deltaY * 0.0015))
        return scale === 1 ? RESET : { ...current, scale }
      })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [onView])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0)
      return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const start = drag.current
    if (!start || start.id !== event.pointerId || start.view.scale === 1)
      return
    onView({ ...start.view, x: start.view.x + (event.clientX - start.x), y: start.view.y + (event.clientY - start.y) })
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const start = drag.current
    drag.current = null
    if (!start || start.view.scale !== 1)
      return
    const dx = event.clientX - start.x
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(event.clientY - start.y))
      onSwipe(dx < 0 ? 1 : -1)
  }

  return (
    <div
      ref={stageRef}
      data-slot="lightbox-stage"
      data-zoomed={view.scale > 1 || undefined}
      className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null }}
      onDoubleClick={() => onView(current => current.scale > 1 ? RESET : { scale: 2, x: 0, y: 0 })}
    >
      {status === 'loading' && <Spinner aria-label={t('lumi.common.loading', 'Loading...')} className="absolute size-6 text-[color:var(--lumi-lightbox-fg)]" />}
      {status === 'error'
        ? (
            <span role="img" aria-label={item.alt || t('lumi.image.failed', 'Image unavailable')} className="flex flex-col items-center gap-2 text-[color:var(--lumi-lightbox-muted)]">
              <ImageOffIcon aria-hidden className="size-10" />
              <span className="text-[length:var(--lumi-fs-label)]">{t('lumi.image.failed', 'Image unavailable')}</span>
            </span>
          )
        : (
            <img
              key={item.url}
              ref={imageRef}
              src={item.url}
              alt={item.alt ?? ''}
              draggable={false}
              {...handlers}
              data-slot="lightbox-image"
              className={cn('max-h-full max-w-full object-contain', status === 'loaded' ? 'opacity-100' : 'opacity-0', view.scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
              style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
            />
          )}
    </div>
  )
}

const CONTROL_CLASS = 'grid size-control-lg shrink-0 place-items-center rounded-full outline-none transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-[1.125rem]'

/**
 * A full-screen viewer over an image list: zoom by buttons, wheel, keys or a
 * double click, drag to pan a zoomed image, swipe or arrow to step.
 */
export function LumiLightbox(props: LightboxProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { items: inputItems, open, index, loop, onOpenChange, onIndexChange, className, 'data-testid': testId, 'aria-label': ariaLabel } = props
  const [isOpen, setOpen] = useControllableValue(open ?? undefined, false, onOpenChange)
  const [rawIndex, setIndex] = useControllableValue(index ?? undefined, 0, onIndexChange)
  const [view, setView] = useState<View>(RESET)
  const items = inputItems ?? NO_LIGHTBOX_ITEMS
  const count = items.length
  const current = count ? Math.min(Math.max(rawIndex, 0), count - 1) : 0
  const item = items[current]
  const canPrev = count > 1 && (loop || current > 0)
  const canNext = count > 1 && (loop || current < count - 1)

  useLayoutEffect(() => setView(RESET), [current, isOpen])

  const step = useCallback((direction: 1 | -1) => {
    if (count < 2)
      return
    const next = current + direction
    if (next < 0 || next >= count) {
      if (loop)
        setIndex((next + count) % count)
      return
    }
    setIndex(next)
  }, [count, current, loop, setIndex])
  const zoom = (factor: number): void => setView((value) => {
    const scale = clampZoom(value.scale * factor)
    return scale === 1 ? RESET : { ...value, scale }
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const keys: Record<string, () => void> = {
      'ArrowLeft': () => step(-1),
      'ArrowRight': () => step(1),
      '+': () => zoom(ZOOM_STEP),
      '=': () => zoom(ZOOM_STEP),
      '-': () => zoom(1 / ZOOM_STEP),
      '0': () => setView(RESET),
    }
    const action = keys[event.key]
    if (!action)
      return
    event.preventDefault()
    action()
  }

  return (
    <DialogPrimitive.Root open={isOpen && Boolean(item)} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-slot="lightbox-scrim" className="fixed inset-0 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          data-slot="lightbox"
          data-testid={testId}
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          className={cn('fixed inset-0 flex flex-col outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0', className)}
        >
          <DialogPrimitive.Title className="sr-only">{ariaLabel ?? t('lumi.lightbox.label', 'Image viewer')}</DialogPrimitive.Title>
          <div data-slot="lightbox-toolbar" className="flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span aria-live="polite" className="min-w-0 flex-1 truncate ps-2 text-[length:var(--lumi-fs-label)] tabular-nums">
              {count > 1 ? t('lumi.lightbox.counter', '{index} / {count}', { index: current + 1, count }) : ''}
            </span>
            <div className="flex items-center gap-1 rounded-full p-1" data-glass="">
              <button type="button" data-slot="lightbox-control" className={CONTROL_CLASS} aria-label={t('lumi.lightbox.zoomOut', 'Zoom out')} disabled={view.scale <= MIN_ZOOM} onClick={() => zoom(1 / ZOOM_STEP)}><ZoomOutIcon aria-hidden /></button>
              <button type="button" data-slot="lightbox-zoom" className="h-control-lg min-w-14 rounded-full px-2 text-[length:var(--lumi-fs-label)] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t('lumi.lightbox.reset', 'Reset zoom')} onClick={() => setView(RESET)}>{`${Math.round(view.scale * 100)}%`}</button>
              <button type="button" data-slot="lightbox-control" className={CONTROL_CLASS} aria-label={t('lumi.lightbox.zoomIn', 'Zoom in')} disabled={view.scale >= MAX_ZOOM} onClick={() => zoom(ZOOM_STEP)}><ZoomInIcon aria-hidden /></button>
            </div>
            <DialogPrimitive.Close data-slot="lightbox-control" data-glass="" className={CONTROL_CLASS} aria-label={t('lumi.lightbox.close', 'Close viewer')}><XIcon aria-hidden /></DialogPrimitive.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 px-3 sm:px-16">
            {item && <LightboxStage item={item} view={view} onView={setView} onSwipe={step} />}
            {count > 1 && (
              <>
                <button type="button" data-slot="lightbox-control" data-glass="" className={cn(CONTROL_CLASS, 'absolute start-3 top-1/2 -translate-y-1/2')} aria-label={t('lumi.lightbox.previous', 'Previous image')} disabled={!canPrev} onClick={() => step(-1)}><ChevronLeftIcon aria-hidden className="rtl:-scale-x-100" /></button>
                <button type="button" data-slot="lightbox-control" data-glass="" className={cn(CONTROL_CLASS, 'absolute end-3 top-1/2 -translate-y-1/2')} aria-label={t('lumi.lightbox.next', 'Next image')} disabled={!canNext} onClick={() => step(1)}><ChevronRightIcon aria-hidden className="rtl:-scale-x-100" /></button>
              </>
            )}
          </div>
          <div data-slot="lightbox-caption" className="flex min-h-14 items-center justify-center px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[length:var(--lumi-fs-body)]">
            {item?.caption && <p className="m-0 max-w-prose">{item.caption}</p>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
