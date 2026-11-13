import type { BadgeTone } from '@duxweb/lumi-ui'
import type { DragEvent, KeyboardEvent, ReactElement } from 'react'
import type { LumiKanbanKey, LumiKanbanMove } from './kanbanModel.js'
import { LumiAvatar as Avatar, LumiBadge as Badge, LumiButton as Button, LumiEmpty as Empty, LumiMenu as Menu, useUiText } from '@duxweb/lumi-ui'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronRightIcon, ClockIcon, PlusIcon } from '../icons.js'
import { columnCards, dropIndex, keyboardTarget, moveCard } from './kanbanModel.js'
import { parseScheduleDate, startOfDay } from './scheduleModel.js'

export type { LumiKanbanKey, LumiKanbanMove } from './kanbanModel.js'

export type LumiKanbanPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface LumiKanbanCard {
  id: LumiKanbanKey
  title: string
  description?: string | undefined
  tags?: readonly { label: string, tone?: BadgeTone | undefined }[] | undefined
  assignee?: { name: string, src?: string | null | undefined } | undefined
  /** `YYYY-MM-DD`; past dates outside a `done` column read as overdue. */
  dueDate?: string | undefined
  priority?: LumiKanbanPriority | undefined
  [field: string]: unknown
}

export interface LumiKanbanColumn {
  value: string
  title: string
  /** Work-in-progress limit; the count turns to a warning above it. */
  limit?: number | undefined
  /** Starts folded to a narrow strip. */
  collapsed?: boolean | undefined
  /** Finished work: due dates here are never overdue. */
  done?: boolean | undefined
}

export interface LumiKanbanProps {
  columns: readonly LumiKanbanColumn[]
  /** Every card on the board, in board order; each names its column in `columnField`. */
  value: readonly LumiKanbanCard[] | null | undefined
  onValueChange?: (cards: LumiKanbanCard[]) => void
  /** One card moved; persist `to` and `rank` for the card `id`. */
  onMove?: (move: LumiKanbanMove) => void
  /** The add button of a column was pressed. */
  onAdd?: (column: string) => void
  onCardClick?: (card: LumiKanbanCard) => void
  columnField?: string
  rankField?: string
  /** Reference day for overdue dates, `YYYY-MM-DD`; defaults to today. */
  today?: string
  ariaLabel?: string
  /** Hides add buttons and disables moving. */
  readonly?: boolean
  loading?: boolean
  className?: string
}

interface Target { column: string, index: number }
interface Active { id: LumiKanbanKey, mode: 'pointer' | 'keyboard', target?: Target | undefined }

// Stable while a Query is still loading, so the board keeps its local order.
const NO_CARDS: readonly LumiKanbanCard[] = []
const PRIORITY_TONE: Record<LumiKanbanPriority, string> = { low: 'neutral', medium: 'info', high: 'warning', urgent: 'danger' }

/**
 * Columns of cards that move by native drag and drop or from the keyboard.
 * The board owns only the in-flight order: a new `value` replaces it, so a
 * page that refetches after saving shows the server's order again.
 */
