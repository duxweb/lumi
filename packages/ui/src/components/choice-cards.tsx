import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { CheckboxCardsProps, ChoiceCardOption, OptionValue, RadioCardsProps } from '../catalog/types-public.js'
import { useId } from 'react'
import { LumiIcon } from '../icons.js'
import { ChoiceCardCheckbox, ChoiceCardGroup, ChoiceCardRadio } from '../internal/choice-card.js'
import { cn } from '../internal/utils.js'
import { optionKey, useControllableValue } from './control.js'
import { LumiBadge } from './display.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

const NO_OPTIONS: readonly never[] = []

/**
 * As many cards of at least the minimum width as fit; `columns` caps the count, so narrow screens still stack.
 * Without a cap the cards share the row between them rather than leaving empty tracks at its end.
 */
function gridStyle(columns: number | undefined): CSSProperties {
  const least = 'min(100%, var(--lumi-choice-card-min))'
  const track = columns ? `max(${least}, calc((100% - ${columns - 1} * var(--lumi-choice-card-gap)) / ${columns}))` : least
  return { gridTemplateColumns: `repeat(${columns ? 'auto-fill' : 'auto-fit'}, minmax(${track}, 1fr))` }
}

function CardBody({ option, descriptionId }: { option: ChoiceCardOption, descriptionId: string | undefined }): ReactElement {
  return (
    <>
      {option.icon && (
        <span className="flex size-control-sm shrink-0 items-center justify-center rounded-item bg-muted text-muted-foreground group-data-[state=checked]/choice-card:text-foreground" data-slot="choice-card-icon">
          <LumiIcon name={option.icon} className="size-4" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Title and badge wrap between themselves; the price holds the first line's end instead of dropping under them. */}
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 text-control font-medium text-foreground" data-slot="choice-card-title">{option.label}</span>
            {option.badge && <LumiBadge label={option.badge} tone="brand" />}
          </span>
          {option.extra && <span className="shrink-0 text-control font-medium text-foreground tabular-nums" data-slot="choice-card-extra">{option.extra}</span>}
        </span>
        {option.description && <span id={descriptionId} className="text-meta text-muted-foreground" data-slot="choice-card-description">{option.description}</span>}
      </span>
    </>
  )
}

function Frame({ children, error, size, className, testId }: { children: ReactNode, error?: string | undefined, size: string, className?: string | undefined, testId?: string | undefined }): ReactElement {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-slot="lumi-choice-cards" data-size={size} data-testid={testId}>
      {children}
      {error && <p role="alert" className="text-meta text-destructive" data-slot="choice-cards-error">{error}</p>}
    </div>
  )
}

/** One option, each shown as a card. Arrow keys move between the cards. */
export function LumiRadioCards(props: RadioCardsProps & HostProps): ReactElement {
  const { value, defaultValue, onChange, options: inputOptions, columns, size = 'md', indicator, name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const options = inputOptions ?? NO_OPTIONS
  const values = new Map(options.map(option => [optionKey(option.value), option.value]))
  const [selected, setSelected] = useControllableValue<OptionValue | undefined>(value, defaultValue, (next) => {
    if (next !== undefined)
      onChange?.(next)
  }, Object.hasOwn(props, 'value'))
  const prefix = useId()
  return (
    <Frame error={error} size={size} className={className} testId={props['data-testid']}>
      {name && <input type="hidden" name={name} value={selected === undefined ? '' : String(selected)} disabled={disabled} />}
      <ChoiceCardGroup
        id={id}
        style={gridStyle(columns)}
        value={selected === undefined ? '' : optionKey(selected)}
        disabled={disabled}
        aria-label={ariaLabel ?? props['aria-label']}
        aria-invalid={invalid}
        aria-readonly={readonly || undefined}
        aria-describedby={props['aria-describedby']}
        onValueChange={(next) => {
          if (!readonly)
            setSelected(values.get(next))
        }}
      >
        {options.map((option, index) => {
          const descriptionId = option.description ? `${prefix}-${index}` : undefined
          return (
            // ARIA allows readonly on the radio group, not on a radio; the card keeps a data hook for its styling.
            <ChoiceCardRadio key={optionKey(option.value)} value={optionKey(option.value)} disabled={disabled || option.disabled} indicator={indicator} aria-invalid={invalid} data-readonly={readonly || undefined} aria-describedby={descriptionId}>
              <CardBody option={option} descriptionId={descriptionId} />
            </ChoiceCardRadio>
          )
        })}
      </ChoiceCardGroup>
    </Frame>
  )
}

/** Several options, each shown as a card that toggles. */
export function LumiCheckboxCards(props: CheckboxCardsProps & HostProps): ReactElement {
  const { value, defaultValue = [], onChange, options: inputOptions, columns, size = 'md', indicator, name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const options = inputOptions ?? NO_OPTIONS
  const [selected, setSelected] = useControllableValue(value, defaultValue, onChange)
  const prefix = useId()
  return (
    <Frame error={error} size={size} className={className} testId={props['data-testid']}>
      {name && <input type="hidden" name={name} value={JSON.stringify(selected)} disabled={disabled} />}
      <div
        id={id}
        role="group"
        className="grid gap-(--lumi-choice-card-gap)"
        style={gridStyle(columns)}
        aria-label={ariaLabel ?? props['aria-label']}
        aria-invalid={invalid}
        aria-describedby={props['aria-describedby']}
        data-slot="choice-cards"
      >
        {options.map((option, index) => {
          const descriptionId = option.description ? `${prefix}-${index}` : undefined
          return (
            <ChoiceCardCheckbox
              key={optionKey(option.value)}
              checked={selected.includes(option.value)}
              disabled={disabled || option.disabled}
              indicator={indicator}
              aria-invalid={invalid}
              aria-readonly={readonly || undefined}
              aria-describedby={descriptionId}
              onCheckedChange={(checked) => {
                if (!readonly)
                  setSelected(options.filter(item => item === option ? checked === true : selected.includes(item.value)).map(item => item.value))
              }}
            >
              <CardBody option={option} descriptionId={descriptionId} />
            </ChoiceCardCheckbox>
          )
        })}
      </div>
    </Frame>
  )
}
