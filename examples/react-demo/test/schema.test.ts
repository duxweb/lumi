import { uiCatalog } from '@duxweb/lumi-ui'
import { validateDocument } from '@duxweb/lumi/catalog'
import { describe, expect, it } from 'vitest'
import { DEMO_SPEC } from '../src/schema'

describe('react native example', () => {
  it('uses the exact UI catalog', () => {
    expect(validateDocument(DEMO_SPEC, uiCatalog)).toEqual({ valid: true, issues: [] })
  })
})
