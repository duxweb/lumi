import type { ChangeEvent, ReactElement, ReactNode } from 'react'
import type { CheckboxGroupProps, CheckboxProps, ControlAppearance, InputProps, MultiSelectProps, NumberInputProps, OptionValue, RadioGroupProps, RichTextProps, SelectProps, Size, SwitchProps, TagsInputProps, TextareaProps } from '../catalog/types-public.js'
import type { UiText } from './text.js'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { BoldIcon, ChevronDownIcon, ChevronUpIcon, Heading2Icon, ItalicIcon, LinkIcon, ListIcon, XIcon } from '../icons.js'
import { FIELD_BARE, FIELD_DISABLED_WITHIN, FIELD_FOCUS_WITHIN, FIELD_SURFACE } from '../internal/field-surface.js'
import { Button } from '../internal/shadcn/button.js'
import { Checkbox } from '../internal/shadcn/checkbox.js'
import { Field, FieldContent, FieldDescription, FieldLabel, FieldSet } from '../internal/shadcn/field.js'
import { Input } from '../internal/shadcn/input.js'
import { RadioGroup, RadioGroupItem } from '../internal/shadcn/radio-group.js'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../internal/shadcn/select.js'
import { Switch } from '../internal/shadcn/switch.js'
import { Textarea } from '../internal/shadcn/textarea.js'
import { cn } from '../internal/utils.js'
import { CONTROL_HEIGHT, FIELD_TRIGGER_CLASS, optionKey, useControllableValue } from './control.js'
import { useInputMask } from './mask.js'
import { SelectPopover } from './select-popover.js'
import { LumiTag } from './tag.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'children'?: ReactNode
  'id'?: string
  'name'?: string
  'appearance'?: ControlAppearance
  'size'?: Size
  'required'?: boolean
  'aria-describedby'?: string
  'data-testid'?: string
}

function nativeSize(size: Size | undefined): 'sm' | undefined {
  return size === 'sm' ? 'sm' : undefined
}

function controlSize(size: Size | undefined): Size {
  return size ?? 'md'
}

function controlSizeClass(size: Size | undefined): string {
  return CONTROL_HEIGHT[controlSize(size)]
}

/** Browser autofill hint (`username`, `current-password`…); a host attribute, not part of the JSON props. */
interface InputHostProps { autoComplete?: string }

/** How many decimals a number is written with, `1e-7` included. */
function fractionDigits(value: number): number {
  const [mantissa = '', exponent] = String(value).split('e-')
  return Math.min(20, (mantissa.split('.')[1] ?? '').length + (exponent ? Number(exponent) : 0))
}

