import type { ReactElement } from 'react'
import type { UiText } from '../text.js'
import {
  ArrowUpRight01Icon as ArrowUpRightData,
  AtIcon as AtData,
  Attachment01Icon as AttachmentData,
  CancelCircleIcon as CancelCircleData,
  Database01Icon as DatabaseData,
  FlashIcon as FlashData,
  GitCompareIcon as GitCompareData,
  Globe02Icon as GlobeData,
  MinusSignCircleIcon as MinusCircleData,
  TextSelectionIcon as SelectionData,
  SecurityCheckIcon as ShieldData,
  ThumbsDownIcon as ThumbsDownData,
  ThumbsUpIcon as ThumbsUpData,
  Wrench01Icon as WrenchData,
} from '@hugeicons/core-free-icons'
import { useEffect, useState } from 'react'
import { createOutlineIcon, EyeIcon, FileIcon, ImageIcon, LinkIcon, useOutlineIcon } from '../../icons.js'

export const ArrowUpRightIcon = createOutlineIcon(ArrowUpRightData)
export const AtIcon = createOutlineIcon(AtData)
export const AttachmentIcon = createOutlineIcon(AttachmentData)
export const CancelCircleIcon = createOutlineIcon(CancelCircleData)
export const DatabaseIcon = createOutlineIcon(DatabaseData)
export const DiffIcon = createOutlineIcon(GitCompareData)
export const FlashIcon = createOutlineIcon(FlashData)
export const GlobeIcon = createOutlineIcon(GlobeData)
export const MinusCircleIcon = createOutlineIcon(MinusCircleData)
const SelectionIcon = createOutlineIcon(SelectionData)
export const ShieldIcon = createOutlineIcon(ShieldData)
export const ThumbsDownIcon = createOutlineIcon(ThumbsDownData)
export const ThumbsUpIcon = createOutlineIcon(ThumbsUpData)
export const WrenchIcon = createOutlineIcon(WrenchData)

/** Milliseconds since the component first saw work in progress; frozen once it stops. */
export function useElapsed(running: boolean): number | undefined {
  const [started, setStarted] = useState(() => (running ? Date.now() : undefined))
  const [elapsed, setElapsed] = useState<number>()
  useEffect(() => {
    if (!running) {
      if (started !== undefined)
        setElapsed(Date.now() - started)
      return
    }
    const from = started ?? Date.now()
    if (started === undefined)
      setStarted(from)
    setElapsed(Date.now() - from)
    const timer = setInterval(() => setElapsed(Date.now() - from), 1000)
    return () => clearInterval(timer)
  }, [running, started])
  return elapsed
}

export { useReducedMotion } from '../../internal/reduced-motion.js'

/** `850` → `0.9s`, `12400` → `12s`, `65000` → `1m 5s`, in the reader's language; `whole` drops the tenths of a ticking timer. */
export function formatDuration(ms: number, t: UiText['t'], whole = false): string {
  if (ms < 10_000 && !whole) {
    const seconds = Math.max(0, ms) / 1000
    return t('lumi.agent.durationSeconds', '{value}s', { value: ms < 1000 ? seconds.toFixed(1) : String(Math.round(seconds * 10) / 10) })
  }
  const total = Math.round(ms / 1000)
  if (total < 60)
    return t('lumi.agent.durationSeconds', '{value}s', { value: String(total) })
  return t('lumi.agent.durationMinutes', '{minutes}m {seconds}s', { minutes: String(Math.floor(total / 60)), seconds: String(total % 60) })
}

/** Tool input and output as readable text: strings as they are, anything else as indented JSON. */
export function formatValue(value: unknown): { code: string, language: string } {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return { code: JSON.stringify(JSON.parse(trimmed), null, 2), language: 'json' }
      }
      catch {}
    }
    return { code: value, language: 'text' }
  }
  try {
    return { code: JSON.stringify(value, null, 2) ?? String(value), language: 'json' }
  }
  catch {
    return { code: String(value), language: 'text' }
  }
}

const KIND_ICON = { page: EyeIcon, record: DatabaseIcon, data: DatabaseIcon, file: FileIcon, selection: SelectionIcon, web: GlobeIcon, document: FileIcon } as const

/** An icon by HugeIcons name, else the default for a context or source kind, else a link. */
export function KindIcon({ icon, kind, mediaType, className }: { icon?: string | undefined, kind?: string | undefined, mediaType?: string | undefined, className?: string }): ReactElement {
  const Named = useOutlineIcon(icon)
  const Fallback = mediaType?.startsWith('image/')
    ? ImageIcon
    : kind && Object.hasOwn(KIND_ICON, kind) ? KIND_ICON[kind as keyof typeof KIND_ICON] : mediaType ? FileIcon : LinkIcon
  const Icon = Named ?? Fallback
  return <Icon aria-hidden className={className} />
}

export { copyText } from '../code-block.js'
