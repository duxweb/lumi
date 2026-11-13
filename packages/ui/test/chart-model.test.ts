import { describe, expect, it } from 'vitest'
import { chartPoints, formatChartValue } from '../src/charts/model.js'

describe('chart data', () => {
  it('keeps zero and signed values without inventing minimum-size bars', () => {
    expect(chartPoints('bar', [{ label: 'Zero', value: 0 }, { label: 'Loss', value: -5 }])).toEqual([{ label: 'Zero', value: 0 }, { label: 'Loss', value: -5 }])
  })
  it('rejects invalid quantities and negative donut slices, not the whole dataset', () => {
    expect(chartPoints('donut', [{ label: 'Invalid', value: Number.NaN }, { label: 'Loss', value: -1 }, { label: 'Valid', value: 4 }])).toEqual([{ label: 'Valid', value: 4 }])
  })
  it('formats chart values consistently for visible and accessible content', () => {
    expect(formatChartValue(1250, { valueFormat: 'currency' })).toBe('$1,250')
    expect(formatChartValue(0)).toBe('0')
  })
  it('respects host locale and currency, including compact axis values', () => {
    expect(formatChartValue(1250, { valueFormat: 'currency', locale: 'de-DE', currency: 'EUR' })).toBe('1.250 €')
    expect(formatChartValue(1250, { valueFormat: 'currency', locale: 'zh-CN', currency: 'CNY' })).toBe('¥1,250')
    expect(formatChartValue(2000, { valueFormat: 'currency', currency: 'USD' }, true)).toBe('$2K')
  })
})
