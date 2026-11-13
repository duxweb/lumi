import type { ReactElement, ReactNode } from 'react'
import type { AgentSession, AgentSessionListProps } from '../../catalog/types-public.js'
import { useRef, useState } from 'react'
import { AddIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'
import { LumiEmpty } from '../empty.js'
import { useLoadMore } from '../load-more.js'
import { HighlightMatch } from '../option-content.js'
import { PanelSearch } from '../panel-search.js'
import { SpinnerGlyph } from '../spinner.js'
import { useUiText } from '../text.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

function matches(session: AgentSession, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return !needle || session.title.toLowerCase().includes(needle) || Boolean(session.preview?.toLowerCase().includes(needle))
}

/**
 * A list of conversations. Every row keeps a dot slot before its title, so
 * titles line up whether or not a status shows; `detailed` adds the time and
 * the last line. Static sessions are filtered here; a host that searches
 * remotely passes `remote` and shows what it is given.
 */
export function LumiAgentSessionList(props: AgentSessionListProps & HostProps & { remote?: boolean | undefined }): ReactElement {
  const { t } = useUiText()
  const { sessions = [], value, variant = 'compact', searchable, query: queryProp, creatable, loading, hasMore, emptyText, ariaLabel, remote, onChange, onQueryChange, onCreate, onLoadMore, className, children, ...rest } = props
  const [ownQuery, setOwnQuery] = useState('')
  const list = useRef<HTMLUListElement>(null)
  const query = queryProp ?? ownQuery
  const shown = remote ? sessions : sessions.filter(session => matches(session, query))
  const loader = useLoadMore(list, { length: shown.length, resetKey: query, hasMore: Boolean(hasMore), busy: Boolean(loading), onLoadMore: () => onLoadMore?.() })
  const statusLabel = {
    idle: '',
    running: t('lumi.agent.sessionRunning', 'Working'),
    waiting: t('lumi.agent.sessionWaiting', 'Waiting for you'),
    unread: t('lumi.agent.sessionUnread', 'New reply'),
    error: t('lumi.agent.sessionError', 'Failed'),
  }
  const detailed = variant === 'detailed'

  return (
    <div {...rest} className={cn('lumi-agent-sessions', className)} data-slot="agent-session-list" data-variant={variant}>
      {(creatable || searchable) && (
        <div className="lumi-agent-sessions-head">
          {creatable && (
            <button type="button" className="lumi-agent-sessions-new" onClick={() => onCreate?.()}>
              <AddIcon aria-hidden />
              {t('lumi.agent.sessionNew', 'New chat')}
            </button>
          )}
          {searchable && (
            <PanelSearch
              variant="inset"
              value={query}
              onValueChange={(next) => {
                setOwnQuery(next)
                onQueryChange?.(next)
              }}
              placeholder={t('lumi.agent.sessionSearch', 'Search chats')}
              aria-label={t('lumi.agent.sessionSearch', 'Search chats')}
            />
          )}
        </div>
      )}
      {shown.length
        ? (
            <ul
              ref={(node) => {
                list.current = node
                loader.ref(node)
              }}
              className="lumi-agent-sessions-list"
              aria-label={ariaLabel ?? t('lumi.agent.sessions', 'Chats')}
              aria-busy={loading || undefined}
              onScroll={loader.onScroll}
            >
              {shown.map((session, index) => {
                const heading = session.group && session.group !== shown[index - 1]?.group ? session.group : undefined
                const status = session.status ?? 'idle'
                return (
                  <li key={session.id} className="lumi-agent-session-item">
                    {heading && <span className="lumi-agent-sessions-group" role="presentation">{heading}</span>}
                    <button
                      type="button"
                      className="lumi-agent-session"
                      aria-current={session.id === value ? 'true' : undefined}
                      data-status={status}
                      onClick={() => onChange?.(session.id, session)}
                    >
                      <span className="lumi-agent-session-dot" aria-hidden />
                      <span className="lumi-agent-session-title"><HighlightMatch text={session.title} query={query} /></span>
                      {session.time && <span className="lumi-agent-session-time">{session.time}</span>}
                      {detailed && session.preview && <span className="lumi-agent-session-preview"><HighlightMatch text={session.preview} query={query} /></span>}
                      {statusLabel[status] && <span className="sr-only">{statusLabel[status]}</span>}
                    </button>
                  </li>
                )
              })}
              {loading && <li className="lumi-agent-mention-more" aria-hidden><SpinnerGlyph size="sm" tone="muted" /></li>}
            </ul>
          )
        : loading
          ? <div className="lumi-agent-mention-more" role="status"><SpinnerGlyph size="sm" tone="muted" /></div>
          : <LumiEmpty size="sm" icon="sparkles" title={emptyText ?? (query ? t('lumi.agent.sessionNone', 'No chats match') : t('lumi.agent.sessionEmpty', 'No chats yet'))} />}
      {children}
    </div>
  )
}
