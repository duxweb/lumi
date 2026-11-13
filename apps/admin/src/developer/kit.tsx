import type { TableColumn } from '@duxweb/lumi-ui'
import type { Spec } from '@json-render/core'
import type { ComponentRegistry } from '@json-render/react'
import type { ReactElement, ReactNode } from 'react'
import { LumiProvider, useLumi, useTranslate } from '@duxweb/lumi'
import { adminRegistry, LumiCodeExample, LumiPage, LumiPageHeader } from '@duxweb/lumi-admin'
import { LumiButton as Button, LumiCodeBlock as CodeBlock, LumiCodeEditor as CodeEditor } from '@duxweb/lumi-ui'
import { Renderer, useStateStore } from '@json-render/react'
import { useQueryClient } from '@tanstack/react-query'
import { Component, useMemo, useState } from 'react'
import { perLocale } from '../shared.js'
import { json, localizeSpec } from './source.js'

export type CodeLanguage = 'json' | 'tsx' | 'ts' | 'go' | 'html' | 'http' | 'bash' | 'text'

export interface CodeFile {
  name: string
  language: CodeLanguage
  code: string
}

/** Source panes keep a reading height; longer files scroll inside. */
const CODE_MAX_HEIGHT = 560

/** The example's source files; several files switch with tabs in the header. */
export function Code({ files, maxHeight = CODE_MAX_HEIGHT }: { files: readonly CodeFile[], maxHeight?: number }): ReactElement {
  const [file] = files
  if (files.length === 1 && file)
    return <CodeBlock title={file.name} language={file.language} code={file.code} showLineNumbers maxHeight={maxHeight} />
  return <CodeBlock files={files.map(item => ({ title: item.name, language: item.language, code: item.code }))} showLineNumbers maxHeight={maxHeight} />
}

/** Editable source for examples that re-run as you type. */
export function Editor({ value, onChange, label, language = 'json', minHeight = 320, maxHeight = CODE_MAX_HEIGHT }: { value: string, onChange: (value: string) => void, label: string, language?: CodeLanguage, minHeight?: number, maxHeight?: number }): ReactElement {
  return <CodeEditor ariaLabel={label} language={language} checkSyntax={language === 'json'} minHeight={minHeight} maxHeight={maxHeight} value={value} onChange={onChange} />
}

interface BoundaryState { error?: Error }

/** Keeps a Spec that fails while rendering from taking the page down with it. */
export class RenderBoundary extends Component<{ children: ReactNode, fallback: (error: Error) => ReactNode, resetKey?: unknown }, BoundaryState> {
  override state: BoundaryState = {}

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  override componentDidUpdate(previous: { resetKey?: unknown }): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey)
      this.setState({ error: undefined })
  }

  override render(): ReactNode {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children
  }
}

/** The page StateStore as it changes, so bindings and actions can be watched at work. */
export function StateView(): ReactElement {
  const t = useTranslate()
  const { state } = useStateStore()
  return <CodeBlock title={t('Live state')} language="json" code={json(state)} maxHeight={240} copyable={false} data-testid="live-state" />
}

/** Renders a Spec in its own StateStore with the app's services. */
export function SpecRender({ spec, registry = adminRegistry, revision = 0, showState }: { spec: Spec, registry?: ComponentRegistry, revision?: number, showState?: boolean }): ReactElement {
  const context = useLumi()
  const queryClient = useQueryClient()
  return (
    <LumiProvider key={revision} context={context} queryClient={queryClient} registry={registry} initialState={spec.state}>
      <Renderer spec={spec} registry={registry} />
      {showState && <StateView />}
    </LumiProvider>
  )
}

export function ResetButton({ title, onReset }: { title: string, onReset: () => void }): ReactElement {
  const t = useTranslate()
  return <Button label={t('Reset')} aria-label={t('Reset {title}', { title })} appearance="ghost" size="sm" icon="refresh" onClick={onReset} />
}

export interface SpecExampleProps {
  title: string
  description?: ReactNode
  spec: Spec
  /** Name of the Spec file in the code tabs. */
  fileName?: string
  /** Files shown before the Spec, such as the host code that renders it. */
  before?: readonly CodeFile[]
  /** Files shown after the Spec, such as the HTTP exchange behind it. */
  files?: readonly CodeFile[]
  registry?: ComponentRegistry
  layout?: 'split' | 'stack'
  align?: 'start' | 'center'
  /** Show `$t` as written instead of the text it resolves to. */
  raw?: boolean
  /** Show the live StateStore under the result; on by default beside the code. */
  showState?: boolean
  /** Replaces the default renderer, e.g. to render without Lumi services. */
  render?: (spec: Spec, revision: number) => ReactNode
}

/** A native Spec beside its live result; the code is exactly what renders. */
export function SpecExample({ title, description, spec, fileName = 'page.json', before = [], files = [], registry, layout, align, raw, showState = layout !== 'stack', render }: SpecExampleProps): ReactElement {
  const t = useTranslate()
  const [revision, setRevision] = useState(0)
  const shown = useMemo(() => raw ? spec : localizeSpec(spec, t), [spec, t, raw])
  return (
    <LumiCodeExample
      title={title}
      description={typeof description === 'string' ? rich(description) : description}
      layout={layout}
      align={align}
      code={<Code files={[...before, { name: fileName, language: 'json', code: json(shown) }, ...files]} />}
      previewLabel={t('Result')}
      previewActions={<ResetButton title={title} onReset={() => setRevision(value => value + 1)} />}
      preview={render ? render(raw ? spec : shown, revision) : <SpecRender spec={raw ? spec : shown} registry={registry} revision={revision} showState={showState} />}
    />
  )
}

export function DeveloperPage({ title, description, actions, children }: { title: string, description: string, actions?: ReactNode, children: ReactNode }): ReactElement {
  return (
    <LumiPage stack>
      <LumiPageHeader title={title} description={description} actions={actions} />
      {children}
    </LumiPage>
  )
}

const CODE_SPAN_RE = /`([^`]+)`/g

/** Explanatory text where `backticks` mark code, so a translation keeps its code spans. */
export function rich(text: string): ReactNode {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(CODE_SPAN_RE)) {
    parts.push(text.slice(last, match.index), <code key={match.index}>{match[1]}</code>)
    last = match.index + match[0].length
  }
  parts.push(text.slice(last))
  return parts
}

/** Validation issues as lumi-check reports them; every one in these examples is an error. */
export const issueColumns = perLocale((t): TableColumn[] => ([
  { field: 'path', label: t('Path'), kind: 'code', width: '45%', wrap: true },
  { field: 'message', label: t('Message'), wrap: true },
]))
