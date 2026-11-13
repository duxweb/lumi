import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import type { AgentQuestionAnswer, AgentQuestionProps } from '../../catalog/types-public.js'
import { useId, useState } from 'react'
import { CheckIcon, HelpCircleIcon, XIcon } from '../../icons.js'
import { cn } from '../../internal/utils.js'
import { LumiButton } from '../base.js'
import { useUiText } from '../text.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

function asList(answer: AgentQuestionProps['answer']): string[] {
  return answer === null || answer === undefined ? [] : Array.isArray(answer) ? answer : [answer]
}

/**
 * A question the agent asks before it goes on. A single choice answers as
 * soon as an option is pressed (digit keys pick by number); several choices
 * are ticked and confirmed; a written answer is sent with Enter. Answered or
 * skipped, it folds to one line with the answer, which opens to change it.
 */
export function LumiAgentQuestion(props: AgentQuestionProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { title, description, mode = 'single', options = [], allowText, placeholder, status, answer, submitLabel, skippable, onAnswer, onSkip, className, children, ...rest } = props
  const given = asList(answer)
  const [picked, setPicked] = useState<string[]>(() => (mode === 'multiple' ? given.filter(value => options.some(option => option.value === value)) : []))
  const [draft, setDraft] = useState(() => (mode === 'text' ? given[0] ?? '' : given.find(value => !options.some(option => option.value === value)) ?? ''))
  const [editing, setEditing] = useState(false)
  const heading = useId()
  const open = status === 'pending' || editing
  const written = mode === 'text' || allowText

  const skip = (run: () => void): void => {
    setEditing(false)
    run()
  }
  const send = (value: AgentQuestionAnswer): void => {
    setEditing(false)
    onAnswer?.(value)
  }
  const submit = (): void => {
    const text = draft.trim()
    if (mode === 'multiple')
      send(text ? [...picked, text] : picked)
    else if (text)
      send(text)
  }
  const canSubmit = mode === 'multiple' ? picked.length > 0 || Boolean(draft.trim()) : Boolean(draft.trim())
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (mode !== 'single' || event.target instanceof HTMLInputElement || event.altKey || event.ctrlKey || event.metaKey)
      return
    const option = options[Number(event.key) - 1]
    if (option) {
      event.preventDefault()
      send(option.value)
    }
  }
  const answerText = given.map(value => options.find(option => option.value === value)?.label ?? value).join(t('lumi.agent.listSeparator', ', '))

  if (!open) {
    return (
      <div {...rest} className={cn('lumi-agent-question', className)} data-slot="agent-question" data-status={status}>
        <button type="button" className="lumi-agent-decided" onClick={() => setEditing(true)} aria-label={t('lumi.agent.questionChange', 'Change the answer to {title}', { title })}>
          {status === 'answered' ? <CheckIcon aria-hidden data-tone="success" /> : <XIcon aria-hidden />}
          <span className="lumi-agent-decided-label">{status === 'answered' ? t('lumi.agent.questionAnswered', 'Answered') : t('lumi.agent.questionSkipped', 'Skipped')}</span>
          <span className="lumi-agent-decided-reason">{status === 'answered' ? answerText : title}</span>
        </button>
      </div>
    )
  }

  return (
    <div {...rest} role="group" aria-labelledby={heading} className={cn('lumi-agent-question', className)} data-slot="agent-question" data-status={status} data-mode={mode} onKeyDown={onKeyDown}>
      <div className="lumi-agent-card lumi-agent-approval-card" data-tone="info">
        <div className="lumi-agent-approval-head">
          <span className="lumi-agent-approval-icon" aria-hidden><HelpCircleIcon /></span>
          <div className="lumi-agent-approval-copy">
            <span id={heading} className="lumi-agent-approval-title">{title}</span>
            {description && <p className="lumi-agent-approval-description">{description}</p>}
          </div>
        </div>
        <div className="lumi-agent-options" role={mode === 'multiple' ? 'group' : undefined}>
          {mode !== 'text' && options.map((option, index) => {
            const on = mode === 'multiple' ? picked.includes(option.value) : given.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                className="lumi-agent-option"
                aria-pressed={on}
                onClick={() => (mode === 'multiple' ? setPicked(on ? picked.filter(value => value !== option.value) : [...picked, option.value]) : send(option.value))}
              >
                <span className="lumi-agent-option-key" aria-hidden>{mode === 'multiple' ? <CheckIcon /> : index + 1}</span>
                <span className="lumi-agent-option-label">{option.label}</span>
                {option.description && <span className="lumi-agent-option-meta">{option.description}</span>}
              </button>
            )
          })}
          {written && (
            <input
              className="lumi-agent-option-text"
              value={draft}
              placeholder={placeholder ?? (mode === 'text' ? t('lumi.agent.questionPlaceholder', 'Write an answer') : t('lumi.agent.questionOther', 'Something else'))}
              aria-label={placeholder ?? t('lumi.agent.questionOther', 'Something else')}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  event.preventDefault()
                  submit()
                }
              }}
            />
          )}
        </div>
        {children}
        {(skippable || mode === 'multiple' || written)
          ? (
              <div className="lumi-agent-approval-actions">
                <span className="lumi-agent-spacer" />
                {skippable && onSkip && <LumiButton size="sm" appearance="ghost" label={t('lumi.agent.questionSkip', 'Skip')} onClick={() => skip(onSkip)} />}
                {(mode === 'multiple' || written) && <LumiButton size="sm" appearance="solid" label={submitLabel ?? t('lumi.agent.questionSubmit', 'Confirm')} disabled={!canSubmit} onClick={submit} />}
              </div>
            )
          : null}
      </div>
    </div>
  )
}