export function LumiInput(props: InputProps & HostProps & InputHostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue, onChange, ariaLabel, invalid, readonly, appearance = 'outline', clearable, size, className, mask, unmask, prefix, suffix, ...rest } = props
  const [current, setCurrent] = useControllableValue(value, defaultValue ?? '', next => onChange?.(String(next)))
  const masked = useInputMask(mask, unmask, String(current ?? ''), setCurrent)
  const clearing = Boolean(clearable && current !== '' && current !== undefined)
  // Affixes are proportional text, so the value's inset is measured, not counted in `ch`.
  const prefixRef = useRef<HTMLSpanElement>(null)
  const suffixRef = useRef<HTMLSpanElement>(null)
  const [inset, setInset] = useState<{ start?: number, end?: number }>({})
  useLayoutEffect(() => {
    const start = prefixRef.current ? prefixRef.current.offsetLeft + prefixRef.current.offsetWidth : undefined
    const end = suffixRef.current ? suffixRef.current.offsetParent!.clientWidth - suffixRef.current.offsetLeft : undefined
    setInset(previous => previous.start === start && previous.end === end ? previous : { start, end })
  }, [prefix, suffix, clearing, size])
  const affixStyle = prefix || suffix
    ? { paddingInlineStart: inset.start === undefined ? undefined : `calc(${inset.start}px + 0.25rem)`, paddingInlineEnd: inset.end === undefined ? undefined : `calc(${inset.end}px + 0.25rem)` }
    : undefined
  return (
    <div className="relative" data-slot="lumi-input">
      {prefix && <span ref={prefixRef} className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-(--lumi-fg-secondary)" data-slot="lumi-input-prefix" aria-hidden>{prefix}</span>}
      <Input ref={masked?.ref} inputMode={masked?.inputMode} {...rest} className={cn(controlSizeClass(size), className)} style={affixStyle} value={masked?.display ?? current} aria-label={ariaLabel} aria-invalid={invalid} readOnly={readonly} data-appearance={appearance} data-lumi-control-size={controlSize(size)} onChange={masked?.onChange ?? (event => setCurrent(event.target.value))} />
      {suffix && <span ref={suffixRef} className={cn('pointer-events-none absolute inset-y-0 flex items-center text-(--lumi-fg-secondary)', clearing ? 'right-9' : 'right-2.5')} data-slot="lumi-input-suffix" aria-hidden>{suffix}</span>}
      {clearing && (
        <Button className="absolute top-1/2 right-1 -translate-y-1/2" type="button" variant="ghost" size="icon-sm" disabled={readonly || props.disabled} aria-label={t('lumi.common.clear', 'Clear')} onClick={() => setCurrent('')}>
          <XIcon />
        </Button>
      )}
    </div>
  )
}

export function LumiTextarea(props: TextareaProps & HostProps): ReactElement {
  const { value, defaultValue, onChange, ariaLabel, invalid, readonly, appearance = 'outline', autoResize, size, className, ...rest } = props
  const classes = [className, autoResize ? 'field-sizing-content resize-none' : undefined].filter(Boolean).join(' ')
  // `null` in state is an empty field, not an uncontrolled one.
  return <Textarea {...rest} className={classes} value={value === null ? '' : value} defaultValue={defaultValue} aria-label={ariaLabel} aria-invalid={invalid} readOnly={readonly} data-appearance={appearance} data-auto-resize={autoResize || undefined} data-lumi-control-size={controlSize(size)} onChange={event => onChange?.(event.target.value)} />
}

/**
 * Formatting marks are markdown, so the value stays the plain string the
 * protocol declares — nothing here needs an editor engine or a paste sanitizer.
 * `wrap` surrounds the selection, `prefix` opens the line the caret sits on.
 */
interface RichTextMark {
  value: string
  label: string
  Icon: typeof BoldIcon
  sample: string
  wrap?: readonly [string, string]
  prefix?: string
}

function richTextMarks(t: UiText['t']): RichTextMark[] {
  return [
    { value: 'bold', label: t('lumi.richText.bold', 'Bold'), Icon: BoldIcon, wrap: ['**', '**'] as const, sample: t('lumi.richText.boldSample', 'bold text') },
    { value: 'italic', label: t('lumi.richText.italic', 'Italic'), Icon: ItalicIcon, wrap: ['_', '_'] as const, sample: t('lumi.richText.italicSample', 'italic text') },
    { value: 'heading', label: t('lumi.richText.heading', 'Heading'), Icon: Heading2Icon, prefix: '## ', sample: t('lumi.richText.heading', 'Heading') },
    { value: 'bullet', label: t('lumi.richText.bullet', 'Bullet list'), Icon: ListIcon, prefix: '- ', sample: t('lumi.richText.bulletSample', 'List item') },
    { value: 'link', label: t('lumi.richText.link', 'Link'), Icon: LinkIcon, wrap: ['[', '](https://)'] as const, sample: t('lumi.richText.linkSample', 'label') },
  ]
}

