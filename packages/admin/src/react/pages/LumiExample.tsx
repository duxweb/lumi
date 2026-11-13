import type { Spec } from '@json-render/core'
import type { ReactElement, ReactNode } from 'react'
import { LumiCard as Card, LumiCodeBlock, useUiText } from '@duxweb/lumi-ui'
import { useRef, useState } from 'react'
import { LumiSegmented } from './LumiSegmented.js'

export interface LumiExampleProps {
  /** Names the example for in-page links (`#id`); unique on the page. */
  id: string
  title: string
  description?: string
  /** The source behind the preview. Without it the example shows only its result. */
  source?: string
  /** Language of `source` (default `json`). */
  language?: string
  children?: ReactNode
  className?: string
}

const CODE_MIN_HEIGHT = 240
// The card's bottom padding and the code block's title bar.
const CODE_CHROME = 56

/**
 * A documented example: the live result, and a Code view with the source that
 * produces it. Switching views keeps the result mounted, so its state survives.
 */
export function LumiExample({ id, title, description, source, language = 'json', children, className }: LumiExampleProps): ReactElement {
  const { t } = useUiText()
  const section = useRef<HTMLElement>(null)
  const [view, setView] = useState<'preview' | 'code'>('preview')
  const [codeHeight, setCodeHeight] = useState(CODE_MIN_HEIGHT)
  const show = (next: string): void => {
    // The code takes the room the result had and scrolls inside it, so the
    // card, and the row it shares, keep their height.
    const card = section.current?.firstElementChild
    const header = card?.querySelector('[data-slot="card-header"]')
    if (next === 'code' && card && header)
      setCodeHeight(Math.max(CODE_MIN_HEIGHT, card.getBoundingClientRect().height - header.getBoundingClientRect().height - CODE_CHROME))
    setView(next === 'code' ? 'code' : 'preview')
  }
  const switcher = source
    ? (
        <LumiSegmented
          ariaLabel={`${title} · ${t('lumi.example.view', 'Example view')}`}
          value={view}
          onChange={show}
          options={[{ value: 'preview', label: t('lumi.example.preview', 'Preview') }, { value: 'code', label: t('lumi.example.code', 'Code') }]}
        />
      )
    : undefined
  return (
    <section ref={section} id={id} aria-label={title} className={['lumi-example', className].filter(Boolean).join(' ')} data-view={view}>
      <Card title={title} description={description} headerEnd={switcher}>
        <div className="lumi-example__preview" style={{ display: view === 'preview' ? 'contents' : 'none' }}>{children}</div>
        {source && view === 'code' && <LumiCodeBlock code={source} language={language} title={t('lumi.example.spec', 'Native Spec')} showLineNumbers maxHeight={codeHeight} />}
      </Card>
    </section>
  )
}

/** Top-level state keys the elements reach through `$state`, `$bindState` or `statePath`. */
function referencedState(elements: Spec['elements']): Set<string> {
  const keys = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value === 'string' && value.startsWith('/'))
      keys.add(value.slice(1).split('/')[0]!)
    else if (Array.isArray(value))
      value.forEach(visit)
    else if (value && typeof value === 'object')
      Object.values(value).forEach(visit)
  }
  visit(Object.values(elements).map(element => [element.props, element.on, element.visible, element.watch, element.repeat]))
  return keys
}

/**
 * The children of the Example with this `id` as a standalone native Spec, with
 * the initial state they read. Several children are wrapped in a stacking Fragment.
 */
export function exampleSpec(spec: Spec, id: string): Spec | undefined {
  const key = Object.keys(spec.elements).find(name => spec.elements[name]!.type === 'Example' && spec.elements[name]!.props.id === id)
  const children = key ? spec.elements[key]!.children ?? [] : []
  if (!key || children.length === 0)
    return undefined
  const elements: Spec['elements'] = {}
  const collect = (name: string): void => {
    const element = spec.elements[name]
    if (!element || elements[name])
      return
    elements[name] = element
    for (const child of [...element.children ?? [], ...Object.values(element.slots ?? {}).flat()])
      collect(child)
  }
  children.forEach(collect)
  const single = children.length === 1
  const root = single ? children[0]! : key
  const tree = single ? elements : { [key]: { type: 'Fragment', props: { layout: 'stack' }, children }, ...elements }
  const used = referencedState(tree)
  const state = Object.fromEntries(Object.entries(spec.state ?? {}).filter(([name]) => used.has(name)))
  return Object.keys(state).length ? { root, elements: tree, state } : { root, elements: tree }
}
