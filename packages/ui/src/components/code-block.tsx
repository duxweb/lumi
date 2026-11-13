import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react'
import type { CodeLanguage } from '../catalog/code-props.js'
import type { CodeBlockProps, CodeFile } from '../catalog/types-public.js'
import type { CodeLine } from '../code/highlight.js'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { codeLanguageLabel, normalizeCode, resolveCodeLanguage } from '../code/languages.js'
import { CheckIcon, ChevronDownIcon, CopyIcon } from '../icons.js'
import { Button } from '../internal/shadcn/button.js'
import { cn } from '../internal/utils.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'role'?: string }

type HighlightModule = typeof import('../code/highlight.js')

let highlighter: HighlightModule | undefined
let pending: Promise<HighlightModule> | undefined

/**
 * Loads the highlighter once and, given a language, that language's grammar
 * chunk; a failed load can be retried by the next caller.
 */
export async function loadCodeHighlighter(language?: CodeLanguage): Promise<HighlightModule> {
  pending ??= import('../code/highlight.js').then((module) => {
    highlighter = module
    return module
  }, (error: unknown) => {
    pending = undefined
    throw error
  })
  const module = await pending
  if (language)
    await module.loadCodeGrammar(language)
  return module
}

function ready(language: CodeLanguage): HighlightModule | undefined {
  return highlighter?.codeGrammar(language) ? highlighter : undefined
}

/** The highlighter once it and the language's grammar are in. */
function useCodeHighlighter(language: CodeLanguage): HighlightModule | undefined {
  const [loaded, setLoaded] = useState(() => ({ language, module: ready(language) }))
  const module = loaded.language === language && loaded.module ? loaded.module : ready(language)
  useEffect(() => {
    if (language === 'text' || module)
      return
    let live = true
    loadCodeHighlighter(language).then(next => live && setLoaded({ language, module: next }), () => {})
    return () => {
      live = false
    }
  }, [language, module])
  return module
}

/** Highlighted lines once the grammar chunk is in; until then the same lines as plain text. */
export function useCodeLines(code: string, language: string | null | undefined): CodeLine[] {
  const lang = resolveCodeLanguage(language)
  const engine = useCodeHighlighter(lang)
  const text = useMemo(() => normalizeCode(code), [code])
  return useMemo(() => {
    let lines: CodeLine[] | null = null
    try {
      lines = engine ? engine.highlightLines(text, lang) : null
    }
    catch {}
    return lines ?? text.split('\n').map(line => line ? [{ text: line }] : [])
  }, [engine, text, lang])
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  }
  catch {}
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied)
    throw new Error('Copy failed')
}

function CopyButton({ text, floating }: { text: string, floating?: boolean }): ReactElement {
  const { t } = useUiText()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied)
      return
    const timer = setTimeout(setCopied, 2000, false)
    return () => clearTimeout(timer)
  }, [copied])
  const label = copied ? t('lumi.code.copied', 'Copied') : t('lumi.code.copy', 'Copy code')
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="lumi-code-copy"
        aria-label={label}
        title={label}
        data-slot="code-block-copy"
        data-floating={floating || undefined}
        data-copied={copied || undefined}
        onClick={() => {
          copyText(text).then(() => setCopied(true), () => {})
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <span role="status" className="sr-only">{copied ? label : ''}</span>
    </>
  )
}

/** Which ends of a horizontal scroller have content hidden past them: `start`, `end`, both or neither. */
function useScrollEdges(enabled: boolean): [RefObject<HTMLDivElement | null>, string | undefined] {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<string>()
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element || typeof ResizeObserver === 'undefined')
      return
    const update = (): void => {
      const start = element.scrollLeft > 1
      const end = element.scrollLeft + element.clientWidth < element.scrollWidth - 1
      setEdges([start && 'start', end && 'end'].filter(Boolean).join(' ') || undefined)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    element.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', update)
    }
  }, [enabled])
  return [ref, edges]
}