export function LumiKanban(props: LumiKanbanProps): ReactElement {
  const { t, locale } = useUiText()
  const value = props.value ?? NO_CARDS
  const { columns, onValueChange, onMove, onAdd, onCardClick, columnField = 'status', rankField = 'rank', today, ariaLabel, readonly, loading, className } = props
  const [local, setLocal] = useState({ source: value, cards: value as LumiKanbanCard[] })
  const cards = local.source === value ? local.cards : (value as LumiKanbanCard[])
  const [collapsed, setCollapsed] = useState(() => new Set(columns.filter(column => column.collapsed).map(column => column.value)))
  const [active, setActive] = useState<Active>()
  const [announcement, setAnnouncement] = useState('')
  const focusAfterMove = useRef<LumiKanbanKey>(undefined)
  const boardRef = useRef<HTMLDivElement>(null)
  const instructionsId = useId()

  const titleOf = (column: string): string => columns.find(item => item.value === column)?.title ?? column
  const dueFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }), [locale])
  const todayStart = useMemo(() => startOfDay((today && parseScheduleDate(today)) || new Date()), [today])
  const priorityLabel: Record<LumiKanbanPriority, string> = {
    low: t('lumi.kanban.priorityLow', 'Low'),
    medium: t('lumi.kanban.priorityMedium', 'Medium'),
    high: t('lumi.kanban.priorityHigh', 'High'),
    urgent: t('lumi.kanban.priorityUrgent', 'Urgent'),
  }

  // Slots of each column with the moving card taken out, the space it can drop into.
  const sizes = columns.map(column => ({ value: column.value, size: columnCards(cards, column.value, columnField).filter(card => card.id !== active?.id).length }))

  useEffect(() => {
    const id = focusAfterMove.current
    if (id === undefined)
      return
    focusAfterMove.current = undefined
    const key = `${typeof id}:${id}`
    Array.from(boardRef.current?.querySelectorAll<HTMLElement>('[data-card-key]') ?? []).find(element => element.dataset.cardKey === key)?.focus()
  })

  const describe = (target: Target): string => {
    const total = (sizes.find(size => size.value === target.column)?.size ?? 0) + 1
    return t('lumi.kanban.position', '{column}, position {position} of {total}.', { column: titleOf(target.column), position: target.index + 1, total })
  }

  const commit = (id: LumiKanbanKey, target: Target): void => {
    const card = cards.find(item => item.id === id)
    if (!card)
      return
    const from = String(card[columnField])
    const original = columnCards(cards, from, columnField).findIndex(item => item.id === id)
    if (from === target.column && original === target.index)
      return
    const result = moveCard(cards, id, target.column, target.index, { columnField, rankField })
    if (!result)
      return
    setLocal({ source: value, cards: result.cards })
    focusAfterMove.current = id
    setAnnouncement(t('lumi.kanban.dropped', 'Moved {card} to {column}, position {position}.', { card: card.title, column: titleOf(target.column), position: target.index + 1 }))
    onValueChange?.(result.cards)
    onMove?.(result.move)
  }

  const startOf = (card: LumiKanbanCard): Target => {
    const column = String(card[columnField])
    return { column, index: columnCards(cards, column, columnField).findIndex(item => item.id === card.id) }
  }

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, card: LumiKanbanCard): void => {
    const picked = active?.mode === 'keyboard' && active.id === card.id ? active : undefined
    if (!picked) {
      if (event.key === ' ' && !readonly) {
        event.preventDefault()
        const target = startOf(card)
        setActive({ id: card.id, mode: 'keyboard', target })
        setAnnouncement(`${t('lumi.kanban.picked', 'Picked up {card}.', { card: card.title })} ${describe(target)}`)
      }
      else if (event.key === 'Enter' && onCardClick) {
        event.preventDefault()
        onCardClick(card)
      }
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const target = keyboardTarget(picked.target ?? startOf(card), event.key, sizes.filter(size => !collapsed.has(size.value) || size.value === picked.target?.column))
      setActive({ ...picked, target })
      setAnnouncement(describe(target))
    }
    else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      setActive(undefined)
      if (picked.target)
        commit(card.id, picked.target)
    }
    else if (event.key === 'Escape') {
      event.preventDefault()
      setActive(undefined)
      setAnnouncement(t('lumi.kanban.cancelled', 'Move cancelled. {card} stays in {column}.', { card: card.title, column: titleOf(String(card[columnField])) }))
    }
  }

  const onDragStart = (event: DragEvent<HTMLElement>, card: LumiKanbanCard): void => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(card.id))
    // The browser snapshots the drag image right after this handler, so the
    // lift is on the element only for that frame.
    const element = event.currentTarget
    element.dataset.lift = ''
    requestAnimationFrame(() => delete element.dataset.lift)
    setActive({ id: card.id, mode: 'pointer' })
  }

  const onListDragOver = (event: DragEvent<HTMLElement>, column: string, folded = false): void => {
    if (active?.mode !== 'pointer')
      return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const midpoints = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-card-key]'))
      .filter(element => element.dataset.active === undefined)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return rect.top + rect.height / 2
      })
    // A folded column shows no cards to aim between; it takes the card at its end.
    const index = folded ? (sizes.find(size => size.value === column)?.size ?? 0) : dropIndex(midpoints, event.clientY)
    if (active.target?.column !== column || active.target.index !== index)
      setActive({ ...active, target: { column, index } })
  }

  const onListDrop = (event: DragEvent<HTMLElement>): void => {
    if (active?.mode !== 'pointer')
      return
    event.preventDefault()
    setActive(undefined)
    if (active.target)
      commit(active.id, active.target)
  }

  const menuItems = (card: LumiKanbanCard): { key: string, label: string, group?: string, disabled?: boolean }[] => {
    const { column, index } = startOf(card)
    const size = columnCards(cards, column, columnField).length
    return [
      { key: 'up', label: t('lumi.kanban.moveUp', 'Move up'), disabled: index <= 0 },
      { key: 'down', label: t('lumi.kanban.moveDown', 'Move down'), disabled: index >= size - 1 },
      ...columns.filter(item => item.value !== column).map(item => ({ key: `to:${item.value}`, label: t('lumi.kanban.moveTo', 'Move to {column}', { column: item.title }), group: t('lumi.kanban.moveToGroup', 'Column') })),
    ]
  }

  const onMenuSelect = (card: LumiKanbanCard, key: string): void => {
    const { column, index } = startOf(card)
    if (key === 'up' || key === 'down')
      commit(card.id, { column, index: index + (key === 'up' ? -1 : 1) })
    else if (key.startsWith('to:'))
      commit(card.id, { column: key.slice(3), index: columnCards(cards, key.slice(3), columnField).length })
  }

  const toggle = (column: string): void => setCollapsed((current) => {
    const next = new Set(current)
    if (!next.delete(column))
      next.add(column)
    return next
  })

  return (
    <section className={['lumi-kanban', className].filter(Boolean).join(' ')} aria-label={ariaLabel ?? t('lumi.kanban.board', 'Board')} aria-busy={loading || undefined}>
      <p id={instructionsId} className="sr-only">
        {t('lumi.kanban.instructions', 'Press Space to pick up a card, arrow keys to move it, then Space to drop or Escape to cancel.')}
      </p>
      <p className="sr-only" role="status" aria-live="assertive">{announcement}</p>
      <div ref={boardRef} className="lumi-kanban__board" data-dragging={active ? '' : undefined}>
        {columns.map((column) => {
          const list = columnCards(cards, column.value, columnField)
          const count = list.length
          const over = column.limit !== undefined && count > column.limit
          const folded = collapsed.has(column.value)
          const titleId = `${instructionsId}-${column.value}`
          const target = active?.target?.column === column.value ? active.target.index : undefined
          let slot = 0
          const indicator = <li key="lumi-kanban-drop" className="lumi-kanban__indicator" aria-hidden />
          return (
            <section
              key={column.value}
              className="lumi-kanban__column"
              aria-labelledby={titleId}
              data-collapsed={folded || undefined}
              data-over-limit={over || undefined}
              data-target={target !== undefined || undefined}
              onDragOver={folded ? event => onListDragOver(event, column.value, true) : undefined}
              onDrop={folded ? onListDrop : undefined}
            >
              <header className="lumi-kanban__header">
                <button
                  type="button"
                  className="lumi-kanban__toggle"
                  aria-expanded={!folded}
                  aria-label={folded ? t('lumi.kanban.expand', 'Expand {column}', { column: column.title }) : t('lumi.kanban.collapse', 'Collapse {column}', { column: column.title })}
                  onClick={() => toggle(column.value)}
                >
                  <ChevronRightIcon aria-hidden className="size-4" />
                </button>
                <h3 id={titleId} className="lumi-kanban__title">{column.title}</h3>
                <span
                  className="lumi-kanban__count"
                  data-tone={over ? 'warning' : undefined}
                  aria-label={column.limit === undefined
                    ? t('lumi.kanban.count', '{count} cards', { count })
                    : over
                      ? t('lumi.kanban.overLimit', '{count} cards, over the limit of {limit}', { count, limit: column.limit })
                      : t('lumi.kanban.countLimit', '{count} of {limit} cards', { count, limit: column.limit })}
                >
                  {column.limit === undefined ? count : `${count} / ${column.limit}`}
                </span>
                {!readonly && onAdd && !folded && (
                  <Button appearance="ghost" size="sm" shape="square" aria-label={t('lumi.kanban.add', 'Add card to {column}', { column: column.title })} className="lumi-kanban__add" onClick={() => onAdd(column.value)}>
                    <PlusIcon aria-hidden />
                  </Button>
                )}
              </header>
              {!folded && (
                <ol className="lumi-kanban__cards" aria-labelledby={titleId} onDragOver={event => onListDragOver(event, column.value)} onDrop={onListDrop}>
                  {list.flatMap((card) => {
                    const moving = card.id === active?.id
                    const before = !moving && slot === target ? [indicator] : []
                    if (!moving)
                      slot += 1
                    const view = (
                      <KanbanCardView
                        key={`${typeof card.id}:${card.id}`}
                        card={card}
                        active={moving ? active!.mode : undefined}
                        draggable={!readonly}
                        describedBy={instructionsId}
                        overdue={isOverdue(card, column, todayStart)}
                        dueLabel={card.dueDate ? formatDue(card.dueDate, dueFormat) : undefined}
                        priorityLabel={card.priority ? priorityLabel[card.priority] : undefined}
                        onKeyDown={event => onCardKeyDown(event, card)}
                        onDragStart={event => onDragStart(event, card)}
                        onDragEnd={() => setActive(undefined)}
                        onBlur={() => active?.mode === 'keyboard' && active.id === card.id && setActive(undefined)}
                        onClick={onCardClick ? () => onCardClick(card) : undefined}
                        menu={readonly ? undefined : { items: menuItems(card), onSelect: key => onMenuSelect(card, key) }}
                        moveLabel={t('lumi.kanban.moveMenu', 'Move {card}', { card: card.title })}
                      />
                    )
                    return [...before, view]
                  })}
                  {target !== undefined && target >= slot && indicator}
                  {count === 0 && target === undefined && <li className="lumi-kanban__empty">{loading ? t('lumi.select.loading', 'Loading…') : <Empty size="xs" title={t('lumi.kanban.empty', 'No cards')} />}</li>}
                </ol>
              )}
            </section>
          )
        })}
      </div>
    </section>
  )
}

