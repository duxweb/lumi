import { describe, expect, it, vi } from 'vitest'
import { createI18nProvider, extendI18nProvider } from '../../src/core/providers/i18n.js'
import { formatIssues } from '../../src/core/validation.js'

describe('createI18nProvider', () => {
  it('translates flat and nested messages with interpolation', () => {
    const provider = createI18nProvider({
      locale: 'zh-CN',
      translations: {
        'zh-CN': {
          'common.save': '保存',
          'greeting': { user: '你好，{name}' },
        },
      },
    })

    expect(provider.translate('common.save')).toBe('保存')
    expect(provider.translate('greeting.user', { name: 'Lumi' })).toBe('你好，Lumi')
  })

  it('uses the documented fallback order', () => {
    const provider = createI18nProvider({
      locale: 'zh-CN',
      fallbackLocale: 'en-US',
      translations: { 'en-US': { 'common.save': 'Save' } },
    })

    expect(provider.translate('common.save', undefined, 'Store')).toBe('Save')
    expect(provider.translate('common.cancel', undefined, 'Cancel')).toBe('Cancel')
    expect(provider.translate('common.unknown')).toBe('common.unknown')
  })

  it('does not expose inherited message properties', () => {
    const nested = Object.create({ secret: 'host-only' }) as Record<string, string>
    nested.visible = 'public'
    const provider = createI18nProvider({
      locale: 'en-US',
      translations: { 'en-US': { nested } },
    })

    expect(provider.translate('nested.visible')).toBe('public')
    expect(provider.translate('nested.secret')).toBe('nested.secret')
    expect(provider.translate('constructor')).toBe('constructor')
  })

  it('provides built-in Lumi messages and lets host messages override them', () => {
    const zh = createI18nProvider({ locale: 'zh-CN' })
    expect(zh.translate('lumi.common.confirm')).toBe('确认')

    const customized = createI18nProvider({
      locale: 'zh-CN',
      translations: { 'zh-CN': { 'lumi.common.confirm': '立即确认' } },
    })
    expect(customized.translate('lumi.common.confirm')).toBe('立即确认')
  })

  it('extends a provider with package messages without overriding host messages', async () => {
    const base = createI18nProvider({
      locale: 'en-US',
      translations: {
        'en-US': { 'feature.title': 'Host title' },
        'zh-CN': { 'feature.title': '宿主标题' },
      },
    })
    const extended = extendI18nProvider(base, {
      'en-US': { 'feature.title': 'Package title', 'feature.action': 'Open {name}' },
      'zh-CN': { 'feature.title': '包标题', 'feature.action': '打开{name}' },
    }, { fallbackLocale: 'en-US' })
    const listener = vi.fn()
    const unsubscribe = extended.subscribe?.(listener)

    expect(extended.translate('feature.title')).toBe('Host title')
    expect(extended.translate('feature.action', { name: 'Lumi' })).toBe('Open Lumi')
    await extended.changeLocale('zh-CN')
    expect(extended.translate('feature.title')).toBe('宿主标题')
    expect(extended.translate('feature.action', { name: 'Lumi' })).toBe('打开Lumi')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe?.()
    await extended.changeLocale('en-US')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('creates a standalone provider when extending without a host provider', () => {
    const extended = extendI18nProvider(undefined, {
      'en-US': { 'feature.title': 'Package title' },
    })

    expect(extended.getLocale()).toBe('en-US')
    expect(extended.translate('feature.title')).toBe('Package title')
    expect(extended.translate('lumi.common.confirm')).toBe('Confirm')
  })

  it('does not reserve any host message value as an internal sentinel', () => {
    const base = createI18nProvider({
      locale: 'en-US',
      translations: { 'en-US': { 'feature.title': '\u0000lumi-missing-message\u0000' } },
    })
    const extended = extendI18nProvider(base, {
      'en-US': { 'feature.title': 'Package title' },
    })

    expect(extended.translate('feature.title')).toBe('\u0000lumi-missing-message\u0000')
  })

  it('localizes normalized JSON Schema validation issues', () => {
    const provider = createI18nProvider({ locale: 'zh-CN' })
    const issues = formatIssues([
      { path: 'tags', code: 'min_items', params: { limit: 2 } },
      { path: 'count', code: 'multiple_of', params: { limit: 5 } },
      { path: 'account', code: 'dependency', params: { property: 'email', required: 'notify' } },
    ], provider.translate)

    expect(issues.map(issue => issue.message)).toEqual([
      '至少需要 2 项',
      '必须是 5 的倍数',
      '存在 email 时还需要 notify',
    ])
  })

  it('notifies subscribers only when locale changes', () => {
    const provider = createI18nProvider({ locale: 'en-US' })
    const listener = vi.fn()
    const unsubscribe = provider.subscribe?.(listener)

    provider.changeLocale('en-US')
    provider.changeLocale('zh-CN')
    expect(provider.getLocale()).toBe('zh-CN')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe?.()
    provider.changeLocale('en-US')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('formats values and infers writing direction', () => {
    const provider = createI18nProvider({ locale: 'en-US' })
    expect(provider.formatNumber?.(1234.5, { minimumFractionDigits: 1 })).toBe('1,234.5')
    expect(provider.formatDate?.('2026-07-11T00:00:00Z', { timeZone: 'UTC', year: 'numeric' })).toBe('2026')
    expect(provider.formatRelativeTime?.(-1, 'day', { numeric: 'auto' })).toBe('yesterday')
    expect(provider.getDirection?.()).toBe('ltr')

    provider.changeLocale('ar')
    expect(provider.getDirection?.()).toBe('rtl')
  })

  it('formats configured major and minor currency units without guessing', () => {
    const major = createI18nProvider({
      locale: 'en-US',
      format: { currency: 'USD', currencyUnit: 'major', timeZone: 'UTC', dateTimeInput: 'iso-utc' },
    })
    const minor = createI18nProvider({
      locale: 'en-US',
      format: { currency: 'USD', currencyUnit: 'minor', timeZone: 'UTC', dateTimeInput: 'iso-utc' },
    })

    expect(major.formatCurrency?.(2700)).toBe('$2,700.00')
    expect(minor.formatCurrency?.(2700)).toBe('$27.00')
    expect(createI18nProvider({ locale: 'en-US' }).formatCurrency).toBeUndefined()
  })

  it('formats only declared UTC datetime inputs in the configured display timezone', () => {
    const provider = createI18nProvider({
      locale: 'en-US',
      format: { currency: 'USD', currencyUnit: 'major', timeZone: 'America/New_York', dateTimeInput: 'iso-utc' },
    })

    expect(provider.formatDateTime?.('2026-08-10T12:00:00Z', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).toBe('08:00')
    expect(() => provider.formatDateTime?.('2026-08-10T12:00:00', { hour: '2-digit' })).toThrow('ISO-8601 UTC')
    expect(() => provider.formatDateTime?.('2026/08/10 12:00Z')).toThrow('ISO-8601 UTC')
    expect(() => provider.formatDateTime?.('2026-02-30T12:00:00Z')).toThrow('datetime value is invalid')
    // Microseconds and nanoseconds, as Go writes a time, read to the millisecond.
    for (const value of ['2026-08-10T12:00:00.5Z', '2026-08-10T12:00:00.123456Z', '2026-08-10T12:00:00.123456789Z'])
      expect(provider.formatDateTime?.(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).toBe('08:00')
    expect(() => provider.formatDateTime?.('2026-08-10T12:00:00.1234567890Z')).toThrow('ISO-8601 UTC')
    expect(() => createI18nProvider({
      locale: 'en-US',
      format: { currency: 'USD', currencyUnit: 'major', timeZone: 'Not/AZone', dateTimeInput: 'iso-utc' },
    })).toThrow()
  })

  it('preserves formatting configuration when extending a provider', () => {
    const base = createI18nProvider({
      locale: 'en-US',
      format: { currency: 'CNY', currencyUnit: 'minor', timeZone: 'Asia/Shanghai', dateTimeInput: 'iso-utc' },
    })
    const extended = extendI18nProvider(base, { 'en-US': {} })

    expect(extended.getFormatConfig?.()).toEqual({ currency: 'CNY', currencyUnit: 'minor', timeZone: 'Asia/Shanghai', dateTimeInput: 'iso-utc' })
    expect(extended.formatCurrency?.(2700)).toBe('CN¥27.00')
  })
})
