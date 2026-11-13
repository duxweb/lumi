import type { CSSProperties, KeyboardEvent, ReactElement } from 'react'
import type { ColorSwatchesProps } from '../catalog/types-public.js'
import { useId, useRef, useState } from 'react'
import { AddIcon, CheckIcon } from '../icons.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { cn } from '../internal/utils.js'
import { ColorPanel, markStyle, normalizeHex, swatchMark } from './color-panel.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

interface SwatchItem {
  /** `#rrggbb`, or `''` for the "no color" swatch. */
  value: string
  label: string
  kind: 'none' | 'swatch' | 'custom'
}

const NO_SWATCHES: readonly never[] = []
const NO_PRESETS: readonly string[] = []

/**
 * A color chosen from an inline row of swatches: one radio per color, an
 * optional "no color" swatch first and an optional + tile last that opens the
 * full picker.
 */
export function LumiColorSwatches(props: ColorSwatchesProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, swatches: inputSwatches, size = 'md', shape = 'circle', allowCustom, clearable, name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const input = inputSwatches ?? NO_SWATCHES
  const [current, setCurrent] = useControllableValue(value, defaultValue, onChange)
  const color = normalizeHex(current) ?? ''
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const radios = useRef<Array<HTMLButtonElement | null>>([])
  const label = ariaLabel ?? props['aria-label'] ?? t('lumi.color.name', 'Color')
  const locked = disabled || readonly

  const presets = new Map<string, string | undefined>()
  for (const swatch of input) {
    const hex = normalizeHex(typeof swatch === 'string' ? swatch : swatch.value)
    if (hex && !presets.has(hex))
      presets.set(hex, typeof swatch === 'string' ? undefined : swatch.label)
  }
  // A color from outside the row joins it and stays offered after another
  // swatch is chosen, so picking a preset does not lose it.
  const [custom, setCustom] = useState(() => color && !presets.has(color) ? color : '')
  if (color && !presets.has(color) && color !== custom)
    setCustom(color)

  const items: SwatchItem[] = [
    ...(clearable ? [{ value: '', label: t('lumi.color.none', 'No color'), kind: 'none' as const }] : []),
    ...Array.from(presets, ([hex, name]) => ({ value: hex, label: name ?? hex, kind: 'swatch' as const })),
    ...(custom ? [{ value: custom, label: t('lumi.color.customValue', 'Custom color {value}', { value: custom }), kind: 'custom' as const }] : []),
  ]
  const checked = items.findIndex(item => item.value === color)
  const tabStop = Math.max(checked, 0)

  const choose = (next: string): void => {
    if (!locked && next !== color)
      setCurrent(next)
  }
  // Arrow keys move and check together, wrapping at the ends, as a radio group does.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = radios.current.indexOf(event.target as HTMLButtonElement)
    if (index < 0 || disabled || items.length === 0)
      return
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const steps: Record<string, number> = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 1, ArrowUp: -1 }
    const target = event.key in steps
      ? (index + steps[event.key]! + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : undefined
    if (target === undefined)
      return
    event.preventDefault()
    radios.current[target]?.focus()
    choose(items[target]!.value)
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-slot="lumi-color-swatches-field" data-testid={props['data-testid']}>
      {name && <input type="hidden" name={name} value={color} disabled={disabled} />}
      <div
        data-slot="lumi-color-swatches"
        data-size={size}
        data-shape={shape}
        data-disabled={disabled || undefined}
        data-readonly={readonly || undefined}
        data-invalid={invalid || undefined}
      >
        <div
          id={id}
          role="radiogroup"
          aria-label={label}
          aria-readonly={readonly || undefined}
          aria-disabled={disabled || undefined}
          aria-invalid={invalid}
          aria-describedby={props['aria-describedby']}
          data-slot="color-swatches"
          onKeyDown={onKeyDown}
        >
          {items.map((item, index) => {
            const mark = item.kind === 'none' ? undefined : swatchMark(item.value)
            return (
              <button
                // The custom swatch keeps its node while its color is dragged.
                key={item.kind === 'custom' ? item.kind : `${item.kind}:${item.value}`}
                ref={(node) => {
                  radios.current[index] = node
                }}
                type="button"
                role="radio"
                aria-checked={index === checked}
                aria-label={item.label}
                title={item.kind === 'swatch' && item.label !== item.value ? `${item.label} ${item.value}` : item.label}
                tabIndex={index === tabStop ? 0 : -1}
                disabled={disabled}
                data-slot="color-swatch"
                data-kind={item.kind}
                data-mark={mark}
                style={mark ? { ...markStyle(item.value), '--lumi-swatch-color': item.value } as CSSProperties : undefined}
                onClick={() => choose(item.value)}
              >
                {index === checked && item.kind !== 'none' && <CheckIcon aria-hidden />}
              </button>
            )
          })}
        </div>
        {allowCustom && (
          <Popover open={open && !locked} onOpenChange={next => setOpen(next && !locked)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t('lumi.color.custom', 'Custom color')}
                title={t('lumi.color.custom', 'Custom color')}
                aria-haspopup="dialog"
                aria-controls={open ? panelId : undefined}
                aria-expanded={open && !locked}
                disabled={locked}
                data-slot="color-swatch-add"
              >
                <AddIcon aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent id={panelId} align="start" collisionPadding={8} className="gap-3" aria-label={t('lumi.color.panel', '{name} choices', { name: label })} data-slot="color-picker-panel">
              <ColorPanel color={color} presets={NO_PRESETS} onChoose={choose} />
            </PopoverContent>
          </Popover>
        )}
      </div>
      {error && <p role="alert" className="text-meta text-destructive" data-slot="color-swatches-error">{error}</p>}
    </div>
  )
}
