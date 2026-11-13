import type { StreamParser } from '@codemirror/streamparser'
import type { Parser } from '@lezer/common'
import type { Highlighter, Tag } from '@lezer/highlight'
import type { CodeLanguage } from '../catalog/code-props.js'
import { StringStream } from '@codemirror/streamparser'
import { highlightCode, tagHighlighter, tags } from '@lezer/highlight'
import { parser as jsonParser } from '@lezer/json'

/**
 * The one mapping from grammar tags to classes, shared by CodeBlock and the
 * editor; `styles/code.css` colours the classes from the theme. The more
 * specific tag wins, so `null` reads as a literal rather than a keyword.
 */
export const lumiHighlighter: Highlighter = tagHighlighter([
  { tag: tags.keyword, class: 'lumi-tok-keyword' },
  { tag: [tags.atom, tags.bool, tags.null, tags.number, tags.unit, tags.color, tags.constant(tags.variableName)], class: 'lumi-tok-literal' },
  { tag: [tags.string, tags.character, tags.attributeValue, tags.docString, tags.special(tags.string)], class: 'lumi-tok-string' },
  { tag: [tags.regexp, tags.escape], class: 'lumi-tok-regexp' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.standard(tags.variableName), tags.macroName], class: 'lumi-tok-function' },
  { tag: [tags.typeName, tags.className, tags.namespace], class: 'lumi-tok-type' },
  { tag: tags.tagName, class: 'lumi-tok-tag' },
  { tag: [tags.propertyName, tags.attributeName, tags.labelName], class: 'lumi-tok-property' },
  { tag: tags.comment, class: 'lumi-tok-comment' },
  { tag: [tags.meta, tags.processingInstruction], class: 'lumi-tok-meta' },
  { tag: [tags.operator, tags.punctuation], class: 'lumi-tok-punctuation' },
  { tag: tags.heading, class: 'lumi-tok-heading' },
  { tag: tags.strong, class: 'lumi-tok-strong' },
  { tag: tags.emphasis, class: 'lumi-tok-emphasis' },
  { tag: tags.strikethrough, class: 'lumi-tok-strikethrough' },
  { tag: [tags.link, tags.url], class: 'lumi-tok-link' },
  { tag: tags.monospace, class: 'lumi-tok-string' },
  { tag: tags.quote, class: 'lumi-tok-comment' },
  { tag: tags.inserted, class: 'lumi-tok-inserted' },
  { tag: tags.deleted, class: 'lumi-tok-deleted' },
  { tag: tags.invalid, class: 'lumi-tok-invalid' },
])

export interface CodeToken {
  text: string
  className?: string
}

export type CodeLine = CodeToken[]

/** A Lezer grammar, or a CodeMirror stream mode for languages without one. */
export type CodeGrammar = Parser | StreamParser<unknown>

export type CodeGrammars = Partial<Record<CodeLanguage, CodeGrammar>>

// Every grammar but JSON lives in a chunk of its own, so a page that only
// shows JSON never downloads the others. A chunk may hand over more than the
// language asked for when it carries those grammars anyway (HTML nests
// JavaScript and CSS).
const loaders: Partial<Record<CodeLanguage, () => Promise<{ grammars: CodeGrammars }>>> = {
  javascript: () => import('./grammar-javascript.js'),
  typescript: () => import('./grammar-javascript.js'),
  jsx: () => import('./grammar-javascript.js'),
  tsx: () => import('./grammar-javascript.js'),
  css: () => import('./grammar-css.js'),
  html: () => import('./grammar-html.js'),
  go: () => import('./grammar-go.js'),
  yaml: () => import('./grammar-yaml.js'),
  markdown: () => import('./grammar-markdown.js'),
  bash: () => import('./grammar-shell.js'),
  sql: () => import('./grammar-sql.js'),
}

const grammars = new Map<CodeLanguage, CodeGrammar>([['json', jsonParser]])
const loading = new Map<CodeLanguage, Promise<boolean>>()

// Adds grammars that arrived some other way, such as with an editor language chunk.
export function registerCodeGrammars(entries: CodeGrammars): void {
  for (const [language, grammar] of Object.entries(entries) as [CodeLanguage, CodeGrammar][])
    grammars.set(language, grammar)
}