export function LumiRichText(props: RichTextProps & HostProps): ReactElement {
  const { t } = useUiText()
  const marks = richTextMarks(t)
  const { value, defaultValue, onChange, ariaLabel, invalid, readonly, appearance = 'outline', autoResize, size, className, rows = 8, ...rest } = props
  const [current, setCurrent] = useControllableValue(value, defaultValue ?? '', next => onChange?.(String(next)))
  const field = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | undefined>(undefined)
  const locked = readonly || props.disabled
  useEffect(() => {
    if (caret.current === undefined || !field.current)
      return
    field.current.focus()
    field.current.setSelectionRange(caret.current, caret.current)
    caret.current = undefined
  }, [current])
  const apply = (mark: RichTextMark): void => {
    const target = field.current
    if (!target || locked)
      return
    const text = current ?? ''
    const [start, end] = [target.selectionStart, target.selectionEnd]
    const selected = text.slice(start, end) || mark.sample
    if (mark.prefix) {
      // Line marks toggle on the line holding the caret, so pressing the button
      // twice leaves the text as it was found.
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      const marked = text.slice(lineStart).startsWith(mark.prefix)
      caret.current = marked ? Math.max(lineStart, end - mark.prefix.length) : end + mark.prefix.length
      setCurrent(marked
        ? `${text.slice(0, lineStart)}${text.slice(lineStart + mark.prefix.length)}`
        : `${text.slice(0, lineStart)}${mark.prefix}${text.slice(lineStart)}`)
      return
    }
    const [before, after] = mark.wrap!
    caret.current = start + before.length + selected.length
    setCurrent(`${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`)
  }
  return (
    <div className={cn(FIELD_SURFACE, FIELD_FOCUS_WITHIN, FIELD_DISABLED_WITHIN, 'transition-colors', className)} data-slot="lumi-rich-text" data-appearance={appearance} data-lumi-control-size={controlSize(size)} data-disabled={props.disabled || undefined}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1" role="toolbar" aria-label={t('lumi.richText.formatting', '{name} formatting', { name: ariaLabel ?? t('lumi.richText.name', 'Rich text') })}>
        {marks.map(mark => (
          // A disabled editor already fades as a whole; its buttons do not fade twice.
          <Button key={mark.value} type="button" variant="ghost" size="icon-sm" className={props.disabled ? 'disabled:opacity-100' : undefined} disabled={locked} aria-label={mark.label} onClick={() => apply(mark)}>
            <mark.Icon />
          </Button>
        ))}
      </div>
      <Textarea
        {...rest}
        ref={field}
        className={cn(FIELD_BARE, autoResize && 'field-sizing-content resize-none')}
        value={current}
        rows={rows}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        readOnly={readonly}
        data-auto-resize={autoResize || undefined}
        onChange={event => setCurrent(event.target.value)}
      />
    </div>
  )
}

