import type { ReactElement, ReactNode } from 'react'
import { Fragment } from 'react'
import { cn } from '../../internal/utils.js'
import { LumiCodeBlock } from '../code-block.js'

// A deliberately small Markdown subset: headings, paragraphs, lists (with
// task items), quotes, fenced code, tables, rules and inline code, emphasis,
// strikethrough and links. Raw HTML is never interpreted — every character
// ends up in a React text node — and only http(s), mailto, tel and relative
// links become anchors. Unclosed marks while streaming stay text. Images and
// heading anchors are opt-in: model answers leave them off, so a prompt cannot
// make the reader's browser fetch an arbitrary image.

type Block
  = | { kind: 'paragraph', text: string }
    | { kind: 'heading', level: number, text: string }
    | { kind: 'code', language: string, code: string }
    | { kind: 'quote', blocks: Block[] }
    | { kind: 'list', ordered: boolean, start: number, items: Block[][], tasks: Array<boolean | undefined> }
    | { kind: 'table', align: Array<'left' | 'center' | 'right' | undefined>, head: string[], rows: string[][] }
    | { kind: 'rule' }

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/
const HEADING = /^ {0,3}(#{1,6})[ \t](.*)$/
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/
const QUOTE = /^ {0,3}> ?/
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])[ \t](.*)$/
const DIVIDER_CELL = /^:?-+:?$/
const WHITESPACE = /\s+/
const HTTP = /^https?:/i
const BLANK = /^\s*$/
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!~|>]/
const SCHEME = /^([a-z][a-z\d+.-]*):/i
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])
const CITATION = /^\d{1,3}$/
const WORD = /[\p{L}\p{N}]/u
const ORDERED = /^\d/
const LEADING_SPACES = /^ */
const LEADING_PIPE = /^\s*\|/
const TRAILING_PIPE = /\|\s*$/
const CELL_SPLIT = /(?<!\\)\|/
const ESCAPED_PIPE = /\\\|/g
const NEWLINES = /\r\n?/g
const TASK = /^\[([ x])\][ \t]+/i
const IMAGE_ONLY = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/
const SLUG_DROP = /[^\p{L}\p{N}\s-]/gu
const SLUG_SPACE = /\s+/g
const INLINE_LINK = /!?\[([^\]]*)\]\([^)]*\)/g
const INLINE_MARKS = /[`*_~\\]/g
const QUOTES = /^"|"$/g

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || LIST_ITEM.test(line)
}

function cells(line: string): string[] {
  return line.replace(LEADING_PIPE, '').replace(TRAILING_PIPE, '').split(CELL_SPLIT).map(cell => cell.trim().replace(ESCAPED_PIPE, '|'))
}

function isTableDivider(line: string | undefined): boolean {
  if (!line?.includes('-'))
    return false
  const parts = cells(line)
  return parts.length > 0 && parts.every(cell => DIVIDER_CELL.test(cell))
}

/** `Title ##` → `Title`: closing hashes count only after a space. */
function headingText(text: string): string {
  const trimmed = text.trim()
  let end = trimmed.length
  while (end > 0 && trimmed[end - 1] === '#')
    end--
  return end < trimmed.length && (end === 0 || trimmed[end - 1] === ' ') ? trimmed.slice(0, end).trimEnd() : trimmed
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    if (BLANK.test(line)) {
      index++
      continue
    }
    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1]!
      const body: string[] = []
      index++
      while (index < lines.length && !lines[index]!.trimStart().startsWith(marker))
        body.push(lines[index++]!)
      index++
      blocks.push({ kind: 'code', language: fence[2] ?? '', code: body.join('\n') })
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: headingText(heading[2]!) })
      index++
      continue
    }
    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' })
      index++
      continue
    }
    if (QUOTE.test(line)) {
      const body: string[] = []
      while (index < lines.length && QUOTE.test(lines[index]!))
        body.push(lines[index++]!.replace(QUOTE, ''))
      blocks.push({ kind: 'quote', blocks: parseBlocks(body) })
      continue
    }
    const item = LIST_ITEM.exec(line)
    if (item) {
      const indent = item[1]!.length
      const ordered = ORDERED.test(item[2]!)
      const items: string[][] = []
      const tasks: Array<boolean | undefined> = []
      while (index < lines.length) {
        const current = lines[index]!
        const match = LIST_ITEM.exec(current)
        if (match && match[1]!.length === indent && ORDERED.test(match[2]!) === ordered) {
          const first = match[3]!.trimStart()
          const task = TASK.exec(first)
          tasks.push(task ? task[1] !== ' ' : undefined)
          items.push([task ? first.slice(task[0].length) : first])
          index++
          continue
        }
        if (BLANK.test(current)) {
          const next = lines[index + 1]
          if (next !== undefined && (LEADING_SPACES.exec(next)![0].length > indent || (LIST_ITEM.exec(next)?.[1]!.length === indent))) {
            items.at(-1)!.push('')
            index++
            continue
          }
          break
        }
        const depth = LEADING_SPACES.exec(current)![0].length
        if (depth > indent || (!startsBlock(current) && !match)) {
          items.at(-1)!.push(current.slice(Math.min(depth, indent + 2)))
          index++
          continue
        }
        break
      }
      blocks.push({ kind: 'list', ordered, start: ordered ? Number.parseInt(item[2]!, 10) : 1, items: items.map(body => parseBlocks(body)), tasks })
      continue
    }
    if (line.includes('|') && isTableDivider(lines[index + 1])) {
      const head = cells(line)
      const align = cells(lines[index + 1]!).map((cell) => {
        const left = cell.startsWith(':')
        const right = cell.endsWith(':')
        return left && right ? 'center' : right ? 'right' : left ? 'left' : undefined
      })
      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index]!.includes('|') && !BLANK.test(lines[index]!))
        rows.push(cells(lines[index++]!))
      blocks.push({ kind: 'table', align, head, rows })
      continue
    }
    const body: string[] = [line]
    index++
    while (index < lines.length && !BLANK.test(lines[index]!) && !startsBlock(lines[index]!))
      body.push(lines[index++]!)
    blocks.push({ kind: 'paragraph', text: body.join('\n') })
  }
  return blocks
}

