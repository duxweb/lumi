import type { ReactElement } from 'react'
import type { AgentReasoningPart, AgentToolCallPart } from '../../catalog/types-public.js'
import type { UiText } from '../text.js'
import { useId, useState } from 'react'
import { SparklesIcon } from '../../icons.js'
import { useUiText } from '../text.js'
import { LumiMarkdown } from './markdown.js'
import { formatDuration, useElapsed, useReducedMotion } from './shared.js'
import { StepRow } from './thinking.js'
import { ActivityHead, roundStatus, Timeline, TimelineRow } from './timeline.js'
import { ToolCallRow } from './tool-call.js'

export type ActivityPart = AgentReasoningPart | AgentToolCallPart

/** True for the parts a message gathers under one activity line. */
export function isActivityPart(part: { type: string }): part is ActivityPart {
  return part.type === 'reasoning' || part.type === 'tool-call'
}

function isRunning(part: ActivityPart, streaming: boolean): boolean {
  return part.type === 'reasoning'
    ? (part.state ?? (streaming ? 'streaming' : 'done')) === 'streaming'
    : part.status === 'running' || part.status === 'pending'
}

/** What a settled group did, e.g. `Used 2 tools, 1 failed`; nothing when it only thought. */
function settledDetail(parts: readonly ActivityPart[], t: UiText['t']): string | undefined {
  const tools = parts.filter((part): part is AgentToolCallPart => part.type === 'tool-call')
  const failed = tools.filter(tool => tool.status === 'error').length
  if (!tools.length)
    return undefined
  const used = tools.length === 1 ? t('lumi.agent.usedTool', 'Used 1 tool') : t('lumi.agent.usedTools', 'Used {count} tools', { count: tools.length })
  return failed ? t('lumi.agent.join', '{a}, {b}', { a: used, b: t('lumi.agent.toolsFailed', '{count} failed', { count: failed }) }) : used
}

/** The time a settled group took, from the durations its parts report. */
function settledTime(parts: readonly ActivityPart[]): number | undefined {
  return parts.reduce<number | undefined>((sum, part) => (part.duration === undefined ? sum : (sum ?? 0) + part.duration), undefined)
}

/** The current phase of a running group: the reasoning label, else the running tool. */
function runningDetail(parts: readonly ActivityPart[], streaming: boolean): string | undefined {
  const current = parts.findLast(part => isRunning(part, streaming))
  if (current?.type === 'reasoning')
    return current.label ?? undefined
  if (current?.type === 'tool-call')
    return current.title ?? current.toolName
  return undefined
}

/**
 * Consecutive thinking and tool calls of a message under one quiet line. While
 * anything runs the line names the current phase, shimmering with the elapsed
 * time, and the timeline stays open; once settled it says what was done and
 * folds, and each row with details opens on its own.
 */
export function AgentActivity({ parts, streaming }: { parts: readonly ActivityPart[], streaming: boolean }): ReactElement {
  const { t } = useUiText()
  const reduced = useReducedMotion()
  const running = parts.some(part => isRunning(part, streaming))
  const elapsed = useElapsed(running)
  const [chosen, setChosen] = useState<boolean>()
  const panel = useId()
  const open = chosen ?? running
  const failed = parts.some(part => part.type === 'tool-call' && part.status === 'error')
  const state = running ? 'streaming' : failed ? 'error' : 'done'
  const label = roundStatus(state, t)
  const detail = running ? runningDetail(parts, streaming) : settledDetail(parts, t)
  const taken = settledTime(parts)
  const rows = parts.flatMap((part, index) => {
    if (part.type === 'tool-call')
      return [<ToolCallRow key={part.id ?? part.toolCallId} {...part} />]
    const state = part.state ?? (streaming ? 'streaming' : 'done')
    const lines = (part.steps ?? []).map((step, at) => <StepRow key={`${part.id ?? index}:${step.id ?? at}`} step={step} />)
    if (part.text) {
      lines.push(
        <TimelineRow
          key={`${part.id ?? index}:text`}
          icon={<SparklesIcon />}
          name={state === 'streaming' ? t('lumi.agent.thinking', 'Thinking') : t('lumi.agent.thought', 'Thought')}
          running={state === 'streaming' && !reduced}
          detail={<LumiMarkdown className="lumi-agent-reasoning" text={part.text} />}
          defaultOpen={state === 'streaming'}
        />,
      )
    }
    return lines
  })
  const expandable = rows.length > 0
  const time = running
    ? elapsed === undefined ? undefined : formatDuration(Math.floor(elapsed / 1000) * 1000, t, true)
    : taken === undefined ? undefined : formatDuration(taken, t)
  return (
    <div className="lumi-agent-activity" data-slot="agent-activity" data-state={state} data-motion={reduced ? 'reduce' : undefined}>
      <ActivityHead label={label} time={time} detail={detail} running={running && !reduced} open={open && expandable} panel={panel} expandable={expandable} onToggle={() => setChosen(!open)} slot="activity-toggle" pill />
      <span role="status" className="sr-only">{running ? '' : [label, time, detail].filter(Boolean).join(' ')}</span>
      {expandable && (
        <div id={panel} className="lumi-agent-activity-panel" hidden={!open} data-slot="activity-panel">
          <Timeline label={t('lumi.agent.steps', 'Steps')}>{rows}</Timeline>
        </div>
      )}
    </div>
  )
}