export function LumiNumberInput(props: NumberInputProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue, onChange, ariaLabel, invalid, readonly, appearance = 'outline', precision, step, size, prefix, suffix, className, ...rest } = props
  const controlled = value !== undefined
  const decimalPlaces = precision === undefined ? undefined : Math.min(100, Math.max(0, Math.trunc(precision)))
  const resolvedStep = step ?? (decimalPlaces === undefined ? undefined : 10 ** -decimalPlaces)
  const normalize = (input: number | null | undefined): number | null | undefined => input === null || input === undefined || decimalPlaces === undefined ? input : Number(input.toFixed(decimalPlaces))
  const parse = (event: ChangeEvent<HTMLInputElement>): number | null => {
    if (event.target.value === '')
      return null
    const parsed = Number(event.target.value)
    if (!Number.isFinite(parsed))
      return null
    return decimalPlaces === undefined ? parsed : Number(parsed.toFixed(decimalPlaces))
  }
  const field = useRef<HTMLInputElement>(null)
  const locked = readonly || rest.disabled
  // Steps by `step` (or the precision's unit), clamps to `min`/`max`, and
  // rounds away float noise before reporting through onChange like typing.
  const stepBy = (direction: 1 | -1): void => {
    const element = field.current
    if (!element)
      return
    const unit = resolvedStep ?? 1
    const current = element.value === '' ? null : Number(element.value)
    let next = current === null || !Number.isFinite(current) ? (rest.min ?? 0) : current + direction * unit
    if (rest.max !== undefined)
      next = Math.min(next, rest.max)
    if (rest.min !== undefined)
      next = Math.max(next, rest.min)
    // Keep the decimals already there: 1.5 stepped by 1 is 2.5, not 3.
    const places = decimalPlaces ?? Math.max(fractionDigits(unit), current === null || !Number.isFinite(current) ? 0 : fractionDigits(current), fractionDigits(rest.min ?? 0))
    next = Number(next.toFixed(places))
    if (!controlled)
      element.value = String(next)
    onChange?.(next)
  }
  const input = <Input {...rest} ref={field} className={cn(controlSizeClass(size), 'pr-[calc(var(--lumi-stepper-width)+var(--lumi-control-px-sm))] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')} style={prefix || suffix ? { paddingInlineStart: prefix ? `calc(${prefix.length}ch + 1.25rem)` : undefined, paddingInlineEnd: suffix ? `calc(${suffix.length}ch + 1.25rem + var(--lumi-stepper-width))` : undefined } : undefined} type="number" value={controlled ? normalize(value) ?? '' : undefined} defaultValue={controlled ? undefined : normalize(defaultValue) ?? undefined} step={resolvedStep} aria-label={ariaLabel} aria-invalid={invalid} readOnly={readonly} data-appearance={appearance} data-lumi-control-size={controlSize(size)} data-precision={decimalPlaces} onChange={event => onChange?.(parse(event))} />
  // The unit reads as part of the value ("$590", "20 items"), so it sits inside
  // the control's outline rather than as a separate label. The steppers are a
  // pointer convenience; the keyboard keeps the native arrow keys.
  return (
    <div className={cn('relative [--lumi-stepper-width:1.5rem]', className)} data-slot="lumi-input-affix">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-(--lumi-fg-secondary)" data-slot="lumi-input-prefix" aria-hidden>{prefix}</span>}
      {input}
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-[calc(var(--lumi-stepper-width)+0.625rem)] flex items-center text-(--lumi-fg-secondary)" data-slot="lumi-input-suffix" aria-hidden>{suffix}</span>}
      {!locked && (
        <span className="absolute inset-y-px right-px flex w-(--lumi-stepper-width) flex-col overflow-hidden rounded-r-[calc(var(--lumi-radius-control)-1px)] border-l border-input" data-slot="number-stepper">
          <button type="button" tabIndex={-1} className="flex flex-1 items-center justify-center text-muted-foreground hover:bg-hover hover:text-foreground" aria-label={t('lumi.number.increment', 'Increase')} onClick={() => stepBy(1)}><ChevronUpIcon className="size-3" aria-hidden /></button>
          <button type="button" tabIndex={-1} className="flex flex-1 items-center justify-center border-t border-input text-muted-foreground hover:bg-hover hover:text-foreground" aria-label={t('lumi.number.decrement', 'Decrease')} onClick={() => stepBy(-1)}><ChevronDownIcon className="size-3" aria-hidden /></button>
        </span>
      )}
    </div>
  )
}

/**
 * Options bound to remote data are `null` while a Query loads; choice controls
 * render as empty instead of failing, so the field survives until data arrives.
 */
const NO_OPTIONS: readonly never[] = []

