import { validateDocument } from '@duxweb/lumi/catalog'
import { describe, expect, it } from 'vitest'
import { defaultCatalog } from '../src/index.js'

describe('author diagnostics', () => {
  it('accepts nested native request expressions and checks both action outcomes', () => {
    const spec = { root: 'load', elements: { load: { type: 'Button', props: { label: 'Load' }, children: [], on: { press: { action: 'request', params: { url: '/orders', query: { filters: [{ status: { $state: '/filter' } }] } }, onSuccess: { action: 'invalidate', params: { resource: 'orders' } } } } } } }
    expect(validateDocument(spec, defaultCatalog)).toMatchObject({ valid: true })
    spec.elements.load.on.press.onSuccess.action = 'missing'
    expect(validateDocument(spec, defaultCatalog).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unknown_action', path: '/elements/load/on/press/onSuccess/action' })]))
  })
  it('rejects unknown props and cyclic references without running actions', () => {
    const spec = { root: 'load', elements: { load: { type: 'Button', props: { labell: 'Load' }, children: ['load'], on: { press: { action: 'not_registered' } } } } }
    const result = validateDocument(spec, defaultCatalog)
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['unrecognized_keys', 'unknown_action', 'cyclic_reference']))
    expect(result.issues.every(issue => issue.hint.length > 0)).toBe(true)
  })
})
