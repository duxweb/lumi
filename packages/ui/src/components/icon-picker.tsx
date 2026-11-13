import type { KeyboardEvent, ReactElement } from 'react'
import type { IconPickerProps } from '../catalog/types-public.js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, loadOutlineIconNames, LumiIcon, peekOutlineIcon, SearchIcon, SearchRemoveIcon, XIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { Input } from '../internal/shadcn/input.js'
import { Popover, PopoverContent, PopoverTrigger } from '../internal/shadcn/popover.js'
import { Spinner } from '../internal/shadcn/spinner.js'
import { cn } from '../internal/utils.js'
import { FIELD_TRIGGER_CLASS, useControllableValue } from './control.js'
import { LumiEmpty } from './empty.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

const COLUMNS = 8
/** The set has thousands of icons; the grid renders a page at a time and grows as it scrolls. */
const PAGE = COLUMNS * 12
const QUERY_SPLIT_RE = /[\s-]+/

function IconCell({ name, selected, onPick }: { name: string, selected: boolean, onPick: () => void }): ReactElement {
  const Icon = peekOutlineIcon(name)
  return (
    <button
      type="button"
      className="flex size-control-md items-center justify-center rounded-item text-foreground outline-none hover:bg-hover hover:text-hover-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-selected aria-pressed:text-selected-foreground"
      aria-label={name}
      aria-pressed={selected}
      title={name}
      data-icon-name={name}
      onClick={onPick}
    >
      {Icon && <Icon className="size-4" aria-hidden />}
    </button>
  )
}

/** Picks a HugeIcons name from a searchable grid. */
export function LumiIconPicker(props: IconPickerProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, placeholder = t('lumi.icon.placeholder', 'Pick an icon'), clearable, size = 'md', appearance = 'outline', name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const [current, setCurrent] = useControllableValue(value, defaultValue, onChange)
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState<string[]>()
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const grid = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const label = ariaLabel ?? props['aria-label'] ?? t('lumi.icon.name', 'Icon')
  const locked = disabled || readonly

  useEffect(() => {
    if (!open || names)
      return
    let active = true
    // A set that fails to load (offline, a blocked chunk) shows as no icons rather than loading forever.
    loadOutlineIconNames().then(loaded => loaded, () => [] as string[]).then((loaded) => {
      if (active)
        setNames(loaded)
    })
    return () => {
      active = false
    }
  }, [open, names])

  const matches = useMemo(() => {
    const terms = query.trim().toLowerCase().split(QUERY_SPLIT_RE).filter(Boolean)
    return (names ?? []).filter(item => terms.every(term => item.toLowerCase().includes(term)))
  }, [names, query])
  const visible = matches.slice(0, limit)

  const pick = (next: string): void => {
    if (!locked && next !== current)
      setCurrent(next)
    setOpen(false)
  }
  const navigate = (event: KeyboardEvent<HTMLDivElement>): void => {
    const cells = Array.from(grid.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const index = cells.indexOf(document.activeElement as HTMLButtonElement)
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }
    if (index < 0 || !(event.key in moves || event.key === 'Home' || event.key === 'End'))
      return
    event.preventDefault()
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? cells.length - 1 : index + moves[event.key]!
    if (target < 0 && event.key === 'ArrowUp') {
      document.getElementById(`${panelId}-search`)?.focus()
      return
    }
    if (target >= cells.length && limit < matches.length)
      setLimit(limit + PAGE)
    cells[Math.max(0, Math.min(cells.length - 1, target))]?.focus()
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-slot="lumi-icon-picker" data-testid={props['data-testid']}>
      {name && <input type="hidden" name={name} value={current ?? ''} disabled={disabled} />}
      <div className="lumi-select-control relative w-full min-w-0" data-clearable={(clearable && Boolean(current)) || undefined}>
        <Popover
          open={open && !locked}
          onOpenChange={(next) => {
            setOpen(next && !locked)
            if (!next) {
              setQuery('')
              setLimit(PAGE)
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn('lumi-select-trigger w-full min-w-0 justify-between gap-2 text-start font-normal', FIELD_TRIGGER_CLASS)}
              aria-label={current ? `${label}: ${current}` : label}
              aria-haspopup="dialog"
              aria-controls={open ? panelId : undefined}
              aria-expanded={open && !locked}
              aria-invalid={invalid}
              aria-describedby={props['aria-describedby']}
              disabled={locked}
              data-slot="select-trigger"
              data-lumi-control-size={size}
              data-appearance={appearance}
              data-placeholder={current ? undefined : true}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {current && <LumiIcon name={current} className="size-4 shrink-0 text-foreground" />}
                <span className="truncate">{current || placeholder}</span>
              </span>
              <ChevronDownIcon className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            id={panelId}
            align="start"
            collisionPadding={8}
            className="w-[calc(var(--lumi-control-md)*8+var(--lumi-popover-padding)*2+1.75rem)] max-w-[calc(100vw-1rem)] gap-2"
            aria-label={t('lumi.icon.panel', '{name} choices', { name: label })}
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              document.getElementById(`${panelId}-search`)?.focus()
            }}
          >
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id={`${panelId}-search`}
                className="ps-8"
                value={query}
                placeholder={t('lumi.icon.search', 'Search icons…')}
                aria-label={t('lumi.icon.search', 'Search icons…')}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setLimit(PAGE)
                  grid.current?.scrollTo?.({ top: 0 })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    grid.current?.querySelector<HTMLButtonElement>('button')?.focus()
                  }
                  else if (event.key === 'Enter' && matches[0]) {
                    event.preventDefault()
                    pick(matches[0])
                  }
                }}
              />
            </div>
            {!names
              ? (
                  <p className="m-0 flex h-48 items-center justify-center gap-2 text-meta text-muted-foreground" role="status">
                    <Spinner />
                    {t('lumi.icon.loading', 'Loading icons…')}
                  </p>
                )
              : matches.length === 0
                ? <LumiEmpty size="xs" role="status" className="h-48" icon={<SearchRemoveIcon />} title={t('lumi.icon.empty', 'No icons match')} />
                : (
                    <div
                      ref={grid}
                      role="group"
                      aria-label={t('lumi.icon.results', '{count} icons', { count: matches.length })}
                      className="grid h-60 grid-cols-8 content-start gap-0.5 overflow-y-auto overscroll-contain"
                      data-slot="icon-picker-grid"
                      onKeyDown={navigate}
                      onScroll={(event) => {
                        const element = event.currentTarget
                        if (element.scrollTop + element.clientHeight > element.scrollHeight - 80 && limit < matches.length)
                          setLimit(limit + PAGE)
                      }}
                    >
                      {visible.map(item => <IconCell key={item} name={item} selected={item === current} onPick={() => pick(item)} />)}
                    </div>
                  )}
            {names && (
              <p className="m-0 flex items-center justify-between gap-2 text-meta text-muted-foreground" data-slot="icon-picker-footer">
                <span>{t('lumi.icon.results', '{count} icons', { count: matches.length })}</span>
                {current && <span className="truncate font-mono">{current}</span>}
              </p>
            )}
          </PopoverContent>
        </Popover>
        {clearable && current && (
          <Button type="button" variant="ghost" size="icon-xs" className="lumi-select-clear" disabled={locked} aria-label={t('lumi.icon.clear', 'Clear icon')} onClick={() => setCurrent('')}>
            <XIcon />
          </Button>
        )}
      </div>
      {error && <p role="alert" className="text-meta text-destructive" data-slot="icon-picker-error">{error}</p>}
    </div>
  )
}
