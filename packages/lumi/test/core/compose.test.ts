import { composeDefinitions } from '@duxweb/lumi/catalog'
import { describe, expect, expectTypeOf, it } from 'vitest'

describe('composeDefinitions', () => {
  it('merges disjoint sources in order', () => {
    const result = composeDefinitions({ A: 1 }, { B: 'b' }, { C: true })
    expect(result).toEqual({ A: 1, B: 'b', C: true })
    expect(Object.keys(result)).toEqual(['A', 'B', 'C'])
    expectTypeOf(result).toEqualTypeOf<{ A: number, B: string, C: boolean }>()
  })

  it('throws on an undeclared duplicate name', () => {
    expect(() => composeDefinitions({ Upload: 1 }, { Upload: 2 })).toThrow(/Duplicate definition "Upload"/u)
  })

  it('lets a later source replace a name listed in override', () => {
    const result = composeDefinitions({ Upload: 1, Text: 't' }, { Upload: 'connected' }, { override: ['Upload'] })
    expect(result).toEqual({ Upload: 'connected', Text: 't' })
    expectTypeOf(result.Upload).toEqualTypeOf<string>()
  })

  it('still rejects duplicates that are not listed in override', () => {
    expect(() => composeDefinitions({ A: 1, B: 1 }, { A: 2, B: 2 }, { override: ['A'] })).toThrow(/"B"/u)
  })

  it('rejects stale override entries', () => {
    expect(() => composeDefinitions({ A: 1 }, { B: 2 }, { override: ['A'] })).toThrow(/do not collide: A/u)
  })

  it('treats a source that merely contains other keys as a source, not options', () => {
    expect(composeDefinitions({ A: 1 }, { override: ['x'], B: 2 })).toEqual({ A: 1, override: ['x'], B: 2 })
  })

  it('does not mutate its sources', () => {
    const first = { A: 1 }
    composeDefinitions(first, { A: 2 }, { override: ['A'] })
    expect(first).toEqual({ A: 1 })
  })
})
