import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { AgentFieldChange, ChangeDiffProps } from '../../catalog/types-public.js'
import type { CodeLine } from '../../code/highlight.js'
import type { DiffRow } from './diff.js'
import { useMemo, useState } from 'react'
import { resolveCodeLanguage } from '../../code/languages.js'
import { cn } from '../../internal/utils.js'
import { useCodeLines } from '../code-block.js'
import { useUiText } from '../text.js'
import { collapseDiff, diffLines } from './diff.js'
import { DiffIcon } from './shared.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

function fieldKind(change: AgentFieldChange): 'added' | 'removed' | 'changed' {
  if (change.kind)
    return change.kind
  const before = change.before !== undefined && change.before !== null && change.before !== ''
  const after = change.after !== undefined && change.after !== null && change.after !== ''
  return before && !after ? 'removed' : !before && after ? 'added' : 'changed'
}

function Tokens({ line }: { line: CodeLine | undefined }): ReactElement | null {
  if (!line)
    return null
  return (
    <>
      {line.map((token, at) => token.className
        ? <span key={at} className={token.className}>{token.text}</span>
        : token.text)}
    </>
  )
}

function TextDiff({ before, after, language }: { before: string, after: string, language?: string | undefined }): ReactElement {
  const { t } = useUiText()
  const lang = resolveCodeLanguage(language)
  const oldLines = useCodeLines(before, lang)
  const newLines = useCodeLines(after, lang)
  const lines = useMemo(() => diffLines(before, after), [before, after])
  const [expanded, setExpanded] = useState(false)
  const rows: DiffRow[] = expanded ? lines : collapseDiff(lines)
  const digits = String(Math.max(oldLines.length, newLines.length)).length
  return (
    <div className="lumi-code-block lumi-agent-diff-code" data-slot="change-diff-text" data-line-numbers="" style={{ '--lumi-diff-gutter': `${digits}ch` } as CSSProperties}>
      <pre className="lumi-code-scroll" tabIndex={0} role="region" aria-label={t('lumi.agent.diffText', 'Line changes')} data-language={lang}>
        <code className="lumi-code-lines">
          {rows.map((row, index) => {
            if (row.kind === 'gap') {
              return (
                <span key={`gap-${row.from}`} className="lumi-code-line lumi-agent-diff-gap">
                  <button type="button" onClick={() => setExpanded(true)}>{t('lumi.agent.diffUnchanged', '{count} unchanged lines', { count: row.count })}</button>
                </span>
              )
            }
            const tokens = row.kind === 'added' ? newLines[row.after!] : oldLines[row.before!]
            const Mark = row.kind === 'added' ? 'ins' : row.kind === 'removed' ? 'del' : 'span'
            return (
              <span key={index} className="lumi-code-line" data-diff={row.kind}>
                <span className="lumi-agent-diff-ln" aria-hidden>{row.before === undefined ? '' : row.before + 1}</span>
                <span className="lumi-agent-diff-ln" aria-hidden>{row.after === undefined ? '' : row.after + 1}</span>
                <span className="lumi-agent-diff-sign" aria-hidden>{row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}</span>
                <Mark className="lumi-code-text"><Tokens line={tokens} /></Mark>
              </span>
            )
          })}
        </code>
      </pre>
    </div>
  )
}

function Value({ value }: { value: AgentFieldChange['before'] }): ReactElement {
  const { t } = useUiText()
  if (value === undefined || value === null || value === '')
    return <span className="lumi-agent-diff-empty">{t('lumi.agent.diffEmpty', 'Empty')}</span>
  if (typeof value === 'boolean')
    return <>{value ? t('lumi.common.yes', 'Yes') : t('lumi.common.no', 'No')}</>
  return <>{String(value)}</>
}

/** Record field edits as before → after, or a line diff of two texts in the CodeBlock style. */
export function LumiChangeDiff(props: ChangeDiffProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { title, fields, before, after, language, className, children: _children, ...rest } = props
  const text = !fields?.length && (before !== undefined || after !== undefined)
  const lines = useMemo(() => (text ? diffLines(before ?? '', after ?? '') : []), [text, before, after])
  const added = lines.filter(line => line.kind === 'added').length
  const removed = lines.filter(line => line.kind === 'removed').length
  const heading = title ?? t('lumi.agent.diff', 'Changes')
  return (
    <section {...rest} className={cn('lumi-agent-card lumi-agent-diff', className)} data-slot="change-diff" data-mode={text ? 'text' : 'fields'} aria-label={rest['aria-label'] ?? heading}>
      <div className="lumi-agent-diff-head">
        <DiffIcon aria-hidden />
        <span className="lumi-agent-diff-title">{heading}</span>
        {text
          ? (
              <span className="lumi-agent-diff-count" aria-label={t('lumi.agent.diffCount', '{added} added, {removed} removed', { added, removed })}>
                <span data-diff="added">{`+${added}`}</span>
                <span data-diff="removed">{`−${removed}`}</span>
              </span>
            )
          : <span className="lumi-agent-diff-count">{t('lumi.agent.diffFields', '{count} fields', { count: fields?.length ?? 0 })}</span>}
      </div>
      {text
        ? (added || removed
            ? <TextDiff before={before ?? ''} after={after ?? ''} language={language} />
            : <p className="lumi-agent-diff-none">{t('lumi.agent.diffNone', 'No changes')}</p>)
        : (
            <dl className="lumi-agent-diff-fields">
              {fields?.map((change, index) => {
                const kind = fieldKind(change)
                return (
                  <div key={change.field ?? index} className="lumi-agent-diff-field" data-kind={kind}>
                    <dt>{change.label}</dt>
                    <dd>
                      {/* Every row reads before → after; a missing side shows as Empty. */}
                      {kind === 'added' ? <Value value={undefined} /> : <del><Value value={change.before} /></del>}
                      <span className="lumi-agent-diff-arrow" aria-hidden>→</span>
                      <span className="sr-only">{t('lumi.agent.diffTo', 'changed to')}</span>
                      {kind === 'removed' ? <Value value={undefined} /> : <ins><Value value={change.after} /></ins>}
                    </dd>
                  </div>
                )
              })}
            </dl>
          )}
    </section>
  )
}
