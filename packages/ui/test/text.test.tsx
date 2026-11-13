import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Calendar } from '../src/internal/shadcn/calendar.js'
import { LumiPagination, LumiUiTextProvider } from '../src/react/index.js'

const chinese: Record<string, string> = {
  'lumi.pagination.totalCount': '共 {total} 条',
  'lumi.pagination.next': '下一页',
}

const PLACEHOLDER = /\{(\w+)\}/g

function translate(key: string, params?: Record<string, unknown>, fallback?: string): string {
  const message = chinese[key] ?? fallback ?? key
  return message.replace(PLACEHOLDER, (_, name: string) => String(params?.[name]))
}

describe('lumiUiTextProvider', () => {
  it('falls back to English text without a provider', () => {
    const html = renderToStaticMarkup(<LumiPagination page={1} pageSize={10} total={25} />)
    expect(html).toContain('25 total')
    expect(html).toContain('Next')
  })

  it('takes strings from the host translator', () => {
    const html = renderToStaticMarkup(
      <LumiUiTextProvider translate={translate} locale="zh-CN">
        <LumiPagination page={1} pageSize={10} total={25} />
      </LumiUiTextProvider>,
    )
    expect(html).toContain('共 25 条')
    expect(html).toContain('下一页')
  })

  it('names months and weekdays in the host locale', () => {
    const html = renderToStaticMarkup(
      <LumiUiTextProvider translate={translate} locale="zh-CN">
        <Calendar mode="single" defaultMonth={new Date(2026, 10, 6)} />
      </LumiUiTextProvider>,
    )
    expect(html).toContain('2026年11月')
    expect(html).toContain('周一')
  })
})
