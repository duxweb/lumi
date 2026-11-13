import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { CarouselItem as CarouselEntry, CarouselProps } from '../catalog/types-public.js'
import { Children, useEffect, useState } from 'react'
import { PauseIcon, PlayIcon } from '../icons.js'
import { useReducedMotion } from '../internal/reduced-motion.js'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, useCarousel } from '../internal/shadcn/carousel.js'
import { cn } from '../internal/utils.js'
import { aspectRatioStyle } from './media.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'data-testid'?: string
  'aria-label'?: string
  'children'?: ReactNode
}

function ImageSlide({ item, ratio }: { item: CarouselEntry, ratio: CSSProperties | undefined }): ReactElement {
  return (
    <figure data-slot="carousel-image" className="relative m-0 overflow-hidden rounded-panel bg-muted" style={ratio}>
      <img src={item.url} alt={item.alt ?? item.title ?? ''} loading="lazy" decoding="async" draggable={false} className="absolute inset-0 block size-full object-cover" />
      {(item.title || item.description) && (
        <figcaption data-glass="" className="absolute start-3 end-3 bottom-3 flex max-w-md flex-col gap-0.5 rounded-control px-3 py-2 text-popover-foreground sm:end-auto">
          {item.title && <span className="text-[length:var(--lumi-fs-title)] font-semibold">{item.title}</span>}
          {item.description && <span className="text-[length:var(--lumi-fs-meta)] text-muted-foreground">{item.description}</span>}
        </figcaption>
      )}
    </figure>
  )
}

const ARROW_CLASS = 'size-control-md border-0 text-popover-foreground shadow-sm hover:text-foreground disabled:opacity-0'

function Arrows(): ReactElement | null {
  const { t } = useUiText()
  const { snapCount } = useCarousel()
  if (snapCount < 2)
    return null
  return (
    <>
      <CarouselPrevious data-glass="" className={cn(ARROW_CLASS, 'left-3')}><span className="sr-only">{t('lumi.carousel.previous', 'Previous slide')}</span></CarouselPrevious>
      <CarouselNext data-glass="" className={cn(ARROW_CLASS, 'right-3')}><span className="sr-only">{t('lumi.carousel.next', 'Next slide')}</span></CarouselNext>
    </>
  )
}

/** The track scrolls on its own, so it must be reachable by keyboard; once focused, the arrow keys step it. */
function FocusableTrack(): null {
  const { trackRef } = useCarousel()
  useEffect(() => {
    if (trackRef.current)
      trackRef.current.tabIndex = 0
  }, [trackRef])
  return null
}

function Controls({ dots, autoplay, interval, paused, stopped, onToggle }: { dots: boolean, autoplay: boolean, interval: number, paused: boolean, stopped: boolean, onToggle: () => void }): ReactElement {
  const { t } = useUiText()
  const { snapCount, selectedIndex, scrollTo, canScrollNext } = useCarousel()
  const running = autoplay && !paused && !stopped && snapCount > 1
  useEffect(() => {
    if (!running)
      return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden')
        return
      scrollTo(canScrollNext ? selectedIndex + 1 : 0)
    }, interval)
    return () => window.clearInterval(timer)
  }, [running, interval, scrollTo, selectedIndex, canScrollNext])
  return (
    <>
      {(dots || autoplay) && snapCount > 1 && (
        <div data-slot="carousel-controls" className="mt-2 flex items-center justify-center gap-1">
          {autoplay && (
            <button
              type="button"
              data-slot="carousel-autoplay"
              aria-label={stopped ? t('lumi.carousel.play', 'Start autoplay') : t('lumi.carousel.pause', 'Pause autoplay')}
              className="me-1 grid size-control-xs place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={onToggle}
            >
              {stopped ? <PlayIcon aria-hidden className="size-3.5" /> : <PauseIcon aria-hidden className="size-3.5" />}
            </button>
          )}
          {dots && Array.from({ length: snapCount }, (_, index) => (
            <button
              // Dots are positions, not content; their order never changes.
              key={index}
              type="button"
              data-slot="carousel-dot"
              aria-label={t('lumi.carousel.goTo', 'Go to slide {index}', { index: index + 1 })}
              aria-current={index === selectedIndex || undefined}
              className="group/dot grid h-control-xs min-w-4 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => scrollTo(index)}
            >
              <span aria-hidden className={cn('block h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none', index === selectedIndex ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/40 group-hover/dot:bg-muted-foreground')} />
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Slides on a native scroll-snap track. Autoplay pauses while the pointer or
 * focus is inside, stops for good from its button, and never runs under
 * reduced motion.
 */
export function LumiCarousel(props: CarouselProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { items, aspectRatio, perView: perViewProp, autoplay, interval, loop, arrows, dots, value, onChange, children, className, 'data-testid': testId, 'aria-label': ariaLabel } = props
  const reduced = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [stopped, setStopped] = useState(false)
  const perView = perViewProp ?? 1
  const ratio = aspectRatioStyle(aspectRatio, '16/9')
  const slides: ReactNode[] = items?.length ? items.map(item => <ImageSlide key={item.url} item={item} ratio={ratio} />) : Children.toArray(children)
  const gap = perView > 1 ? '1rem' : '0px'
  return (
    <Carousel
      loop={Boolean(loop)}
      index={value ?? undefined}
      onIndexChange={onChange}
      aria-label={ariaLabel ?? t('lumi.carousel.label', 'Carousel')}
      aria-roledescription={t('lumi.carousel.roleDescription', 'carousel')}
      data-testid={testId}
      className={cn('w-full min-w-0', className)}
      style={{ '--carousel-gap': gap } as CSSProperties}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setFocused(false)
      }}
    >
      <div className="relative">
        <CarouselContent aria-live={autoplay && !stopped && !reduced ? 'off' : 'polite'}>
          {slides.map((slide, index) => (
            <CarouselItem
            // Slides come from items or children in a stable order.
              key={index}
              aria-roledescription={t('lumi.carousel.slideRole', 'slide')}
              aria-label={t('lumi.carousel.slide', '{index} of {count}', { index: index + 1, count: slides.length })}
              // The scroll track clips overflow, so slides keep room for a card's outside ring.
              className="p-px"
              style={{ flexBasis: `calc((100% - ${perView - 1} * var(--carousel-gap)) / ${perView})` }}
            >
              {slide}
            </CarouselItem>
          ))}
        </CarouselContent>
        <FocusableTrack />
        {(arrows ?? true) && <Arrows />}
      </div>
      <Controls
        dots={dots ?? true}
        autoplay={Boolean(autoplay) && !reduced}
        interval={interval ?? 5000}
        paused={hovered || focused}
        stopped={stopped}
        onToggle={() => setStopped(value => !value)}
      />
    </Carousel>
  )
}
