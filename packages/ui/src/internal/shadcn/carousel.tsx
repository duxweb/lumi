'use client'

import * as React from 'react'

import { ChevronLeftIcon, ChevronRightIcon } from '../../icons.js'
import { cn } from '../utils.js'
import { Button } from './button.js'

interface CarouselProps {
  orientation?: 'horizontal' | 'vertical'
  loop?: boolean
  /** Slide to scroll to; the carousel follows it whenever it changes. */
  index?: number
  onIndexChange?: (index: number) => void
}

interface CarouselContextProps {
  trackRef: React.RefObject<HTMLDivElement | null>
  orientation: 'horizontal' | 'vertical'
  selectedIndex: number
  snapCount: number
  scrollPrev: () => void
  scrollNext: () => void
  scrollTo: (index: number) => void
  canScrollPrev: boolean
  canScrollNext: boolean
}

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel(): CarouselContextProps {
  const context = React.useContext(CarouselContext)
  if (!context)
    throw new Error('useCarousel must be used within a <Carousel />')
  return context
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Snap offsets of the track: one per slide start, capped at the furthest the
 * track can scroll, so several slides in view share the last stop.
 */
function measureSnaps(track: HTMLDivElement, vertical: boolean): number[] {
  const list = track.firstElementChild as HTMLElement | null
  if (!list)
    return [0]
  const slides = Array.from(list.children) as HTMLElement[]
  const origin = vertical ? list.offsetTop : list.offsetLeft
  const limit = vertical ? track.scrollHeight - track.clientHeight : track.scrollWidth - track.clientWidth
  const snaps: number[] = []
  for (const slide of slides) {
    const offset = Math.min(Math.max((vertical ? slide.offsetTop : slide.offsetLeft) - origin, 0), Math.max(limit, 0))
    if (!snaps.length || offset - snaps.at(-1)! > 1)
      snaps.push(offset)
  }
  return snaps.length ? snaps : [0]
}

function Carousel({
  orientation = 'horizontal',
  loop = false,
  index,
  onIndexChange,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & CarouselProps): React.ReactElement | null {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const vertical = orientation === 'vertical'
  const [snaps, setSnaps] = React.useState<number[]>([0])
  const [selectedIndex, setSelectedIndex] = React.useState(index ?? 0)
  const selectedRef = React.useRef(selectedIndex)
  const onIndexChangeRef = React.useRef(onIndexChange)
  onIndexChangeRef.current = onIndexChange

  const scrollTo = React.useCallback((target: number) => {
    const track = trackRef.current
    if (!track)
      return
    const all = measureSnaps(track, vertical)
    const next = Math.min(Math.max(target, 0), all.length - 1)
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
    track.scrollTo(vertical ? { top: all[next], behavior } : { left: all[next], behavior })
  }, [vertical])

  const count = snaps.length
  const scrollPrev = React.useCallback(() => {
    const current = selectedRef.current
    scrollTo(current > 0 ? current - 1 : loop ? count - 1 : 0)
  }, [count, loop, scrollTo])
  const scrollNext = React.useCallback(() => {
    const current = selectedRef.current
    scrollTo(current < count - 1 ? current + 1 : loop ? 0 : current)
  }, [count, loop, scrollTo])

  React.useEffect(() => {
    const track = trackRef.current
    if (!track)
      return
    let frame = 0
    const sync = (): void => {
      const all = measureSnaps(track, vertical)
      setSnaps(previous => previous.length === all.length && previous.every((value, i) => value === all[i]) ? previous : all)
      const position = vertical ? track.scrollTop : track.scrollLeft
      let nearest = 0
      all.forEach((offset, i) => {
        if (Math.abs(offset - position) < Math.abs(all[nearest]! - position))
          nearest = i
      })
      if (nearest !== selectedRef.current) {
        selectedRef.current = nearest
        setSelectedIndex(nearest)
        onIndexChangeRef.current?.(nearest)
      }
    }
    const onScroll = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(sync)
    }
    sync()
    track.addEventListener('scroll', onScroll, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onScroll)
    observer?.observe(track)
    if (track.firstElementChild)
      observer?.observe(track.firstElementChild)
    return () => {
      cancelAnimationFrame(frame)
      track.removeEventListener('scroll', onScroll)
      observer?.disconnect()
    }
  }, [vertical])

  React.useEffect(() => {
    if (index !== undefined && index !== selectedRef.current)
      scrollTo(index)
  }, [index, scrollTo])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) {
        event.preventDefault()
        scrollPrev()
      }
      else if (event.key === (vertical ? 'ArrowDown' : 'ArrowRight')) {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext, vertical],
  )

  return (
    <CarouselContext.Provider
      value={{
        trackRef,
        orientation,
        selectedIndex,
        snapCount: count,
        scrollPrev,
        scrollNext,
        scrollTo,
        canScrollPrev: count > 1 && (loop || selectedIndex > 0),
        canScrollNext: count > 1 && (loop || selectedIndex < count - 1),
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn('relative', className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

function CarouselContent({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  const { trackRef, orientation } = useCarousel()

  return (
    <div
      ref={trackRef}
      className={cn('overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', orientation === 'horizontal' ? 'snap-x snap-mandatory overflow-x-auto overflow-y-hidden' : 'h-full snap-y snap-mandatory overflow-y-auto overflow-x-hidden')}
      data-slot="carousel-content"
    >
      <div
        className={cn(
          'flex gap-(--carousel-gap,1rem)',
          orientation === 'horizontal' ? '' : 'h-full flex-col',
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CarouselItem({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement | null {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn(
        'min-w-0 shrink-0 grow-0 basis-full snap-start',
        className,
      )}
      {...props}
    />
  )
}

function CarouselPrevious({
  className,
  variant = 'outline',
  size = 'icon',
  children,
  ...props
}: React.ComponentProps<typeof Button>): React.ReactElement | null {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      size={size}
      className={cn(
        'absolute size-control-md rounded-full',
        orientation === 'horizontal'
          ? 'top-1/2 -left-12 -translate-y-1/2'
          : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ChevronLeftIcon className="rtl:-scale-x-100" />
      {children ?? <span className="sr-only">Previous slide</span>}
    </Button>
  )
}

function CarouselNext({
  className,
  variant = 'outline',
  size = 'icon',
  children,
  ...props
}: React.ComponentProps<typeof Button>): React.ReactElement | null {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      size={size}
      className={cn(
        'absolute size-control-md rounded-full',
        orientation === 'horizontal'
          ? 'top-1/2 -right-12 -translate-y-1/2'
          : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ChevronRightIcon className="rtl:-scale-x-100" />
      {children ?? <span className="sr-only">Next slide</span>}
    </Button>
  )
}

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
}
