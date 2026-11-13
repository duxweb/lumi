import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { LumiAvatar as Avatar, LumiBadge as Badge, LumiHtml, LumiMarkdownContent, useUiText } from '@duxweb/lumi-ui'
import { useEffect, useId, useRef, useState } from 'react'

export interface LumiArticleProps {
  title: string
  summary?: string
  author?: { name: string, avatar?: string, role?: string }
  publishedAt?: string
  readingTime?: string
  tags?: readonly string[]
  cover?: { src: string, alt?: string, caption?: string }
  content: string
  format?: 'markdown' | 'html'
  toc?: boolean
  tocTitle?: string
  /** Beside the byline: edit, share. */
  actions?: ReactNode
  /** After the body: related records, comments. */
  children?: ReactNode
  className?: string
}

interface TocEntry {
  id: string
  text: string
  level: 2 | 3
}

const HEADINGS = 'h2, h3'

/** The body's h2 and h3 headings; a heading without an id gets one so it can be linked. */
function readHeadings(body: HTMLElement): TocEntry[] {
  return Array.from(body.querySelectorAll<HTMLHeadingElement>(HEADINGS), (heading, at): TocEntry => {
    if (!heading.id)
      heading.id = `section-${at + 1}`
    return { id: heading.id, text: heading.textContent?.trim() ?? '', level: heading.tagName === 'H2' ? 2 : 3 }
  }).filter(entry => entry.text)
}

export function LumiArticle({ title, summary, author, publishedAt, readingTime, tags, cover, content, format = 'markdown', toc = true, tocTitle, actions, children, className }: LumiArticleProps): ReactElement {
  const { t } = useUiText()
  const titleId = useId()
  const body = useRef<HTMLDivElement>(null)
  const [entries, setEntries] = useState<TocEntry[]>([])
  const [active, setActive] = useState<string>()

  // Html bodies arrive after the sanitizer loads, so the list follows the body's DOM rather than the source.
  useEffect(() => {
    const node = body.current
    if (!node || !toc)
      return
    const read = (): void => setEntries(readHeadings(node))
    read()
    const changes = new MutationObserver(read)
    changes.observe(node, { childList: true, subtree: true })
    return () => changes.disconnect()
  }, [toc, content, format])

  // The current section is the last heading that has passed the top fifth of the viewport.
  useEffect(() => {
    const node = body.current
    if (!node || !entries.length)
      return
    const headings = entries.map(entry => document.getElementById(entry.id)).filter((heading): heading is HTMLElement => heading !== null && node.contains(heading))
    const passed = new Set<string>()
    const watch = new IntersectionObserver((records) => {
      for (const record of records) {
        // The root is shrunk to the top fifth, so its bottom edge is the reading line.
        if (record.boundingClientRect.top < (record.rootBounds?.bottom ?? 0))
          passed.add(record.target.id)
        else
          passed.delete(record.target.id)
      }
      setActive(headings.filter(heading => passed.has(heading.id)).at(-1)?.id ?? headings[0]?.id)
    }, { rootMargin: '0px 0px -80% 0px', threshold: [0, 1] })
    headings.forEach(heading => watch.observe(heading))
    return () => watch.disconnect()
  }, [entries])

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string): void => {
    const target = document.getElementById(id)
    if (!target)
      return
    // In-page links must not reach the router; the hash would read as a route change.
    event.preventDefault()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    setActive(id)
  }

  const showToc = toc && entries.length > 1
  const byline = author || publishedAt || readingTime

  return (
    <article className={['lumi-article', className].filter(Boolean).join(' ')} aria-labelledby={titleId} data-toc={showToc || undefined}>
      <div className="lumi-article__main">
        <header className="lumi-article__header">
          {tags?.length
            ? (
                <ul className="lumi-article__tags" aria-label={t('lumi.article.tags', 'Tags')}>
                  {tags.map(tag => <li key={tag}><Badge label={tag} tone="neutral" appearance="soft" /></li>)}
                </ul>
              )
            : null}
          <h1 id={titleId} className="lumi-article__title">{title}</h1>
          {summary && <p className="lumi-article__summary">{summary}</p>}
          {byline || actions
            ? (
                <div className="lumi-article__byline">
                  {author && <Avatar name={author.name} src={author.avatar} size="md" />}
                  <div className="lumi-article__byline-text">
                    {author && (
                      <span className="lumi-article__author">
                        {author.name}
                        {author.role && <span className="lumi-article__role">{author.role}</span>}
                      </span>
                    )}
                    {(publishedAt || readingTime) && (
                      <span className="lumi-article__meta">
                        {publishedAt && <span>{publishedAt}</span>}
                        {publishedAt && readingTime && <span aria-hidden>·</span>}
                        {readingTime && <span>{readingTime}</span>}
                      </span>
                    )}
                  </div>
                  {actions && <div className="lumi-article__actions">{actions}</div>}
                </div>
              )
            : null}
        </header>

        {cover && (
          <figure className="lumi-article__cover">
            <img src={cover.src} alt={cover.alt ?? ''} decoding="async" />
            {cover.caption && <figcaption>{cover.caption}</figcaption>}
          </figure>
        )}

        <div ref={body} className="lumi-article__body">
          {format === 'html'
            ? <LumiHtml content={content} size="lg" />
            : <LumiMarkdownContent content={content} size="lg" />}
        </div>

        {children && <div className="lumi-article__after">{children}</div>}
      </div>

      {showToc && (
        <nav className="lumi-article__toc" aria-label={tocTitle ?? t('lumi.article.toc', 'On this page')}>
          <p className="lumi-article__toc-title" aria-hidden>{tocTitle ?? t('lumi.article.toc', 'On this page')}</p>
          <ul>
            {entries.map(entry => (
              <li key={entry.id} data-level={entry.level}>
                <a href={`#${entry.id}`} aria-current={active === entry.id ? 'location' : undefined} onClick={event => jump(event, entry.id)}>
                  {entry.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  )
}
