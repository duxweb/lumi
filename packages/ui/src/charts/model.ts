import type { LumiChartPoint, LumiChartProps } from '../catalog/types-public.js'

export function chartPoints(type: LumiChartProps['type'], points: readonly LumiChartPoint[] | null | undefined): LumiChartPoint[] {
  // Bound points may not have loaded yet.
  return (points ?? []).filter(point => Number.isFinite(point.value) && (type !== 'donut' || point.value >= 0))
}

export function formatChartValue(value: number, options: Pick<LumiChartProps, 'valueFormat' | 'locale' | 'currency'> = {}, compact = false): string {
  const shape: Intl.NumberFormatOptions = { notation: compact ? 'compact' : 'standard', minimumFractionDigits: 0, maximumFractionDigits: compact ? 1 : 0 }
  try {
    return new Intl.NumberFormat(options.locale ?? 'en-US', {
      ...(options.valueFormat === 'currency' ? { style: 'currency', currency: options.currency ?? 'USD' } : {}),
      ...shape,
    }).format(value)
  }
  catch {
    // A locale or currency code Intl does not know: the number still shows.
    return new Intl.NumberFormat('en-US', shape).format(value)
  }
}
