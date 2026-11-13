import { createTranslateDirective, translateDirective } from '@duxweb/lumi/catalog'
import { resolvePropValue } from '@json-render/core'
import { describe, expect, it, vi } from 'vitest'

function scope(state: Record<string, unknown> = {}, directive = translateDirective) {
  return {
    stateModel: state,
    directives: new Map([['$t', directive]]),
  }
}

describe('$t directive', () => {
  it('falls back to the key and fills placeholders without a table', () => {
    const value = translateDirective.resolve({ $t: 'Hello {name}', params: { name: 'Ada' } }, scope())
    expect(value).toBe('Hello Ada')
  })

  it('resolves params as prop expressions before translating', () => {
    const translate = vi.fn(() => 'done')
    const directive = createTranslateDirective(translate)
    expect(directive.resolve({ $t: 'Count {n}', params: { n: { $state: '/n' } } }, scope({ n: 3 }))).toBe('done')
    expect(translate).toHaveBeenCalledWith('Count {n}', { n: 3 }, 'Count {n}')
  })

  it('prefers the explicit default as the fallback message', () => {
    const translate = vi.fn((_key: string, _params?: Record<string, unknown>, fallback?: string) => fallback ?? '')
    const directive = createTranslateDirective(translate)
    expect(directive.resolve({ $t: 'orders.title', default: 'Orders' }, scope())).toBe('Orders')
  })

  it('leaves unknown placeholders readable', () => {
    expect(translateDirective.resolve({ $t: '{a} and {b}', params: { a: 1 } }, scope())).toBe('1 and {b}')
    expect(resolvePropValue('plain', scope())).toBe('plain')
  })
})