function CodeLines({ lines, showLineNumbers, highlightLines }: { lines: CodeLine[], showLineNumbers?: boolean | undefined, highlightLines?: readonly number[] | undefined }): ReactElement {
  const marked = new Set(highlightLines)
  return (
    <code className="lumi-code-lines">
      {lines.map((tokens, index) => (
        <span key={index} className="lumi-code-line" data-highlighted={marked.has(index + 1) || undefined}>
          {showLineNumbers && <span className="lumi-code-ln" aria-hidden>{index + 1}</span>}
          <span className="lumi-code-text">
            {tokens.map((token, at) => token.className
              ? <span key={at} className={token.className}>{token.text}</span>
              : token.text)}
          </span>
        </span>
      ))}
    </code>
  )
}

/**
 * Read-only source. The plain lines render first with the same metrics, so
 * the highlighting that follows the lazily loaded grammar chunk moves nothing.
 */
export function LumiCodeBlock(props: CodeBlockProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { code, language, title, files, showLineNumbers, highlightLines, wrap, maxHeight = 400, copyable = true, collapsible, defaultOpen, className, children, role: _role, 'aria-label': ariaLabel, ...rest } = props
  const sources: CodeFile[] = files?.length ? files : [{ title: title ?? '', language, code: code ?? (typeof children === 'string' ? children : '') }]
  const tabbed = Boolean(files?.length)
  const [active, setActive] = useState(0)
  const index = Math.min(active, sources.length - 1)
  const file = sources[index]!
  const lang = resolveCodeLanguage(file.language)
  const lines = useCodeLines(file.code, lang)
  const regionLabel = ariaLabel ?? (title || (lang === 'text' ? t('lumi.code.source', 'Source') : t('lumi.code.languageSource', '{language} source', { language: codeLanguageLabel(lang) })))
  const gutter = { '--lumi-code-gutter': `${String(lines.length).length}ch`, maxHeight } as CSSProperties
  const copy = copyable && <CopyButton text={file.code} floating={!tabbed && !title} />
  const [tabList, tabEdges] = useScrollEdges(tabbed)

  const pre = (
    <pre
      tabIndex={0}
      // A named group rather than a region: pages hold many blocks, and landmarks must be unique.
      // Inside tabs the panel role and name come from Radix; an explicit undefined would erase them.
      {...(tabbed ? {} : { 'role': 'group', 'aria-label': regionLabel })}
      className="lumi-code-scroll"
      style={gutter}
      data-slot="code-block-content"
      data-language={lang}
    >
      <CodeLines lines={lines} showLineNumbers={showLineNumbers} highlightLines={highlightLines} />
    </pre>
  )
  const body = tabbed
    ? <TabsPrimitive.Content value={String(index)} asChild>{pre}</TabsPrimitive.Content>
    : pre
  const header = (tabbed || (title && !collapsible)) && (
    <div className="lumi-code-header" data-slot="code-block-header">
      {tabbed
        ? (
            <TabsPrimitive.List ref={tabList} className="lumi-code-tabs" aria-label={ariaLabel ?? title ?? t('lumi.code.files', 'Files')} data-overflow={tabEdges} loop>
              {sources.map((source, at) => (
                <TabsPrimitive.Trigger key={at} value={String(at)} className="lumi-code-tab" data-slot="code-block-tab">
                  {source.title}
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>
          )
        : <span className="lumi-code-title" data-slot="code-block-title">{title}</span>}
      {copy}
    </div>
  )
  const content = (
    <>
      {header}
      <div className="lumi-code-body">
        {body}
        {!header && copy}
      </div>
    </>
  )
  const attributes = {
    ...rest,
    'className': cn('lumi-code-block', className),
    'data-slot': 'code-block',
    'data-wrap': wrap || undefined,
    'data-line-numbers': showLineNumbers || undefined,
  }
  const framed = tabbed
    ? <TabsPrimitive.Root value={String(index)} onValueChange={value => setActive(Number(value))} asChild><div {...attributes}>{content}</div></TabsPrimitive.Root>
    : <div {...attributes}>{content}</div>

  if (!collapsible)
    return framed
  return (
    <details {...attributes} open={defaultOpen}>
      <summary className="lumi-code-header lumi-code-summary" data-slot="code-block-summary">
        <ChevronDownIcon className="lumi-code-chevron" aria-hidden />
        <span className="lumi-code-title">{title ?? t('lumi.code.source', 'Source')}</span>
      </summary>
      {tabbed ? <TabsPrimitive.Root value={String(index)} onValueChange={value => setActive(Number(value))}>{content}</TabsPrimitive.Root> : content}
    </details>
  )
}
