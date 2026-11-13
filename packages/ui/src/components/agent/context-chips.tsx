import type { ReactElement, ReactNode } from 'react'
import type { AgentContextItem, ContextChipsProps } from '../../catalog/types-public.js'
import { EyeIcon, XIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'
import { LumiProgress } from '../base.js'
import { LumiSwitch } from '../controls.js'
import { useUiText } from '../text.js'
import { KindIcon } from './shared.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

/** One context chip: icon, label and, when removable, a remove button. */
export function ContextChip({ item, onRemove }: { item: AgentContextItem, onRemove?: (() => void) | undefined }): ReactElement {
  const { t } = useUiText()
  return (
    <span className="lumi-agent-chip" data-slot="context-chip" data-kind={item.kind} title={item.description}>
      <KindIcon icon={item.icon} kind={item.kind ?? 'record'} className="lumi-agent-chip-icon" />
      <span className="lumi-agent-chip-label">{item.label}</span>
      {onRemove && (
        <button type="button" className="lumi-agent-chip-remove" data-hit-area="" aria-label={t('lumi.common.removeItem', 'Remove {name}', { name: item.label })} onClick={onRemove}>
          <XIcon aria-hidden />
        </button>
      )}
    </span>
  )
}

/**
 * What the agent can see: the page the reader is on with a share switch, the
 * context items attached to the conversation, and how much of the context
 * window they use.
 */
export function LumiContextChips(props: ContextChipsProps & HostProps): ReactElement {
  const { t, locale } = useUiText()
  const { viewing, shared, items, removable, usage, onSharedChange, onRemove, className, children, ...rest } = props
  const ratio = usage ? usage.used / usage.limit : 0
  const number = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  const used = usage ? `${number.format(usage.used)} / ${number.format(usage.limit)}` : ''
  return (
    <div {...rest} className={cn('lumi-agent-context', className)} data-slot="context-chips">
      {viewing && (
        <div className="lumi-agent-viewing" data-shared={shared === false ? 'false' : 'true'} data-slot="context-viewing">
          <EyeIcon aria-hidden />
          <span className="lumi-agent-viewing-state">{shared === false ? t('lumi.agent.notSharing', 'Not sharing') : t('lumi.agent.viewing', 'Viewing')}</span>
          <b className="lumi-agent-viewing-label" title={viewing}>{viewing}</b>
          {shared !== undefined && (
            <LumiSwitch ariaLabel={t('lumi.agent.share', 'Share page context')} value={shared} disabled={!onSharedChange} onChange={value => onSharedChange?.(Boolean(value))} />
          )}
        </div>
      )}
      {items?.length
        ? (
            <ul className="lumi-agent-chips" aria-label={t('lumi.agent.contextItems', 'Context')}>
              {items.map(item => (
                <li key={item.id}>
                  <ContextChip item={item} onRemove={removable && onRemove ? () => onRemove(item) : undefined} />
                </li>
              ))}
            </ul>
          )
        : null}
      {usage && (
        <div className="lumi-agent-usage" data-level={ratio >= 0.95 ? 'danger' : ratio >= 0.8 ? 'warning' : undefined}>
          <span className="lumi-agent-usage-label">
            <span>{t('lumi.agent.usage', 'Context used')}</span>
            <span className="lumi-agent-usage-value">{usage.unit ? `${used} ${usage.unit}` : used}</span>
          </span>
          <LumiProgress value={usage.used} max={usage.limit} tone={ratio >= 0.95 ? 'danger' : ratio >= 0.8 ? 'warning' : 'default'} aria-label={t('lumi.agent.usage', 'Context used')} />
        </div>
      )}
      {children}
    </div>
  )
}
