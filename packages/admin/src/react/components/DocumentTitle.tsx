import type { PropsWithChildren, ReactElement } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

const PLACEHOLDER_RE = /\{(page|app)\}/g
const SEPARATOR_EDGE_RE = /^[\s·|\-–—:]+|[\s·|\-–—:]+$/g

export const DEFAULT_DOCUMENT_TITLE = '{page} · {app}'

/**
 * The browser tab's title from a template with `{page}` and `{app}`. Without
 * a page name the separators around the missing part are dropped, so the app
 * title stands alone.
 */
export function formatDocumentTitle(template: string, values: { page?: string, app: string }): string {
  const text = template.replace(PLACEHOLDER_RE, (_, name: 'page' | 'app') => values[name] ?? '')
  return values.page ? text : text.replace(SEPARATOR_EDGE_RE, '') || values.app
}

const DocumentTitleContext = createContext<((title: string | undefined) => void) | null>(null)

/**
 * Names the current page in the browser tab, in place of its menu label, while
 * the calling component is mounted, e.g. with the record's name on a detail page.
 */
export function useDocumentTitle(title: string | undefined): void {
  const set = useContext(DocumentTitleContext)
  useEffect(() => {
    if (!set || !title)
      return
    set(title)
    return () => set(undefined)
  }, [set, title])
}

export interface AdminDocumentTitleProps {
  /** The route's label; a page may replace it through useDocumentTitle. */
  page?: string
  app: string
  /** A template with `{page}` and `{app}`; `false` leaves the title alone. */
  template?: string | false
}

/** Sets the browser tab's title from the page and app names by the manifest's `documentTitle` template. */
export function AdminDocumentTitle({ page, app, template = DEFAULT_DOCUMENT_TITLE, children }: PropsWithChildren<AdminDocumentTitleProps>): ReactElement {
  const [override, setOverride] = useState<string | undefined>(undefined)
  const title = template === false ? undefined : formatDocumentTitle(template, { page: override ?? page, app })
  useEffect(() => {
    if (title !== undefined)
      document.title = title
  }, [title])
  return <DocumentTitleContext.Provider value={setOverride}>{children}</DocumentTitleContext.Provider>
}