// eslint-disable-next-line no-control-regex -- browsers drop these before reading a URL's scheme
const URL_PADDING = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g

export function safeHref(url: string): string | undefined {
  // Trim what a browser strips, so `\u0001javascript:` is judged by its real scheme.
  const href = url.replace(URL_PADDING, '')
  const scheme = SCHEME.exec(href)
  if (scheme && !SAFE_SCHEMES.has(scheme[1]!.toLowerCase()))
    return undefined
  return href || undefined
}

interface InlineContext {
  renderCitation?: ((index: number) => ReactNode | undefined) | undefined
  /** Draws `![alt](src)`; off, the image stays text. */
  images?: boolean | undefined
  /** Gives each heading an id from its text, de-duplicated within one render. */
  slugs?: Map<string, number> | undefined
}

/** An image source: http(s) or same-origin only, never `data:` or other schemes. */
export function safeImageSrc(url: string): string | undefined {
  const src = url.trim()
  const scheme = SCHEME.exec(src)
  if (scheme && !HTTP.test(src))
    return undefined
  return src || undefined
}

/** `Install & run` → `install-run`; letters of any script survive. */
function slug(text: string, slugs: Map<string, number>): string {
  const base = text.toLowerCase().replace(SLUG_DROP, '').trim().replace(SLUG_SPACE, '-') || 'section'
  const seen = slugs.get(base) ?? 0
  slugs.set(base, seen + 1)
  return seen ? `${base}-${seen}` : base
}

/** The plain text of inline Markdown, for ids and labels. */
function plain(source: string): string {
  return source.replace(INLINE_LINK, '$1').replace(INLINE_MARKS, '')
}

/** Index of the `]` matching the `[` at `open`, honouring nesting and escapes. */
function closingBracket(source: string, open: number): number {
  let depth = 0
  for (let at = open; at < source.length; at++) {
    const char = source[at]
    if (char === '\\') {
      at++
      continue
    }
    if (char === '[')
      depth++
    else if (char === ']' && --depth === 0)
      return at
  }
  return -1
}

