import type { DataProvider } from '@duxweb/lumi'
import { createLumi, formatIssues, FormValidationError, handleAuthProviderError, resolveDataTarget, validateForm } from '@duxweb/lumi'
import { describe, expect, it, vi } from 'vitest'

const dataProvider: DataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => ({ data: {} }),
  create: async () => ({ data: {} }),
  update: async () => ({ data: {} }),
  deleteOne: async () => ({ data: {} }),
}

describe('data target', () => {
  it('keeps the resource identifier unchanged and selects its data provider', () => {
    const reporting = {} as DataProvider
    const context = createLumi({ dataProvider: { default: dataProvider, reporting } })

    expect(resolveDataTarget(context, { resource: 'system.orders', dataProviderName: 'reporting' })).toEqual({
      resource: 'system.orders',
      dataProviderName: 'reporting',
      dataProvider: reporting,
    })
  })

  it('rejects empty resource identifiers', () => {
    const context = createLumi({ dataProvider })
    expect(() => resolveDataTarget(context, { resource: ' ' })).toThrow('resource must not be empty')
  })

  it('does not resolve inherited data provider names', () => {
    const context = createLumi({ dataProvider: { default: dataProvider } })

    expect(() => context.getDataProvider('constructor')).toThrow('not registered')
    expect(() => context.getDataProvider('toString')).toThrow('not registered')
  })

  it('rejects named provider selection when only one provider is configured', () => {
    const context = createLumi({ dataProvider })

    expect(context.getDataProvider()).toBe(dataProvider)
    expect(() => context.getDataProvider('reporting')).toThrow('dataProvider "reporting" not registered')
  })

  it('passes page rules to the configured validation engine', async () => {
    const rules = { required: ['title'] }
    const validator = {
      validate: (receivedRules: unknown, values: Record<string, unknown>) => receivedRules === rules && values.title !== 'valid'
        ? [{ path: 'title', code: 'external', message: 'External validation failed' }]
        : [],
    }
    const context = createLumi({ dataProvider, validator })

    expect(await validateForm(context.validator, rules, { title: 'invalid' })).toEqual([
      { path: 'title', code: 'external', message: 'External validation failed' },
    ])
    expect(formatIssues([{ path: 'title', code: 'required' }])[0]?.message).toBe('This field is required')
  })

  it('keeps the receiver for class-based validation translations', async () => {
    class Translator {
      readonly prefix = 'translated'

      translate(_key: string, params?: Record<string, unknown>): string {
        return `${this.prefix}:${String(params?.field)}`
      }
    }

    const validator = {
      validate: () => [{ path: 'title', code: 'required' }],
    }

    expect((await validateForm(validator, {}, {}, new Translator()))[0]?.message).toBe('translated:title')
  })

  it('interpolates validation parameters returned by custom i18n providers', async () => {
    const validator = {
      validate: () => [{ path: 'title', code: 'min_length', params: { limit: 3 } }],
    }
    const i18nProvider = {
      translate: (_key: string, _params?: Record<string, unknown>, defaultMessage?: string) => defaultMessage ?? '',
    }

    expect((await validateForm(validator, {}, {}, i18nProvider))[0]?.message).toBe('Must contain at least 3 characters')
  })

  it('rejects rules when no validation engine is configured', async () => {
    const context = createLumi({ dataProvider })
    await expect(validateForm(context.validator, { required: ['title'] }, {})).rejects.toThrow('validator is not configured')
    expect(await validateForm(context.validator, undefined, {})).toEqual([])
  })

  it('exposes structured form issues on validation failures', () => {
    const issues = formatIssues([{ path: 'profile.name', code: 'required' }])
    const error = new FormValidationError(issues)

    expect(error).toMatchObject({
      name: 'FormValidationError',
      message: '[lumi] form validation failed',
      issues,
    })
  })

  it('does not treat request cancellation as an authentication failure', async () => {
    const onError = vi.fn()

    await expect(handleAuthProviderError({ logout: vi.fn(), onError }, undefined, new DOMException('cancelled', 'AbortError'))).resolves.toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
  })
})
