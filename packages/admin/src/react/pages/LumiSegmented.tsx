import type { ReactElement } from 'react'

export interface LumiSegmentedOption {
  value: string
  label: string
}

export interface LumiSegmentedProps {
  options: readonly LumiSegmentedOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  className?: string
}

/**
 * A small set of mutually exclusive views of the same data, e.g. a reporting
 * period. The options sit in one sunken track so they read as one control,
 * not as a row of unrelated buttons.
 */
export function LumiSegmented({ options, value, onChange, ariaLabel, className }: LumiSegmentedProps): ReactElement {
  return (
    <div className={['lumi-segmented', className].filter(Boolean).join(' ')} role="group" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className="lumi-segmented__option"
          aria-pressed={option.value === value}
          data-active={option.value === value || undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
