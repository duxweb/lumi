import type { DocumentIssue } from '@duxweb/lumi'
import type { Spec } from '@json-render/core'
import type { ErrorInfo, ReactElement, ReactNode } from 'react'
import { validateDocument } from '@duxweb/lumi'
import { adminCatalog } from '@duxweb/lumi-admin'
import { LumiCodeEditor } from '@duxweb/lumi-ui'
import { Component, useEffect, useMemo, useRef, useState } from 'react'
import { DocPreview } from '../docs/DocPreview'
import { focusComponentDemo } from '../docs/focus'
import { sitePath } from '../paths'
import { PLAYGROUND_EXAMPLES } from './examples'

const SHARE_PREFIX = '#schema='

interface Parsed { document?: Spec, issues: DocumentIssue[] }

/** A component the first column offers, with the gallery page that holds its demo. */
export interface PlaygroundComponent { type: string, family: string, page: string }

/** What the first column has selected; nothing when the page came from a share link. */
type Selection = { kind: 'example', id: string } | { kind: 'component', type: string } | undefined

function parse(source: string): Parsed {
  let value: unknown
  try {
    value = JSON.parse(source)
  }
  catch (error) {
    return { issues: [{ path: '', code: 'invalid_json', severity: 'error', message: error instanceof Error ? error.message : String(error), hint: '检查逗号、引号和括号是否成对。' }] }
  }
  // The same Catalog the demo admin renders with, so a valid page here is one the app accepts.
  const result = validateDocument(value, adminCatalog)
  return result.valid ? { document: value as Spec, issues: [] } : { issues: result.issues }
}

function sharedSource(): string | undefined {
  if (!window.location.hash.startsWith(SHARE_PREFIX))
    return undefined
  try {
    return decodeURIComponent(window.location.hash.slice(SHARE_PREFIX.length))
  }
  catch {
    return undefined
  }
}

/** A component that throws while rendering shows its message instead of blanking the page. */
class PreviewBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  override state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  override render(): ReactNode {
    return this.state.error
      ? (
          <p className="pg__empty">
            渲染出错：
            {this.state.error.message}
          </p>
        )
      : this.props.children
  }
}

const pretty = (spec: Spec): string => JSON.stringify(spec, null, 2)