function isOverdue(card: LumiKanbanCard, column: LumiKanbanColumn, today: Date): boolean {
  if (column.done || !card.dueDate)
    return false
  const due = parseScheduleDate(card.dueDate)
  return Boolean(due && startOfDay(due) < today)
}

function formatDue(value: string, format: Intl.DateTimeFormat): string {
  const date = parseScheduleDate(value)
  return date ? format.format(date) : value
}

interface KanbanCardViewProps {
  card: LumiKanbanCard
  active: Active['mode'] | undefined
  draggable: boolean
  describedBy: string
  overdue: boolean
  dueLabel: string | undefined
  priorityLabel: string | undefined
  moveLabel: string
  menu: { items: { key: string, label: string, group?: string, disabled?: boolean }[], onSelect: (key: string) => void } | undefined
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onBlur: () => void
  onClick: (() => void) | undefined
}

function KanbanCardView({ card, active, draggable, describedBy, overdue, dueLabel, priorityLabel, moveLabel, menu, onKeyDown, onDragStart, onDragEnd, onBlur, onClick }: KanbanCardViewProps): ReactElement {
  const { t } = useUiText()
  const hasTags = Boolean(card.tags?.length)
  return (
    <li className="lumi-kanban__item" data-active={active}>
      <div
        role="button"
        tabIndex={0}
        className="lumi-kanban__card"
        data-card-key={`${typeof card.id}:${card.id}`}
        data-active={active}
        aria-roledescription={t('lumi.kanban.cardRole', 'Draggable card')}
        aria-describedby={describedBy}
        draggable={draggable}
        onKeyDown={onKeyDown}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onBlur={onBlur}
        onClick={onClick}
      >
        <span className="lumi-kanban__body">
          <span className="lumi-kanban__card-title">
            {card.priority && (
              <span className="lumi-kanban__priority" data-tone={PRIORITY_TONE[card.priority]} title={priorityLabel}>
                <span className="sr-only">{t('lumi.kanban.priority', 'Priority: {priority}', { priority: priorityLabel })}</span>
              </span>
            )}
            <span className="lumi-kanban__card-text">{card.title}</span>
          </span>
          {card.description && <span className="lumi-kanban__description">{card.description}</span>}
        </span>
        {/* The assignee rides the last meta line, so it never takes a row of its own. */}
        {(hasTags || dueLabel || card.assignee) && (
          <span className="lumi-kanban__footer">
            {(hasTags || dueLabel) && (
              <span className="lumi-kanban__meta">
                {hasTags && (
                  <span className="lumi-kanban__tags">
                    {card.tags!.map(tag => <Badge key={tag.label} label={tag.label} tone={tag.tone ?? 'neutral'} appearance="soft" />)}
                  </span>
                )}
                {dueLabel && (
                  <span className="lumi-kanban__due" data-overdue={overdue || undefined}>
                    <ClockIcon aria-hidden className="size-3.5" />
                    {overdue ? t('lumi.kanban.overdue', 'Overdue · {date}', { date: dueLabel }) : dueLabel}
                  </span>
                )}
              </span>
            )}
            {card.assignee && <Avatar name={card.assignee.name} src={card.assignee.src} size="sm" className="lumi-kanban__assignee" />}
          </span>
        )}
      </div>
      {menu && (
        <Menu label={moveLabel} icon="more-horizontal" appearance="ghost" size="sm" shape="square" align="end" items={menu.items} onSelect={menu.onSelect} className="lumi-kanban__menu" />
      )}
    </li>
  )
}
