import type { Config, DOMPurify } from 'dompurify'
import type { ReactElement, ReactNode } from 'react'
import type { HtmlProps, MarkdownProps, ProseProps } from '../catalog/props.js'
import { useEffect, useState } from 'react'
import { cn } from '../internal/utils.js'
import { LumiMarkdown } from './agent/markdown.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string }

/** Long-form typesetting for whatever it wraps; Markdown and Html render inside it. */
export function LumiProse({ size, className, children, ...rest }: ProseProps & HostProps & { children?: ReactNode }): ReactElement {
  return (
    <div {...rest} className={cn('lumi-prose', className)} data-slot="prose" data-size={size ?? 'md'}>
      {children}
    </div>
  )
}

/** Markdown as typeset content: headings with ids, task lists, figures and highlighted code. */
export function LumiMarkdownContent({ content, size, anchors, className, ...rest }: MarkdownProps & HostProps): ReactElement {
  return (
    <LumiProse {...rest} size={size} className={className}>
      <LumiMarkdown text={content} images anchors={anchors !== false} variant="prose" />
    </LumiProse>
  )
}

// Everything a saved article body needs, nothing that runs or submits: no
// scripts, frames, forms or inline styles. URLs keep DOMPurify's own scheme
// check; ids are prefixed (`user-content-`) so they cannot clobber the page.
const SANITIZE: Config = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'option', 'textarea', 'iframe', 'frame', 'object', 'embed', 'link', 'meta', 'base', 'dialog'],
  FORBID_ATTR: ['style', 'autofocus', 'tabindex'],
  ALLOW_DATA_ATTR: false,
  SANITIZE_NAMED_PROPS: true,
}

const EXTERNAL = /^https?:/i

let purifier: DOMPurify | undefined
let loading: Promise<DOMPurify> | undefined

/** A private DOMPurify instance, loaded once on first use; its hooks never touch the app's own. */
function loadPurifier(): Promise<DOMPurify> {
  loading ??= import('dompurify').then(({ default: create }) => {
    const instance = create(window)
    instance.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && EXTERNAL.test(node.getAttribute('href') ?? '')) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
      if (node.tagName === 'IMG') {
        node.setAttribute('loading', 'lazy')
        node.setAttribute('decoding', 'async')
      }
    })
    purifier = instance
    return instance
  }, (error: unknown) => {
    // A failed chunk load is retried by the next block that needs it.
    loading = undefined
    throw error
  })
  return loading
}

/** Sanitizes `content` with DOMPurify and draws it in the Prose styles. */
export function LumiHtml({ content, size, className, ...rest }: HtmlProps & HostProps): ReactElement {
  // Once the sanitizer is loaded every later block cleans its markup during render, with no empty frame.
  const [loaded, setLoaded] = useState(() => purifier !== undefined)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (loaded)
      return
    let live = true
    loadPurifier().then(() => {
      if (live)
        setLoaded(true)
    }, (error: unknown) => {
      console.error('[lumi-ui] the HTML sanitizer failed to load', error)
      if (live)
        setFailed(true)
    })
    return () => {
      live = false
    }
  }, [loaded])
  const html = loaded && purifier ? purifier.sanitize(content, SANITIZE) : undefined
  return (
    <LumiProse {...rest} size={size} className={className}>
      {html === undefined
        // Unsanitized markup is never drawn; without the sanitizer the block stays empty.
        ? <div data-slot="html" aria-busy={failed ? undefined : true} />
        // The string comes straight out of DOMPurify with the configuration above.
        : <div data-slot="html" dangerouslySetInnerHTML={{ __html: html }} />}
    </LumiProse>
  )
}
