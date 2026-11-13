import type { ReactElement, ReactNode } from 'react'
import { useUiText } from '@duxweb/lumi-ui'
import { createContext, useContext, useMemo } from 'react'

/** How deep includes may nest; a deeper one renders an error instead of loading. */
export const MAX_INCLUDE_DEPTH = 8

/** Renders the page at `src` with its own state, `params` at `/include/params`; createAdmin supplies it. */
export type AdminIncludeRenderer = (src: string, params: Record<string, unknown>) => ReactNode

const IncludeRendererContext = createContext<AdminIncludeRenderer | null>(null)
/** The sources of the includes around this point, outermost first. */
const IncludeChainContext = createContext<readonly string[]>([])

/** Supplies how an `Include` element renders the page it names. */
export function AdminIncludeProvider({ render, children }: { render: AdminIncludeRenderer, children?: ReactNode }): ReactElement {
  return <IncludeRendererContext value={render}>{children}</IncludeRendererContext>
}

function IncludeError({ message }: { message: string }): ReactElement {
  return <div role="alert" data-slot="include-error" className="text-[length:var(--lumi-fs-label)] text-destructive">{message}</div>
}

/**
 * Another JSON page in place of this element. It loads when it first renders
 * and is cached by `src`; its state is its own, with `params` at
 * `/include/params`, and it starts afresh when `params` change. A page that
 * includes itself, directly or further down, and nesting past
 * `MAX_INCLUDE_DEPTH` render an error instead.
 */
export function AdminInclude({ src, params }: { src: string, params?: Record<string, unknown> | null | undefined }): ReactElement {
  const { t } = useUiText()
  const render = useContext(IncludeRendererContext)
  const chain = useContext(IncludeChainContext)
  const values = useMemo(() => params ?? {}, [params])
  // The page remounts when params change: its state was seeded from them.
  const key = useMemo(() => JSON.stringify(values), [values])
  const nested = useMemo(() => [...chain, src], [chain, src])
  if (!render)
    return <IncludeError message={t('lumi.admin.include.noHost', 'Include needs an Admin to load pages')} />
  if (chain.includes(src))
    return <IncludeError message={t('lumi.admin.include.cycle', 'Include loop: {path}', { path: nested.join(' → ') })} />
  if (chain.length >= MAX_INCLUDE_DEPTH)
    return <IncludeError message={t('lumi.admin.include.depth', 'Includes nest deeper than {max}', { max: MAX_INCLUDE_DEPTH })} />
  return (
    <IncludeChainContext key={key} value={nested}>
      {render(src, values)}
    </IncludeChainContext>
  )
}
