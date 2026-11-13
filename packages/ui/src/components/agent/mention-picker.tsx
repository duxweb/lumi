import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import type { AgentContextItem, AgentMentionOption, AgentMentionPickerProps } from '../../catalog/types-public.js'
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'
import { useLoadMore } from '../load-more.js'
import { HighlightMatch } from '../option-content.js'
import { PanelSearch } from '../panel-search.js'
import { SpinnerGlyph } from '../spinner.js'
import { useUiText } from '../text.js'
import { KindIcon } from './shared.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

/**
 * True inside a popover that Escape closes, such as PromptInput's @ menu: there
 * Tab may cycle the kinds without trapping focus. Pickers that a host draws
 * through `mentionPicker` pick it up without passing a prop.
 */
export const MentionTabCycleContext = createContext(false)

/** The context item a pick becomes: typed ids keep an order and a customer with the same number apart. */
export function mentionItem(option: AgentMentionOption, type: { value: string, icon?: string | undefined } | undefined): AgentContextItem {
  const kind = option.type ?? type?.value
  return {
    id: kind ? `${kind}:${option.value}` : String(option.value),
    label: option.label,
    kind: 'record',
    ...(type?.icon ? { icon: type.icon } : {}),
    ...(option.description ? { description: option.description } : {}),
  }
}

function matches(option: AgentMentionOption, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return !needle || option.label.toLowerCase().includes(needle) || Boolean(option.description?.toLowerCase().includes(needle))
}

export interface LumiAgentMentionPickerProps extends AgentMentionPickerProps, HostProps {
  /** The host searches; `options` are shown as given. */
  remote?: boolean | undefined
  /**
   * Tab and Shift+Tab switch the kind (wrapping) instead of moving focus.
   * Only for a picker inside a popover that Escape closes; standalone, Tab
   * must leave the field. Defaults to true inside PromptInput's @ menu.
   */
  cycleTabs?: boolean | undefined
}

/**
 * The @ reference picker. A search field, a tab per kind of thing, and the
 * results with the match highlighted. Up/Down move through the results and
 * wrap, Left/Right (at the edge of the search) switch the kind, as do Tab and
 * Shift+Tab with `cycleTabs`, and Enter picks. A pick becomes a context item
 * in `value`. Static options are filtered here; when the host searches
 * remotely it passes `onQueryChange`, `loading` and `hasMore`, and the list
 * shows what it is given.
 */
