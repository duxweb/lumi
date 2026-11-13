import type { CSSProperties, ReactElement } from 'react'
import type { Hsv } from './color-area.js'
import { useEffect, useState } from 'react'
import { CheckIcon, EyedropperIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Input } from '../internal/shadcn/input.js'
import { cn } from '../internal/utils.js'
import { ColorArea, hexToHsv, hsvToHex, HueSlider } from './color-area.js'
import { useUiText } from './text.js'

/** The EyeDropper API (Chromium only), feature-detected at render. */
type EyeDropperConstructor = new () => { open: () => Promise<{ sRGBHex: string }> }

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
const LEADING_HASH_RE = /^#/
const RGB_RE = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/
/** Where the area starts before anything is picked. */
const EMPTY_HSV: Hsv = { h: 220, s: 0.7, v: 0.9 }
/** The two check colours a swatch can carry: the neutral ends of the default palette. */
const MARK_COLOR = { light: 'oklch(0.985 0 0)', dark: 'oklch(0.205 0 0)' } as const

/** `#ABC` or `abc` → `#aabbcc`; anything else is not a color. */
export function normalizeHex(input: string | undefined): string | undefined {
  const match = HEX_RE.exec((input ?? '').trim())
  if (!match)
    return undefined
  const digits = match[1]!.length === 3 ? Array.from(match[1]!, digit => digit + digit).join('') : match[1]!
  return `#${digits.toLowerCase()}`
}

function hexOf(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map(part => part.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const LIGHT_MARK_LUMINANCE = luminance('#fafafa')

/**
 * Which check a swatch carries. The check is a graphic, so the light one wins
 * whenever it clears the 3:1 non-text minimum; lighter swatches take the dark one.
 */
export function swatchMark(hex: string): 'light' | 'dark' {
  return (LIGHT_MARK_LUMINANCE + 0.05) / (luminance(hex) + 0.05) >= 3 ? 'light' : 'dark'
}

/** A swatch filled with its color, with the check color chosen from it. */
export function markStyle(hex: string): CSSProperties {
  return { backgroundColor: hex, color: MARK_COLOR[swatchMark(hex)] }
}

/**
 * Reads theme variables as hex. Computed colours can come back in any space
 * (`oklab()`, `color()`), so anything that is not plain rgb goes through a
 * one-pixel canvas.
 */
export function resolveThemeColors(host: HTMLElement, variables: string[]): string[] {
  const probe = document.createElement('span')
  host.append(probe)
  const canvas = document.createElement('canvas').getContext?.('2d', { willReadFrequently: true })
  const colors = variables.flatMap((variable) => {
    probe.style.color = `var(${variable})`
    const computed = getComputedStyle(probe).color
    const rgb = RGB_RE.exec(computed)
    if (rgb)
      return [hexOf(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]))]
    if (!canvas || !computed)
      return []
    canvas.clearRect(0, 0, 1, 1)
    canvas.fillStyle = computed
    canvas.fillRect(0, 0, 1, 1)
    const [red, green, blue, alpha] = canvas.getImageData(0, 0, 1, 1).data
    // A translucent token has no single hex of its own.
    return alpha === 255 ? [hexOf(red!, green!, blue!)] : []
  })
  probe.remove()
  return [...new Set(colors)]
}

interface ColorPanelProps {
  /** The current `#rrggbb` color, or `''`. */
  color: string
  onChoose: (next: string) => void
  /** Swatches offered under the hue strip; none when empty. */
  presets: readonly string[]
}

/** The body of a color popover: area, hue strip, presets, hex field and eyedropper. */
export function ColorPanel({ color, onChoose, presets }: ColorPanelProps): ReactElement {
  const { t } = useUiText()
  const [draft, setDraft] = useState(color.slice(1))
  // Hue and saturation survive greys and black, which a hex alone cannot carry.
  const [hsv, setHsv] = useState<Hsv>(() => color ? hexToHsv(color) : EMPTY_HSV)
  const EyeDropper = typeof window !== 'undefined' ? (window as { EyeDropper?: EyeDropperConstructor }).EyeDropper : undefined

  useEffect(() => {
    setDraft(color.slice(1))
    setHsv(previous => color && hsvToHex(previous) !== color ? hexToHsv(color) : previous)
  }, [color])

  const choose = (next: string): void => {
    if (next !== color)
      onChoose(next)
  }
  const pick = (next: Hsv): void => {
    setHsv(next)
    choose(hsvToHex(next))
  }
  const commitDraft = (): void => {
    const next = normalizeHex(draft)
    if (next)
      choose(next)
    else
      setDraft(color.slice(1))
  }
  return (
    <>
      <ColorArea
        hsv={hsv}
        onChange={pick}
        label={t('lumi.color.area', 'Saturation and brightness')}
        valueText={t('lumi.color.areaValue', 'Saturation {saturation}%, brightness {brightness}%', { saturation: Math.round(hsv.s * 100), brightness: Math.round(hsv.v * 100) })}
      />
      <HueSlider
        hue={hsv.h}
        onChange={h => pick({ ...hsv, h })}
        label={t('lumi.color.hue', 'Hue')}
        valueText={t('lumi.color.hueValue', '{degrees} degrees', { degrees: Math.round(hsv.h) })}
      />
      {presets.length > 0 && (
        <div role="group" aria-label={t('lumi.color.presets', 'Preset colors')} data-slot="color-picker-presets">
          {presets.map(swatch => (
            <button
              key={swatch}
              type="button"
              className="lumi-color-swatch lumi-color-preset flex size-control-sm shrink-0 items-center justify-center"
              style={markStyle(swatch)}
              aria-label={swatch}
              aria-pressed={swatch === color}
              title={swatch}
              onClick={() => choose(swatch)}
            >
              {swatch === color && <CheckIcon className="size-3.5" aria-hidden />}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2" data-slot="color-picker-fields">
        <span className={cn('lumi-color-swatch size-control-sm shrink-0', !color && 'lumi-color-swatch-empty')} style={color ? { backgroundColor: color } : undefined} data-slot="color-picker-preview" aria-hidden />
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-muted-foreground" aria-hidden>#</span>
          <Input
            className="h-control-sm ps-6 font-mono tabular-nums"
            value={draft}
            maxLength={7}
            spellCheck={false}
            autoCapitalize="off"
            aria-label={t('lumi.color.hex', 'Hex value')}
            aria-invalid={draft !== '' && !normalizeHex(draft) ? true : undefined}
            onChange={(event) => {
              const next = event.target.value.replace(LEADING_HASH_RE, '')
              setDraft(next)
              const parsed = next.length === 6 ? normalizeHex(next) : undefined
              if (parsed)
                choose(parsed)
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDraft()
              }
            }}
          />
        </div>
        {EyeDropper && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('lumi.color.eyedropper', 'Pick a color from the screen')}
            title={t('lumi.color.eyedropper', 'Pick a color from the screen')}
            onClick={() => {
              new EyeDropper().open().then(result => choose(normalizeHex(result.sRGBHex) ?? color), () => {})
            }}
          >
            <EyedropperIcon />
          </Button>
        )}
      </div>
    </>
  )
}
