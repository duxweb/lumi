import type { CSSProperties, ReactElement } from 'react'
import type { SliderProps, SliderValue } from '../catalog/types-public.js'
import { useState } from 'react'
import { Slider, SliderThumb } from '../internal/shadcn/slider.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { LumiNumberInput } from './controls.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

function decimals(step: number): number {
  return (String(step).split('.')[1] ?? '').length
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Radix keeps a thumb inside the track, so its centre runs from half a thumb
 * in at one end to half a thumb in at the other; marks follow the same curve
 * to sit under the thumb that lands on them.
 */
function markOffset(percent: number): string {
  return `calc(${percent}% + var(--lumi-slider-thumb) / 2 * ${1 - percent / 50})`
}

/** A number, or a `[start, end]` range, picked along a track. */
export function LumiSlider(props: SliderProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue, onChange, min = 0, max = 100, step = 1, range: rangeProp, minStepsBetweenThumbs, marks, tooltip = true, input, orientation = 'horizontal', prefix, suffix, size = 'md', name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const range = rangeProp ?? Array.isArray(value ?? defaultValue)
  const [current, setCurrent] = useControllableValue<SliderValue>(value, defaultValue ?? (range ? [min, max] : min), onChange)
  const [dragging, setDragging] = useState(false)
  // A grid that starts off an integer (`min` 0.5, `step` 1) keeps its decimals.
  const places = Math.max(decimals(step), decimals(min))
  const list = Array.isArray(current) ? current : [current]
  const values = range
    ? [clamp(list[0] ?? min, min, max), clamp(list[1] ?? list[0] ?? max, min, max)].sort((a, b) => a - b)
    : [clamp(list[0] ?? min, min, max)]
  const label = ariaLabel ?? props['aria-label']
  const vertical = orientation === 'vertical'
  const format = (number: number): string => `${prefix ?? ''}${number.toFixed(places)}${suffix ?? ''}`
  const spoken = (number: number): string => marks?.find(mark => mark.value === number)?.label ?? format(number)
  const locked = disabled || readonly
  const commit = (next: number[]): void => {
    if (locked)
      return
    const rounded = next.map(item => Number(clamp(item, min, max).toFixed(places)))
    if (rounded.every((item, index) => item === values[index]))
      return
    setCurrent(range ? rounded : rounded[0]!)
  }
  const [draft, setDraft] = useState<{ index: number, value: number | null }>()
  const commitAt = (index: number, next: number): void => {
    const updated = [...values]
    updated[index] = next
    commit(range && updated[0]! > updated[1]! ? (index === 0 ? [updated[1]!, updated[1]!] : [updated[0]!, updated[0]!]) : updated)
  }
  const settleDraft = (): void => {
    if (!draft)
      return
    setDraft(undefined)
    if (draft.value !== null && Number.isFinite(draft.value))
      commitAt(draft.index, draft.value)
  }
  const thumbLabel = (index: number): string | undefined => {
    if (!range)
      return label
    return index === 0
      ? t('lumi.slider.start', '{name} start', { name: label ?? t('lumi.slider.name', 'Range') })
      : t('lumi.slider.end', '{name} end', { name: label ?? t('lumi.slider.name', 'Range') })
  }
  const percent = (number: number): number => max === min ? 0 : ((number - min) / (max - min)) * 100
  const nearest = (number: number): number => values.length === 1 || Math.abs(number - values[0]!) <= Math.abs(number - values[1]!) ? 0 : 1
  return (
    <div
      id={id}
      className={cn('flex min-w-0 flex-col gap-1.5', vertical && 'h-full', className)}
      data-slot="lumi-slider"
      data-size={size}
      data-orientation={orientation}
      data-invalid={invalid || undefined}
      data-readonly={readonly || undefined}
      data-marks={marks?.some(mark => mark.label) || undefined}
      data-testid={props['data-testid']}
    >
      {name && <input type="hidden" name={name} value={range ? JSON.stringify(values) : String(values[0])} disabled={disabled} />}
      <div className={cn('flex min-w-0 gap-3', vertical ? 'min-h-0 flex-1 flex-col items-start' : 'items-center')} data-slot="slider-row">
        <div className={cn('relative flex min-w-0', vertical ? 'min-h-0 flex-1' : 'flex-1 flex-col justify-center')} data-slot="slider-body">
          <Slider
            value={values}
            min={min}
            max={max}
            step={step}
            minStepsBetweenThumbs={minStepsBetweenThumbs}
            orientation={orientation}
            disabled={disabled}
            aria-invalid={invalid}
            data-dragging={dragging || undefined}
            className={cn(vertical ? 'w-(--lumi-slider-thumb)' : 'h-(--lumi-slider-hit)', readonly && 'cursor-default')}
            onValueChange={commit}
            onPointerDown={() => setDragging(true)}
            onPointerUp={() => setDragging(false)}
            onLostPointerCapture={() => setDragging(false)}
          >
            {values.map((number, index) => (
              <SliderThumb
              // Two thumbs are fixed in order, so the index is their identity.
                key={index}
                aria-label={thumbLabel(index)}
                aria-valuetext={spoken(number)}
                aria-readonly={readonly || undefined}
                aria-invalid={invalid}
                aria-describedby={props['aria-describedby']}
              >
                {tooltip && <span data-slot="slider-tooltip" aria-hidden>{format(number)}</span>}
              </SliderThumb>
            ))}
          </Slider>
          {marks && marks.length > 0 && (
            <div data-slot="slider-marks" aria-hidden>
              {marks.filter(mark => mark.value >= min && mark.value <= max).map(mark => (
                <span
                  key={mark.value}
                  data-slot="slider-mark"
                  data-active={(range ? mark.value >= values[0]! && mark.value <= values[1]! : mark.value <= values[0]!) || undefined}
                  data-edge={vertical ? undefined : mark.value === min ? 'start' : mark.value === max ? 'end' : undefined}
                  style={{ [vertical ? 'bottom' : 'left']: markOffset(percent(mark.value)) } as CSSProperties}
                  onClick={() => {
                    const next = [...values]
                    next[nearest(mark.value)] = mark.value
                    commit(next)
                  }}
                >
                  <i />
                  {mark.label && <span>{mark.label}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        {input && (
          <div className="flex shrink-0 items-center gap-1.5" data-slot="slider-inputs">
            {values.map((number, index) => (
              <span
                key={index === 0 ? 'start' : 'end'}
                className="contents"
                onBlur={settleDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter')
                    settleDraft()
                }}
              >
                {index > 0 && <span className="text-muted-foreground" aria-hidden>–</span>}
                <LumiNumberInput
                  className="w-20"
                  size={size}
                  value={draft?.index === index ? draft.value : number}
                  min={min}
                  max={max}
                  step={step}
                  disabled={disabled}
                  readonly={readonly}
                  invalid={invalid}
                  ariaLabel={thumbLabel(index) ?? t('lumi.slider.name', 'Range')}
                  onChange={(next) => {
                    // A number being typed passes through values outside the
                    // range ("5" on the way to "50"): those wait in the box
                    // until the reader leaves it or presses Enter.
                    if (next === null || !Number.isFinite(next) || next < min || next > max) {
                      setDraft({ index, value: next })
                      return
                    }
                    setDraft(undefined)
                    commitAt(index, next)
                  }}
                />
              </span>
            ))}
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-meta text-destructive" data-slot="slider-error">{error}</p>}
    </div>
  )
}