export function LumiSelect(props: SelectProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = null, onChange, onSearch, options: inputOptions, placeholder, disabled, readonly, invalid, ariaLabel, size, appearance = 'outline', loading, filterable, clearable, className, id, name, labelPrefix } = props
  const options = inputOptions ?? NO_OPTIONS
  const [selected, setSelected] = useControllableValue(value, defaultValue, onChange)
  const values = new Map(options.map(option => [optionKey(option.value), option.value]))
  // Paging and media rows need the list surface the native select cannot host.
  if (filterable || props.onLoadMore || props.hasMore || options.some(option => option.avatar !== undefined || option.image)) {
    return (
      <SelectPopover
        {...props}
        options={options}
        selected={selected === null ? [] : [selected]}
        onSelect={setSelected}
        onClear={() => setSelected(null)}
        onSearch={onSearch}
      />
    )
  }
  return (
    <div className={cn('lumi-select-control relative w-full min-w-0', className)} data-clearable={(clearable && selected !== null) || undefined}>
      {name && <input type="hidden" name={name} value={selected === null ? '' : String(selected)} disabled={disabled} />}
      <Select
        value={selected === null ? '' : optionKey(selected)}
        disabled={disabled || readonly || loading}
        onValueChange={(next) => {
          // Ignore Radix's transient empty bubble input while async options register.
          const resolved = values.get(next)
          if (values.has(next) && resolved !== selected)
            setSelected(resolved!)
        }}
      >
        <SelectTrigger
          id={id}
          className={cn('lumi-select-trigger w-full min-w-0 justify-between text-start font-normal', FIELD_TRIGGER_CLASS,
          // With a prefix the value follows it and only the chevron keeps the far
          // edge. Radix's Value drops `className`, so the trigger styles it.
            labelPrefix && '[&>[data-slot=select-value]]:min-w-0 [&>[data-slot=select-value]]:flex-1 [&>[data-slot=select-value]]:text-start')}
          size={nativeSize(size)}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          aria-describedby={props['aria-describedby']}
          data-appearance={appearance}
          data-lumi-control-size={controlSize(size)}
        >
          {labelPrefix && <span className="shrink-0 text-muted-foreground" data-slot="select-prefix">{labelPrefix}</span>}
          <SelectValue placeholder={loading ? t('lumi.select.loading', 'Loading…') : placeholder} />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {options.map(option => (
              <SelectItem key={optionKey(option.value)} value={optionKey(option.value)} disabled={option.disabled}>
                <span>
                  {option.label}
                  {option.description && <span className="block text-xs text-muted-foreground">{option.description}</span>}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {clearable && selected !== null && (
        <Button type="button" className="lumi-select-clear" variant="ghost" size="icon-xs" disabled={disabled || readonly || loading} aria-label={t('lumi.select.clear', 'Clear selection')} onClick={() => setSelected(null)}>
          <XIcon />
        </Button>
      )}
    </div>
  )
}

export function LumiMultiSelect(props: MultiSelectProps & HostProps): ReactElement {
  const { value, defaultValue = [], onChange } = props
  const [selected, setSelected] = useControllableValue(value, defaultValue, onChange)
  return (
    <SelectPopover
      {...props}
      options={props.options ?? NO_OPTIONS}
      multiple
      selected={selected}
      onSelect={next => setSelected(selected.includes(next) ? selected.filter(value => value !== next) : [...selected, next])}
      onClear={() => setSelected([])}
    />
  )
}

export function LumiCheckbox(props: CheckboxProps & HostProps): ReactElement {
  const { value, defaultValue = false, onChange, label, disabled, readonly, invalid, ariaLabel, className, name } = props
  const [checked, setChecked] = useControllableValue(value, defaultValue, onChange)
  const generatedId = useId()
  const id = props.id ?? generatedId
  const unavailable = disabled || readonly
  const box = (
    <>
      {name && <input type="hidden" name={name} value={String(checked)} disabled={disabled} />}
      <Checkbox
        id={id}
        className={label ? undefined : className}
        checked={checked}
        disabled={disabled}
        aria-readonly={readonly || undefined}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        aria-describedby={props['aria-describedby']}
        onCheckedChange={(next) => {
          if (!readonly)
            setChecked(next === true)
        }}
      />
    </>
  )
  // Without a label there is no row to build — the caller (FormField) owns the
  // layout, so wrapping in a second Field would nest two flex rows.
  if (!label)
    return <>{box}</>
  return (
    <Field className={className} orientation="horizontal" data-invalid={invalid} data-disabled={unavailable}>
      {box}
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  )
}

export function LumiCheckboxGroup(props: CheckboxGroupProps & HostProps): ReactElement {
  const { value, defaultValue = [], onChange, options: inputOptions, direction = 'column', disabled, readonly, invalid, ariaLabel, appearance = 'outline', className, id, name } = props
  const options = inputOptions ?? NO_OPTIONS
  const [selected, setSelected] = useControllableValue(value, defaultValue, onChange)
  const idPrefix = useId()
  const unavailable = disabled || readonly
  return (
    <FieldSet className={className} aria-label={ariaLabel} aria-invalid={invalid} aria-describedby={props['aria-describedby']} aria-disabled={unavailable} disabled={disabled} data-appearance={appearance}>
      {name && <input type="hidden" name={name} value={JSON.stringify(selected)} disabled={disabled} />}
      <FieldContent className={direction === 'row' ? 'flex-row flex-wrap gap-3 [&>[data-slot=field]]:w-auto' : undefined}>
        {options.map((option, index) => {
          const optionId = index === 0 && id ? id : `${idPrefix}-${index}`
          const descriptionId = option.description ? `${optionId}-description` : undefined
          return (
            <Field key={optionKey(option.value)} orientation="horizontal" data-disabled={unavailable || option.disabled}>
              <Checkbox id={optionId} checked={selected.includes(option.value)} disabled={unavailable || option.disabled} aria-describedby={descriptionId} onCheckedChange={checked => setSelected(checked === true ? [...selected, option.value] : selected.filter(item => item !== option.value))} />
              <FieldContent>
                <FieldLabel htmlFor={optionId}>{option.label}</FieldLabel>
                {option.description && <FieldDescription id={descriptionId}>{option.description}</FieldDescription>}
              </FieldContent>
            </Field>
          )
        })}
      </FieldContent>
    </FieldSet>
  )
}

export function LumiRadioGroup(props: RadioGroupProps & HostProps): ReactElement {
  const { value, defaultValue, onChange, options: inputOptions, direction = 'column', disabled, readonly, invalid, ariaLabel, appearance = 'outline', className, name, id } = props
  const options = inputOptions ?? NO_OPTIONS
  const values = new Map(options.map(option => [optionKey(option.value), option.value]))
  const [selected, setSelected] = useControllableValue<OptionValue | undefined>(value, defaultValue, (next) => {
    if (next !== undefined)
      onChange?.(next)
  }, Object.hasOwn(props, 'value'))
  const idPrefix = useId()
  const unavailable = disabled || readonly
  return (
    <>
      {name && <input type="hidden" name={name} value={selected === undefined ? '' : String(selected)} disabled={disabled} />}
      <RadioGroup
        className={className}
        value={selected === undefined ? '' : optionKey(selected)}
        disabled={disabled}
        aria-readonly={readonly || undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={props['aria-describedby']}
        data-appearance={appearance}
        onValueChange={(next) => {
          if (!readonly)
            setSelected(values.get(next))
        }}
        style={direction === 'row' ? { gridAutoFlow: 'column', justifyContent: 'start' } : undefined}
      >
        {options.map((option, index) => {
          const optionId = index === 0 && id ? id : `${idPrefix}-${index}`
          const descriptionId = option.description ? `${optionId}-description` : undefined
          return (
            <Field key={optionKey(option.value)} orientation="horizontal" data-disabled={unavailable || option.disabled}>
              <RadioGroupItem id={optionId} value={optionKey(option.value)} disabled={disabled || option.disabled} aria-invalid={invalid} aria-describedby={descriptionId} />
              <FieldContent>
                <FieldLabel htmlFor={optionId}>{option.label}</FieldLabel>
                {option.description && <FieldDescription id={descriptionId}>{option.description}</FieldDescription>}
              </FieldContent>
            </Field>
          )
        })}
      </RadioGroup>
    </>
  )
}

export function LumiSwitch(props: SwitchProps & HostProps): ReactElement {
  const { value, defaultValue = false, onChange, label, disabled, readonly, invalid, ariaLabel, className, name } = props
  const [checked, setChecked] = useControllableValue(value, defaultValue, onChange)
  const generatedId = useId()
  const id = props.id ?? generatedId
  const unavailable = disabled || readonly
  const toggle = (
    <>
      {name && <input type="hidden" name={name} value={String(checked)} disabled={disabled} />}
      <Switch
        className={label ? undefined : className}
        id={id}
        checked={checked}
        disabled={disabled}
        aria-readonly={readonly || undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={props['aria-describedby']}
        onCheckedChange={(next) => {
          if (!readonly)
            setChecked(next)
        }}
      />
    </>
  )
  // See LumiCheckbox: the label-less form is the one FormField composes.
  if (!label)
    return <>{toggle}</>
  // Standalone the copy still claims the free space, so the toggle sits at the
  // far edge instead of leading the row.
  return (
    <Field className={className} orientation="horizontal" data-invalid={invalid} data-disabled={unavailable}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {toggle}
    </Field>
  )
}

export { LumiImageGrid, LumiUpload } from './upload.js'

/**
 * Text tags as chips. Enter or leaving the field commits; the value stays a
 * plain string array. The box is an Input surface and each chip is a soft
 * neutral Tag sized to the control, so one row of chips is one control high.
 */
export function LumiTagsInput(props: TagsInputProps & HostProps): ReactElement {
  const { value, defaultValue = [], onChange, placeholder, max, name, id, error, disabled, readonly, invalid, required, ariaLabel, appearance = 'outline', size, className } = props
  const [tags, setTags] = useControllableValue(value, defaultValue, onChange)
  const [text, setText] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const locked = disabled || readonly
  const full = max !== undefined && tags.length >= max
  const commit = (): void => {
    const tag = text.trim()
    if (tag && !full && !tags.includes(tag))
      setTags([...tags, tag])
    setText('')
  }
  return (
    <div
      className={cn('min-w-0', className)}
      data-slot="tags-input"
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-testid={props['data-testid']}
    >
      {name && <input type="hidden" name={name} value={JSON.stringify(tags)} disabled={disabled} />}
      {/* The padding around the chips belongs to the field, so a click there lands in it. */}
      <div
        className={cn(FIELD_SURFACE, FIELD_FOCUS_WITHIN, FIELD_DISABLED_WITHIN, 'transition-colors')}
        data-slot="tags-input-control"
        data-appearance={appearance}
        data-size={controlSize(size)}
        data-disabled={disabled || undefined}
        onClick={(event) => {
          if (event.target === event.currentTarget)
            field.current?.focus()
        }}
      >
        {tags.map((tag, index) => (
          <span key={`${tag}-${index}`} className="contents" data-slot="tags-input-chip">
            <LumiTag
              label={tag}
              size={controlSize(size)}
              closable={!locked}
              onClose={() => {
                setTags(tags.filter((_, itemIndex) => itemIndex !== index))
                field.current?.focus()
              }}
            />
          </span>
        ))}
        <input
          ref={field}
          id={id}
          data-slot="tags-input-field"
          value={text}
          placeholder={full ? undefined : placeholder}
          disabled={disabled}
          readOnly={readonly || full}
          required={required && !tags.length}
          aria-label={ariaLabel ?? props['aria-label']}
          aria-invalid={invalid}
          aria-describedby={props['aria-describedby']}
          onChange={event => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            // Enter while an IME is composing confirms the candidate, not the tag.
            if (event.nativeEvent.isComposing || event.keyCode === 229)
              return
            if (event.key === 'Enter') {
              // Never lets the surrounding form submit from inside this field.
              event.preventDefault()
              commit()
            }
            else if (event.key === 'Backspace' && !text && tags.length && !locked) {
              setTags(tags.slice(0, -1))
            }
          }}
        />
      </div>
      {error && <p role="alert" data-slot="tags-input-error">{error}</p>}
    </div>
  )
}
