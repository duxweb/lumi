import type { ReactElement } from 'react'

/**
 * The hover and focus reading of one chart column: label, value and an optional
 * note, in the popover style. It is decoration — each column also carries its
 * reading as screen-reader text — so it is hidden from assistive tech.
 */
export function ChartTip({ label, value, note }: { label: string, value: string, note?: string }): ReactElement {
  return (
    <span className="lumi-chart-tip" aria-hidden>
      <span className="lumi-chart-tip__label">{label}</span>
      <b className="lumi-chart-tip__value">{value}</b>
      {note && <span className="lumi-chart-tip__note">{note}</span>}
    </span>
  )
}

/** Columns near either edge anchor their tip inwards so it never leaves the plot. */
export function tipEdge(index: number, count: number): 'start' | 'end' | undefined {
  const reach = Math.max(1, Math.ceil(count * 0.12))
  return index < reach ? 'start' : index >= count - reach ? 'end' : undefined
}
