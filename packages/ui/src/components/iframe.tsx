import type { ReactElement, ReactNode } from 'react'
import type { IframeProps } from '../catalog/types-public.js'
import { createContext, useContext, useMemo, useState } from 'react'
import { cn } from '../internal/utils.js'
import { aspectRatioStyle } from './media.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'data-testid'?: string
}

const SANDBOX = 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals'
const DEFAULT_HEIGHT = 480

function pageHref(): string {
  return typeof location === 'undefined' ? 'http://lumi.invalid/' : location.href
}

/**
 * The address a frame may show, or undefined. A path on this site always
 * passes; another site needs https and, when `origins` is given, one of them.
 * `javascript:`, `data:`, `blob:` and every other scheme are refused.
 */
export function embeddableUrl(src: string, origins?: readonly string[]): string | undefined {
  if (!src.trim())
    return undefined
  let url: URL
  try {
    url = new URL(src, pageHref())
  }
  catch {
    return undefined
  }
  const own = new URL(pageHref()).origin
  if (url.origin === own && (url.protocol === 'http:' || url.protocol === 'https:'))
    return url.href
  if (url.protocol !== 'https:')
    return undefined
  if (origins && !origins.some(origin => sameOrigin(origin, url.origin)))
    return undefined
  return url.href
}

function sameOrigin(entry: string, origin: string): boolean {
  try {
    return new URL(entry).origin === origin
  }
  catch {
    return false
  }
}

const EmbedOriginsContext = createContext<readonly string[] | undefined>(undefined)

export interface LumiEmbedProviderProps {
  /** Sites frames below may show, e.g. `["https://report.example.com"]`; this site always may. Without it any https site may. */
  origins?: readonly string[] | undefined
  children?: ReactNode
}

/** Limits which sites `Iframe` elements below it may show. */
export function LumiEmbedProvider({ origins, children }: LumiEmbedProviderProps): ReactElement {
  return <EmbedOriginsContext value={origins}>{children}</EmbedOriginsContext>
}

/** Another web page in a sandboxed frame; see the catalog description. */
export function LumiIframe(props: IframeProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { src, title, height, aspectRatio, sandbox, allowFullscreen, className, 'data-testid': testId } = props
  const origins = useContext(EmbedOriginsContext)
  const url = useMemo(() => embeddableUrl(src, origins), [src, origins])
  const [loaded, setLoaded] = useState<string>()
  const fill = height === 'fill'
  const ratio = aspectRatio ? aspectRatioStyle(aspectRatio) : undefined
  const style = ratio ?? (fill ? undefined : { height: `${height ?? DEFAULT_HEIGHT}px` })
  const frameClass = cn('relative w-full min-w-0 overflow-hidden rounded-panel border bg-muted', fill && 'flex-1 min-h-96', className)
  if (!url) {
    return (
      <div data-slot="iframe" data-status="blocked" data-testid={testId} role="alert" style={style} className={cn(frameClass, 'flex items-center justify-center p-4 text-center text-[length:var(--lumi-fs-label)] text-muted-foreground')}>
        {t('lumi.iframe.blocked', 'This address cannot be shown here')}
      </div>
    )
  }
  return (
    <div data-slot="iframe" data-status={loaded === url ? 'loaded' : 'loading'} data-testid={testId} style={style} className={frameClass}>
      {loaded !== url && <span aria-hidden data-slot="iframe-skeleton" className="absolute inset-0 animate-pulse bg-muted motion-reduce:animate-none" />}
      <iframe
        key={url}
        src={url}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        {...(sandbox === false ? {} : { sandbox: SANDBOX })}
        {...(allowFullscreen ? { allow: 'fullscreen', allowFullScreen: true } : {})}
        onLoad={() => setLoaded(url)}
        className="absolute inset-0 block size-full border-0 bg-background"
      />
    </div>
  )
}