// The grammar for a language once it is loaded; `text` and unknown languages have none.
export function codeGrammar(language: CodeLanguage): CodeGrammar | undefined {
  return grammars.get(language)
}

/** Runs `load` once per key; a failure is forgotten so the next call retries. */
export function loadOnce<K, T>(pending: Map<K, Promise<T>>, key: K, load: () => Promise<T>): Promise<T> {
  let promise = pending.get(key)
  if (!promise) {
    pending.set(key, promise = load())
    promise.catch(() => pending.delete(key))
  }
  return promise
}

// Loads a language's grammar once and resolves whether one exists.
export function loadCodeGrammar(language: CodeLanguage): Promise<boolean> {
  const load = loaders[language]
  return grammars.has(language) || !load
    ? Promise.resolve(grammars.has(language))
    : loadOnce(loading, language, async () => {
        registerCodeGrammars((await load()).grammars)
        return grammars.has(language)
      })
}

function isStreamMode(grammar: CodeGrammar): grammar is StreamParser<unknown> {
  return typeof (grammar as StreamParser<unknown>).token === 'function'
}

/** Stream token names resolve to tags the way CodeMirror's StreamLanguage resolves them. */
const LEGACY_NAMES: Record<string, string> = {
  'variable': 'variableName',
  'variable-2': 'variableName.special',
  'string-2': 'string.special',
  'def': 'variableName.definition',
  'tag': 'tagName',
  'attribute': 'attributeName',
  'type': 'typeName',
  'builtin': 'variableName.standard',
  'qualifier': 'modifier',
  'error': 'invalid',
  'header': 'heading',
  'property': 'propertyName',
}

const tagTable = tags as unknown as Record<string, Tag | ((tag: Tag) => Tag) | undefined>
const streamClasses = new Map<string, string>()

function streamClass(style: string): string {
  let cached = streamClasses.get(style)
  if (cached === undefined) {
    const resolved: Tag[] = []
    for (const name of style.split(' ')) {
      let found: Tag[] = []
      for (const part of (LEGACY_NAMES[name] ?? name).split('.')) {
        const value = tagTable[part]
        if (typeof value === 'function')
          found = found.map(value)
        else if (value && !found.length)
          found = [value]
      }
      resolved.push(...found)
    }
    cached = (resolved.length && lumiHighlighter.style(resolved)) || ''
    streamClasses.set(style, cached)
  }
  return cached
}

function push(line: CodeLine, text: string, className: string): void {
  const last = line.at(-1)
  if (last && (last.className ?? '') === className)
    last.text += text
  else
    line.push(className ? { text, className } : { text })
}

function highlightStream(code: string, mode: StreamParser<unknown>): CodeLine[] {
  const state = mode.startState?.(2)
  return code.split('\n').map((text) => {
    const line: CodeLine = []
    if (!text) {
      mode.blankLine?.(state, 2)
      return line
    }
    const stream = new StringStream(text, 4, 2)
    while (!stream.eol()) {
      const style = mode.token(stream, state)
      if (stream.pos <= stream.start)
        stream.pos = stream.start + 1
      push(line, stream.current(), style ? streamClass(style) : '')
      stream.start = stream.pos
    }
    return line
  })
}

// Splits normalized code into lines of classed tokens. `text`, unknown
// languages and languages whose grammar is not loaded yet give null; see
// `loadCodeGrammar`.
export function highlightLines(code: string, language: CodeLanguage): CodeLine[] | null {
  const grammar = grammars.get(language)
  if (!grammar)
    return null
  if (isStreamMode(grammar))
    return highlightStream(code, grammar)
  const lines: CodeLine[] = [[]]
  highlightCode(code, grammar.parse(code), lumiHighlighter, (text, classes) => push(lines.at(-1)!, text, classes), () => lines.push([]))
  return lines
}

/** The offset of the first syntax error Lezer's JSON grammar finds, or null. */
export function jsonErrorOffset(text: string): number | null {
  let found: number | null = null
  jsonParser.parse(text).iterate({
    enter: (node) => {
      if (found !== null)
        return false
      if (node.type.isError) {
        found = node.from
        return false
      }
      return undefined
    },
  })
  return found
}