export function LumiAgentMentionPicker(props: LumiAgentMentionPickerProps): ReactElement {
  const { t } = useUiText()
  const inMenu = useContext(MentionTabCycleContext)
  const { types = [], type: typeProp, query: queryProp, options = [], value = [], multiple, loading, loadingMore, hasMore, placeholder, emptyText, maxHeight = 320, ariaLabel, remote, cycleTabs = inMenu, onTypeChange, onQueryChange, onChange, onSelect, onLoadMore, className, children, ...rest } = props
  const [ownType, setOwnType] = useState<string | undefined>()
  const [ownQuery, setOwnQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()
  const type = typeProp ?? ownType ?? types[0]?.value
  const query = queryProp ?? ownQuery
  const current = types.find(entry => entry.value === type)
  const shown = useMemo(
    () => (remote ? options : options.filter(option => (!type || !option.type || option.type === type) && matches(option, query))),
    [remote, options, type, query],
  )
  const picked = new Set(value.map(item => item.id))
  const loader = useLoadMore(list, { length: shown.length, resetKey: `${type}:${query}`, hasMore: Boolean(hasMore), busy: Boolean(loading || loadingMore), onLoadMore: () => onLoadMore?.() })

  useEffect(() => setActive(0), [type, query])

  const setType = (next: string): void => {
    setOwnType(next)
    onTypeChange?.(next)
  }
  const setQuery = (next: string): void => {
    setOwnQuery(next)
    onQueryChange?.(next)
  }
  const pick = (option: AgentMentionOption): void => {
    const item = mentionItem(option, types.find(entry => entry.value === (option.type ?? type)))
    const on = picked.has(item.id)
    const next = on ? value.filter(entry => entry.id !== item.id) : multiple ? [...value, item] : [item]
    onChange?.(next)
    onSelect?.(item, !on)
  }
  const optionId = (index: number): string => `${listId}-${index}`
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing || event.keyCode === 229)
      return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = shown.length ? (active + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length : 0
      setActive(next)
      document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' })
    }
    else if (event.key === 'Enter' && shown[active]) {
      event.preventDefault()
      pick(shown[active])
    }
    else if (types.length > 1 && event.target instanceof HTMLInputElement && !event.altKey && !event.metaKey && !event.ctrlKey) {
      // Left/Right step through the kinds once the caret sits at that edge of
      // the search, so they still move the caret inside typed text; with
      // `cycleTabs`, Tab and Shift+Tab step too. All of them wrap around.
      // Without it Tab moves focus as usual, so a standalone picker never traps it.
      const input = event.target
      const collapsed = input.selectionStart === input.selectionEnd
      const step = event.key === 'Tab'
        ? (cycleTabs ? (event.shiftKey ? -1 : 1) : 0)
        : event.shiftKey || !collapsed
          ? 0
          : event.key === 'ArrowLeft' && input.selectionStart === 0
            ? -1
            : event.key === 'ArrowRight' && input.selectionEnd === input.value.length ? 1 : 0
      if (step) {
        event.preventDefault()
        const at = Math.max(types.findIndex(entry => entry.value === type), 0)
        setType(types[(at + step + types.length) % types.length]!.value)
      }
    }
  }

  return (
    <div {...rest} className={cn('lumi-agent-mention', className)} data-slot="agent-mention-picker" onKeyDown={onKeyDown}>
      <PanelSearch
        variant="inset"
        value={query}
        onValueChange={setQuery}
        loading={Boolean(loading)}
        placeholder={placeholder ?? (current ? t('lumi.agent.mentionSearchIn', 'Search {type}', { type: current.label }) : t('lumi.agent.mentionSearch', 'Search to reference'))}
        aria-label={ariaLabel ?? t('lumi.agent.mentionSearch', 'Search to reference')}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={shown[active] ? optionId(active) : undefined}
      />
      {types.length > 1 && (
        <div className="lumi-agent-mention-tabs" role="tablist" aria-label={t('lumi.agent.mentionTypes', 'Kinds')}>
          {types.map(entry => (
            <button key={entry.value} type="button" role="tab" tabIndex={-1} aria-selected={entry.value === type} className="lumi-agent-mention-tab" onClick={() => setType(entry.value)}>
              {entry.icon && <KindIcon icon={entry.icon} className="lumi-agent-chip-icon" />}
              {entry.label}
            </button>
          ))}
        </div>
      )}
      <ul
        id={listId}
        ref={(node) => {
          list.current = node
          loader.ref(node)
        }}
        role="listbox"
        aria-multiselectable={multiple || undefined}
        aria-label={current?.label ?? t('lumi.agent.mentionResults', 'Results')}
        aria-busy={loading || undefined}
        className="lumi-agent-mention-list"
        style={{ maxHeight }}
        onScroll={loader.onScroll}
      >
        {shown.map((option, index) => {
          const item = mentionItem(option, types.find(entry => entry.value === (option.type ?? type)))
          const on = picked.has(item.id)
          return (
            <li
              key={item.id}
              id={optionId(index)}
              role="option"
              aria-selected={on}
              data-active={index === active || undefined}
              className="lumi-agent-mention-option"
              onMouseMove={() => setActive(index)}
              onMouseDown={event => event.preventDefault()}
              onClick={() => pick(option)}
            >
              <span className="lumi-agent-mention-mark" aria-hidden>
                {option.avatar || option.image
                  ? <img src={option.avatar ?? option.image} alt="" />
                  : <KindIcon icon={current?.icon} kind="data" className="lumi-agent-chip-icon" />}
              </span>
              <span className="lumi-agent-mention-copy">
                <span className="lumi-agent-mention-label"><HighlightMatch text={option.label} query={query} /></span>
                {option.description && <span className="lumi-agent-mention-meta"><HighlightMatch text={option.description} query={query} /></span>}
              </span>
              {on && <CheckIcon aria-hidden className="lumi-agent-mention-check" />}
            </li>
          )
        })}
        {loadingMore && <li className="lumi-agent-mention-more" aria-hidden><SpinnerGlyph size="sm" tone="muted" /></li>}
      </ul>
      {!shown.length && !loading && (
        <p className="lumi-agent-mention-empty" role="status">
          {emptyText ?? (query ? t('lumi.agent.mentionNone', 'Nothing matches “{query}”', { query }) : t('lumi.agent.mentionEmpty', 'Nothing to reference yet'))}
        </p>
      )}
      {children}
    </div>
  )
}