/** Finds `mark` closing a span opened just before `from`, with content that does not start or end in a space. */
function closingMark(source: string, mark: string, from: number): number {
  let at = source.indexOf(mark, from)
  while (at > from) {
    const inner = source.slice(from, at)
    const wordAfter = mark[0] === '_' && WORD.test(source[at + mark.length] ?? '')
    if (inner.trim() === inner && !wordAfter && !(mark.length === 1 && source[at + 1] === mark))
      return at
    at = source.indexOf(mark, at + 1)
  }
  return -1
}

function inline(source: string, context: InlineContext, key = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  let text = ''
  let index = 0
  const flush = (): void => {
    if (text) {
      out.push(text)
      text = ''
    }
  }
  const push = (node: ReactNode): void => {
    flush()
    out.push(<Fragment key={`${key}.${out.length}`}>{node}</Fragment>)
  }
  while (index < source.length) {
    const char = source[index]!
    if (char === '\\' && ESCAPABLE.test(source[index + 1] ?? '')) {
      text += source[index + 1]
      index += 2
      continue
    }
    if (char === '\n') {
      push(<br />)
      index++
      continue
    }
    if (char === '`') {
      let run = 1
      while (source[index + run] === '`')
        run++
      const fence = '`'.repeat(run)
      const end = source.indexOf(fence, index + run)
      if (end > index) {
        push(<code data-slot="markdown-code">{source.slice(index + run, end).trim() || source.slice(index + run, end)}</code>)
        index = end + run
        continue
      }
      text += fence
      index += run
      continue
    }
    if (char === '*' || char === '_' || char === '~') {
      const double = source[index + 1] === char
      const opensWord = char !== '_' || !WORD.test(source[index - 1] ?? '')
      if (char === '~' && !double) {
        text += char
        index++
        continue
      }
      const mark = double ? char + char : char
      const start = index + mark.length
      const end = opensWord && source[start] !== ' ' ? closingMark(source, mark, start) : -1
      if (end > start) {
        const children = inline(source.slice(start, end), context, `${key}.${out.length}`)
        push(char === '~' ? <del>{children}</del> : double ? <strong>{children}</strong> : <em>{children}</em>)
        index = end + mark.length
        continue
      }
      text += mark
      index += mark.length
      continue
    }
    if (char === '!' && source[index + 1] === '[' && context.images) {
      const close = closingBracket(source, index + 1)
      if (close > index && source[close + 1] === '(') {
        const end = source.indexOf(')', close + 2)
        if (end > close) {
          const [target = '', ...rest] = source.slice(close + 2, end).trim().split(WHITESPACE)
          const src = safeImageSrc(target)
          const title = rest.join(' ').replace(QUOTES, '') || undefined
          if (src) {
            push(<img src={src} alt={source.slice(index + 2, close)} title={title} loading="lazy" decoding="async" />)
            index = end + 1
            continue
          }
        }
      }
    }
    if (char === '[') {
      const close = closingBracket(source, index)
      if (close > index) {
        const label = source.slice(index + 1, close)
        if (source[close + 1] === '(') {
          const end = source.indexOf(')', close + 2)
          if (end > close) {
            const target = source.slice(close + 2, end).trim().split(WHITESPACE)[0] ?? ''
            const href = safeHref(target)
            const children = inline(label, context, `${key}.${out.length}`)
            const external = href !== undefined && HTTP.test(href)
            push(href ? <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a> : children)
            index = end + 1
            continue
          }
        }
        if (context.renderCitation && CITATION.test(label)) {
          const citation = context.renderCitation(Number(label))
          if (citation) {
            push(citation)
            index = close + 1
            continue
          }
        }
      }
    }
    text += char
    index++
  }
  flush()
  return out
}