export function Playground({ components = [] }: { components?: PlaygroundComponent[] }): ReactElement {
  const [source, setSource] = useState(() => sharedSource() ?? pretty(PLAYGROUND_EXAMPLES[0]!.document))
  const [selection, setSelection] = useState<Selection>(() => (sharedSource() ? undefined : { kind: 'example', id: PLAYGROUND_EXAMPLES[0]!.id }))
  const [keyword, setKeyword] = useState('')
  // Gallery pages by name, fetched once each when a component of theirs is first picked.
  const gallery = useRef(new Map<string, Promise<Spec>>())
  const [settled, setSettled] = useState(source)
  const [copied, setCopied] = useState(false)
  // Validate and render once typing pauses, not on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(setSettled, 250, source)
    return () => window.clearTimeout(timer)
  }, [source])
  // A share link pasted into the address bar of an open Playground loads too.
  useEffect(() => {
    const load = (): void => {
      const next = sharedSource()
      if (next !== undefined) {
        setSelection(undefined)
        setSource(next)
      }
    }
    window.addEventListener('hashchange', load)
    return () => window.removeEventListener('hashchange', load)
  }, [])
  const parsed = useMemo(() => parse(settled), [settled])
  // The last valid page stays on screen while the JSON is being fixed.
  const [shown, setShown] = useState<{ spec: Spec, revision: number }>()
  useEffect(() => {
    if (parsed.document)
      setShown(current => ({ spec: parsed.document!, revision: (current?.revision ?? 0) + 1 }))
  }, [parsed.document])

  const choose = (id: string): void => {
    const next = PLAYGROUND_EXAMPLES.find(item => item.id === id)
    if (!next)
      return
    setSelection({ kind: 'example', id })
    setSource(pretty(next.document))
  }

  // The component's demo, cut out of the gallery page that shows it.
  const chooseComponent = async (component: PlaygroundComponent): Promise<void> => {
    setSelection({ kind: 'component', type: component.type })
    let page = gallery.current.get(component.page)
    if (!page) {
      page = fetch(sitePath(`/component-schemas/${component.page}.json`)).then(async (response) => {
        if (!response.ok)
          throw new Error(`${component.page}.json answered ${response.status}`)
        return await response.json() as Spec
      })
      gallery.current.set(component.page, page)
      // A failed load is tried again on the next pick.
      page.catch(() => gallery.current.delete(component.page))
    }
    const demo = await page.then(spec => focusComponentDemo(spec, component.type)).catch(() => undefined)
    if (demo)
      setSource(pretty(demo))
  }

  const needle = keyword.trim().toLowerCase()
  const examples = PLAYGROUND_EXAMPLES.filter(item => !needle || item.label.toLowerCase().includes(needle))
  const families = Array.from(new Set(components.map(item => item.family)), family => ({
    family,
    items: components.filter(item => item.family === family && (!needle || item.type.toLowerCase().includes(needle))),
  })).filter(group => group.items.length > 0)

  const share = async (): Promise<void> => {
    const url = new URL(window.location.href)
    url.hash = `schema=${encodeURIComponent(source)}`
    window.history.replaceState(null, '', url)
    await navigator.clipboard.writeText(url.toString()).catch(() => undefined)
    setCopied(true)
    window.setTimeout(setCopied, 1600, false)
  }

  const ok = parsed.issues.length === 0
  return (
    <div className="pg" data-playground>
      <nav className="pg__nav" aria-label="选择示例">
        <div className="pg__bar">
          <input className="pg__search" type="search" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="搜索示例和组件" aria-label="搜索示例和组件" />
        </div>
        <div className="pg__list">
          {!selection && <p className="pg__shared">分享的页面</p>}
          {examples.length > 0 && (
            <section>
              <h2>示例</h2>
              {examples.map(item => (
                <button key={item.id} type="button" aria-current={selection?.kind === 'example' && selection.id === item.id ? 'true' : undefined} onClick={() => choose(item.id)}>{item.label}</button>
              ))}
            </section>
          )}
          {families.map(group => (
            <section key={group.family}>
              <h2>{group.family}</h2>
              {group.items.map(item => (
                <button key={item.type} type="button" aria-current={selection?.kind === 'component' && selection.type === item.type ? 'true' : undefined} onClick={() => void chooseComponent(item)}>{item.type}</button>
              ))}
            </section>
          ))}
          {examples.length === 0 && families.length === 0 && <p className="pg__none">没有匹配的示例或组件。</p>}
        </div>
      </nav>
      <section className="pg__pane" aria-label="JSON 编辑区">
        <div className="pg__bar">
          <strong className="pg__title">页面 JSON</strong>
          <span className={ok ? 'pg__status' : 'pg__status pg__status--error'} aria-live="polite">{ok ? '校验通过' : `${parsed.issues.length} 个问题`}</span>
          <span className="pg__spacer" />
          <button type="button" className="pg__button" disabled={!parsed.document} onClick={() => parsed.document && setSource(pretty(parsed.document))}>格式化</button>
          <button type="button" className="pg__button" onClick={() => void share()}>{copied ? '链接已复制' : '复制分享链接'}</button>
        </div>
        <div className="pg__editor">
          <LumiCodeEditor value={source} onChange={value => setSource(value ?? '')} language="json" maxHeight={100000} ariaLabel="页面 JSON" />
        </div>
        {!ok && (
          <ol className="pg__issues" aria-label="校验问题">
            {parsed.issues.slice(0, 8).map((issue, index) => (
              <li key={`${issue.path}-${issue.code}-${index}`}>
                <code>{issue.path || '/'}</code>
                <span>{issue.message}</span>
                {issue.hint && <small>{issue.hint}</small>}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="pg__pane pg__pane--preview" aria-label="预览">
        <div className="pg__bar">
          <strong className="pg__title">预览</strong>
        </div>
        <div className="pg__stage">
          {shown
            ? <PreviewBoundary key={shown.revision}><DocPreview key={shown.revision} spec={shown.spec} /></PreviewBoundary>
            : <p className="pg__empty">修正中间的 JSON，这里就会显示页面。</p>}
        </div>
      </section>
    </div>
  )
}
