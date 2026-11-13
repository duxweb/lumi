import type { ReactElement } from 'react'
import type { ColorPickerProps } from '../catalog/types-public.js'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDownIcon, XIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { cn } from '../internal/utils.js'
import { ColorPanel, normalizeHex, resolveThemeColors } from './color-panel.js'
import { FIELD_TRIGGER_CLASS, useControllableValue } from './control.js'
import { useUiText } from './text.js'

export { normalizeHex } from './color-panel.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

/** The theme's data colours, then the tone fills that differ from them, then the neutrals. */
const THEME_PRESETS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--lumi-info', '--lumi-success', '--lumi-danger', '--foreground', '--muted-foreground']

/** A hex color from a saturation/brightness area, a hue strip, presets, a hex field or the screen. */
export function LumiColorPicker(props: ColorPickerProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, presets, clearable, placeholder = t('lumi.color.placeholder', 'Pick a color'), size = 'md', appearance = 'outline', name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const [current, setCurrent] = useControllableValue(value, defaultValue, onChange)
  const color = normalizeHex(current) ?? ''
  const [open, setOpen] = useState(false)
  const [themeColors, setThemeColors] = useState<string[]>([])
  const host = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const label = ariaLabel ?? props['aria-label'] ?? t('lumi.color.name', 'Color')
  const locked = disabled || readonly
  const swatches = presets ? [...new Set(presets.flatMap(preset => normalizeHex(preset) ?? []))] : themeColors

  useEffect(() => {
    // The theme can change between openings, so the swatches are read each time.
    if (open && !presets && host.current)
      setThemeColors(resolveThemeColors(host.current, THEME_PRESETS))
  }, [open, presets])

  return (
    <div ref={host} className={cn('flex min-w-0 flex-col gap-1.5', className)} data-slot="lumi-color-picker" data-testid={props['data-testid']}>
      {name && <input type="hidden" name={name} value={color} disabled={disabled} />}
      <div className="lumi-select-control relative w-full min-w-0" data-clearable={(clearable && color !== '') || undefined}>
        <Popover open={open && !locked} onOpenChange={next => setOpen(next && !locked)}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn('lumi-select-trigger w-full min-w-0 justify-between gap-2 text-start font-normal', FIELD_TRIGGER_CLASS)}
              aria-label={color ? `${label}: ${color}` : label}
              aria-haspopup="dialog"
              aria-controls={open ? panelId : undefined}
              aria-expanded={open && !locked}
              aria-invalid={invalid}
              aria-describedby={props['aria-describedby']}
              disabled={disabled || readonly}
              data-slot="select-trigger"
              data-lumi-control-size={size}
              data-appearance={appearance}
              data-placeholder={color ? undefined : true}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className={cn('lumi-color-swatch size-4 shrink-0', !color && 'lumi-color-swatch-empty')} style={color ? { backgroundColor: color } : undefined} data-slot="color-picker-swatch" />
                <span className={cn('truncate', color && 'font-mono tabular-nums')}>{color || placeholder}</span>
              </span>
              <ChevronDownIcon className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent id={panelId} align="start" collisionPadding={8} className="gap-3" aria-label={t('lumi.color.panel', '{name} choices', { name: label })} data-slot="color-picker-panel">
            <ColorPanel color={color} presets={swatches} onChoose={next => !locked && setCurrent(next)} />
          </PopoverContent>
        </Popover>
        {clearable && color !== '' && (
          <Button type="button" variant="ghost" size="icon-xs" className="lumi-select-clear" disabled={locked} aria-label={t('lumi.color.clear', 'Clear color')} onClick={() => setCurrent('')}>
            <XIcon />
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-meta text-destructive" data-slot="color-picker-error">{error}</p>}
    </div>
  )
}