function BlockView({ block, context, trailing }: { block: Block, context: InlineContext, trailing?: ReactNode }): ReactElement {
  switch (block.kind) {
    case 'paragraph': {
      // An image alone in its paragraph is a figure; its title is the caption.
      const figure = context.images ? IMAGE_ONLY.exec(block.text.trim()) : null
      const src = figure && safeImageSrc(figure[2]!)
      if (figure && src) {
        return (
          <figure>
            <img src={src} alt={figure[1]} loading="lazy" decoding="async" />
            {figure[3] && <figcaption>{figure[3]}</figcaption>}
            {trailing}
          </figure>
        )
      }
      return (
        <p>
          {inline(block.text, context)}
          {trailing}
        </p>
      )
    }
    case 'heading': {
      const Tag = `h${Math.min(6, block.level)}` as 'h1'
      return (
        <Tag id={context.slugs ? slug(plain(block.text), context.slugs) : undefined}>
          {inline(block.text, context)}
          {trailing}
        </Tag>
      )
    }
    case 'rule':
      return (
        <>
          <hr />
          {trailing}
        </>
      )
    case 'code':
      return (
        <>
          <LumiCodeBlock code={block.code} language={block.language || undefined} maxHeight={320} />
          {trailing}
        </>
      )
    case 'quote':
      return <blockquote><Blocks blocks={block.blocks} context={context} trailing={trailing} /></blockquote>
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List start={block.ordered && block.start !== 1 ? block.start : undefined}>
          {block.items.map((item, at) => {
            const done = block.tasks[at]
            return (
              <li key={at} data-task={done === undefined ? undefined : done ? 'done' : 'open'}>
                {done !== undefined && <input type="checkbox" checked={done} disabled readOnly aria-label={done ? 'Done' : 'To do'} />}
                <Blocks blocks={item} context={context} trailing={at === block.items.length - 1 ? trailing : undefined} />
              </li>
            )
          })}
        </List>
      )
    }
    case 'table':
      return (
        <>
          <div className="lumi-md-table" role="region" tabIndex={0} aria-label={block.head.join(', ')}>
            <table>
              <thead>
                <tr>
                  {block.head.map((cell, at) => <th key={at} style={{ textAlign: block.align[at] }}>{inline(cell, context)}</th>)}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, at) => (
                  <tr key={at}>
                    {block.head.map((_, column) => <td key={column} style={{ textAlign: block.align[column] }}>{inline(row[column] ?? '', context)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trailing}
        </>
      )
  }
}

function Blocks({ blocks, context, trailing }: { blocks: Block[], context: InlineContext, trailing?: ReactNode }): ReactElement {
  if (!blocks.length)
    return <>{trailing}</>
  return (
    <>
      {blocks.map((block, at) => (
        <BlockView key={at} block={block} context={context} trailing={at === blocks.length - 1 ? trailing : undefined} />
      ))}
    </>
  )
}

export interface LumiMarkdownProps {
  text: string
  /** Rendered inline at the end of the last block, such as a streaming caret. */
  trailing?: ReactNode
  /** Turns `[n]` into a citation; without it, or when it returns nothing, the marker stays text. */
  renderCitation?: (index: number) => ReactNode | undefined
  /** Draws `![alt](src "caption")` from http(s) or relative sources. Off by default. */
  images?: boolean
  /** Gives headings ids from their text, so a table of contents can link to them. */
  anchors?: boolean
  /**
   * `chat` (default) is the compact answer style; `prose` leaves typesetting
   * to a surrounding `LumiProse`.
   */
  variant?: 'chat' | 'prose'
  className?: string
}

/** Renders Markdown safely: no raw HTML, only safe link and image schemes. */
export function LumiMarkdown({ text, trailing, renderCitation, images, anchors, variant = 'chat', className }: LumiMarkdownProps): ReactElement {
  const blocks = parseBlocks(text.replace(NEWLINES, '\n').split('\n'))
  const context: InlineContext = { renderCitation, images, slugs: anchors ? new Map() : undefined }
  return (
    <div className={cn(variant === 'chat' && 'lumi-md', className)} data-slot="markdown" data-variant={variant}>
      <Blocks blocks={blocks} context={context} trailing={trailing} />
    </div>
  )
}
