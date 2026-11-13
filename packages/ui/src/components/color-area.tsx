import type { KeyboardEvent, PointerEvent, ReactElement, RefObject } from 'react'
import { useRef } from 'react'
import { cn } from '../internal/utils.js'

/** Hue in degrees (0–360); saturation and brightness (HSV value) in 0–1. */
export interface Hsv { h: number, s: number, v: number }

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value))

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  let h = 0
  if (delta) {
    if (max === r)
      h = ((g - b) / delta) % 6
    else if (max === g)
      h = (b - r) / delta + 2
    else
      h = (r - g) / delta + 4
  }
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number): string => {
    const k = (n + h / 60) % 6
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(value * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`
}

/** Tracks a pointer from press to release, reporting its position as 0–1 fractions of the element. */
interface PointerTrack {
  ref: RefObject<HTMLDivElement | null>
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
}

function usePointerTrack(onMove: (x: number, y: number) => void, disabled: boolean | undefined): PointerTrack {
  const surface = useRef<HTMLDivElement>(null)
  const report = (event: PointerEvent<HTMLDivElement>): void => {
    const rect = surface.current!.getBoundingClientRect()
    onMove(clamp((event.clientX - rect.left) / (rect.width || 1)), clamp((event.clientY - rect.top) / (rect.height || 1)))
  }
  return {
    ref: surface,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0)
        return
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      event.currentTarget.querySelector<HTMLElement>('[role="slider"]')?.focus()
      report(event)
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId))
        report(event)
    },
  }
}

/** Arrow keys nudge by `step`, Shift by ten steps; Home and End jump to the ends. */
function nudge(event: KeyboardEvent, step: number): { x: number, y: number } | 'start' | 'end' | undefined {
  const amount = event.shiftKey ? step * 10 : step
  switch (event.key) {
    case 'ArrowLeft': return { x: -amount, y: 0 }
    case 'ArrowRight': return { x: amount, y: 0 }
    case 'ArrowUp': return { x: 0, y: amount }
    case 'ArrowDown': return { x: 0, y: -amount }
    case 'PageUp': return { x: 0, y: step * 10 }
    case 'PageDown': return { x: 0, y: -step * 10 }
    case 'Home': return 'start'
    case 'End': return 'end'
    default: return undefined
  }
}

interface AreaProps {
  hsv: Hsv
  onChange: (next: Hsv) => void
  label: string
  valueText: string
  disabled?: boolean
}

/** Saturation across, brightness up, for the current hue. */
export function ColorArea({ hsv, onChange, label, valueText, disabled }: AreaProps): ReactElement {
  const track = usePointerTrack((x, y) => onChange({ ...hsv, s: x, v: 1 - y }), disabled)
  return (
    <div {...track} className="lumi-color-area" style={{ '--lumi-color-hue': `hsl(${Math.round(hsv.h)} 100% 50%)` } as Record<string, string>} data-slot="color-area" data-disabled={disabled || undefined}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        className="lumi-color-thumb"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hsvToHex(hsv) }}
        aria-label={label}
        aria-roledescription="2D slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={valueText}
        aria-disabled={disabled || undefined}
        data-slot="color-area-thumb"
        onKeyDown={(event) => {
          const move = nudge(event, 0.01)
          if (!move || disabled)
            return
          event.preventDefault()
          if (move === 'start')
            onChange({ ...hsv, s: 0 })
          else if (move === 'end')
            onChange({ ...hsv, s: 1 })
          else
            onChange({ ...hsv, s: clamp(hsv.s + move.x), v: clamp(hsv.v + move.y) })
        }}
      />
    </div>
  )
}

interface HueProps {
  hue: number
  onChange: (hue: number) => void
  label: string
  valueText: string
  disabled?: boolean
}

/** The hue strip under the area. */
export function HueSlider({ hue, onChange, label, valueText, disabled }: HueProps): ReactElement {
  const track = usePointerTrack(x => onChange(x * 360), disabled)
  return (
    <div {...track} className="lumi-color-hue" data-slot="color-hue" data-disabled={disabled || undefined}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        className={cn('lumi-color-thumb')}
        style={{ left: `${(hue / 360) * 100}%`, top: '50%', backgroundColor: `hsl(${Math.round(hue)} 100% 50%)` }}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hue)}
        aria-valuetext={valueText}
        aria-disabled={disabled || undefined}
        data-slot="color-hue-thumb"
        onKeyDown={(event) => {
          const move = nudge(event, 1)
          if (!move || disabled)
            return
          event.preventDefault()
          if (move === 'start')
            onChange(0)
          else if (move === 'end')
            onChange(360)
          else
            onChange(clamp(hue + move.x + move.y, 0, 360))
        }}
      />
    </div>
  )
}
