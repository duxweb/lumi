import type { KeyboardEvent, ReactElement } from 'react'
import type { RatingProps } from '../catalog/types-public.js'
import { useState } from 'react'
import { StarIcon, useOutlineIcon } from '../icons.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

/** A score shown as icons. Interactive, it is one slider stop per step; read-only, it is an image of the score. */
export function LumiRating(props: RatingProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = 0, onChange, count = 5, allowHalf, icon, clearable, tone = 'warning', size = 'md', name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const [current, setCurrent] = useControllableValue(value, defaultValue, onChange)
  const [hover, setHover] = useState<number>()
  const Icon = useOutlineIcon(icon) ?? StarIcon
  const step = allowHalf ? 0.5 : 1
  const score = Math.min(count, Math.max(0, Math.round((current ?? 0) / step) * step))
  const locked = disabled || readonly
  const shown = locked ? score : hover ?? score
  const label = ariaLabel ?? props['aria-label']
  const spoken = t('lumi.rating.value', '{value} of {count}', { value: score, count })
  const choose = (next: number): void => {
    if (locked)
      return
    const target = Math.min(count, Math.max(0, next))
    setCurrent(clearable && target === score ? 0 : target)
  }
  const pointed = (event: { currentTarget: HTMLElement, clientX: number }, index: number): number => {
    if (!allowHalf)
      return index + 1
    const rect = event.currentTarget.getBoundingClientRect()
    const before = document.dir === 'rtl' ? event.clientX > rect.left + rect.width / 2 : event.clientX < rect.left + rect.width / 2
    return index + (before ? 0.5 : 1)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const moves: Record<string, number> = { ArrowRight: score + step, ArrowUp: score + step, ArrowLeft: score - step, ArrowDown: score - step, Home: 0, End: count }
    if (event.key in moves) {
      event.preventDefault()
      const target = Math.min(count, Math.max(0, moves[event.key]!))
      if (target !== score && !locked)
        setCurrent(target)
    }
    else if ((event.key === 'Delete' || event.key === 'Backspace') && clearable && !locked) {
      event.preventDefault()
      setCurrent(0)
    }
  }
  const interactive = !readonly
  return (
    <div className={cn('inline-flex min-w-0 flex-col gap-1.5', className)} data-slot="lumi-rating-field" data-testid={props['data-testid']}>
      {name && <input type="hidden" name={name} value={String(score)} disabled={disabled} />}
      <div
        id={id}
        data-slot="lumi-rating"
        data-size={size}
        data-tone={tone}
        data-disabled={disabled || undefined}
        data-readonly={readonly || undefined}
        data-invalid={invalid || undefined}
        className="inline-flex w-fit items-center gap-0.5 rounded-item outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        {...(interactive
          ? {
              'role': 'slider',
              'tabIndex': disabled ? -1 : 0,
              'aria-label': label,
              'aria-valuemin': 0,
              'aria-valuemax': count,
              'aria-valuenow': score,
              'aria-valuetext': spoken,
              'aria-disabled': disabled || undefined,
              'aria-invalid': invalid,
              'aria-describedby': props['aria-describedby'],
              onKeyDown,
            }
          : { 'role': 'img', 'aria-label': label ? `${label}: ${spoken}` : spoken })}
        onPointerLeave={() => setHover(undefined)}
      >
        {Array.from({ length: count }, (_, index) => {
          const fill = Math.min(1, Math.max(0, shown - index))
          return (
            <span
              // Stars are positions, not items; the index is their identity.
              key={index}
              data-slot="rating-item"
              data-fill={fill === 1 ? 'full' : fill > 0 ? 'half' : 'empty'}
              onPointerMove={locked ? undefined : event => setHover(pointed(event, index))}
              onClick={locked ? undefined : event => choose(pointed(event, index))}
            >
              <Icon aria-hidden fill="currentColor" data-slot="rating-empty" />
              {fill > 0 && (
                <span data-slot="rating-fill" style={{ width: `${fill * 100}%` }}>
                  <Icon aria-hidden fill="currentColor" />
                </span>
              )}
            </span>
          )
        })}
      </div>
      {error && <p role="alert" className="text-meta text-destructive" data-slot="rating-error">{error}</p>}
    </div>
  )
}
