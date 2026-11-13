import type { ReactElement, ReactNode } from 'react'
import type { Option } from '../catalog/types-public.js'
import { LumiAvatar } from './display.js'

/** Wraps every case-insensitive occurrence of `query` in `<mark>`. */
export function HighlightMatch({ text, query }: { text: string, query?: string }): ReactElement {
  const needle = query?.trim().toLocaleLowerCase()
  if (!needle)
    return <>{text}</>
  const haystack = text.toLocaleLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    if (at > from)
      parts.push(text.slice(from, at))
    parts.push(<mark key={at} data-slot="option-match">{text.slice(at, at + needle.length)}</mark>)
    from = at + needle.length
    at = haystack.indexOf(needle, from)
  }
  parts.push(text.slice(from))
  return <>{parts}</>
}

/** Media, label and description of one option row; shared by every picker list. */
export function OptionContent({ option, query }: { option: Option, query?: string }): ReactElement {
  return (
    <span className="lumi-option-content flex min-w-0 flex-1 items-center gap-2.5" data-rich={option.description ? true : undefined}>
      {option.avatar !== undefined && (
        <span data-slot="option-media" data-kind="avatar" aria-hidden>
          <LumiAvatar name={option.label} src={option.avatar || undefined} size="sm" />
        </span>
      )}
      {option.image && (
        <span data-slot="option-media" data-kind="image" aria-hidden>
          <img src={option.image} alt="" loading="lazy" />
        </span>
      )}
      <span className="lumi-select-option-copy grid min-w-0">
        <span><HighlightMatch text={option.label} query={query} /></span>
        {option.description && <small className="text-xs text-muted-foreground">{option.description}</small>}
      </span>
    </span>
  )
}
