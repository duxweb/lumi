import type { Spec } from '@json-render/core'
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { validateDocument } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { describe, expect, it } from 'vitest'
import { actionSpecs, agentSpec, brokenSpec, errorSpecs, querySpecs, startSpecs, stateSpecs, statsSpec, uploadSpec } from '../src/json-specs.js'

const catalog = defineCatalog(schema, adminCatalogDefinitions)

const developerSpecs = Object.entries({ start: startSpecs, state: stateSpecs, actions: actionSpecs, query: querySpecs, errors: errorSpecs })
  .flatMap(([page, specs]) => Object.entries(specs as Record<string, Spec>).map(([name, spec]) => [`${page}/${name}`, spec] as const))

describe('jSON showcase Specs', () => {
  it.each(developerSpecs)('developer example %s validates against the application Catalog', (_, spec) => {
    expect(validateDocument(spec, catalog)).toEqual({ valid: true, issues: [] })
  })

  it.each([['upload', uploadSpec], ['stats', statsSpec], ['agent output', agentSpec]] as const)('%s Spec validates against the application Catalog', (_, spec) => {
    expect(validateDocument(spec, catalog)).toEqual({ valid: true, issues: [] })
  })

  it('broken sample reports the unknown component, prop value and action', () => {
    const result = validateDocument(brokenSpec, catalog)
    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => [issue.code, issue.path])).toEqual(expect.arrayContaining([
      ['unknown_component', '/elements/chart/type'],
      ['unknown_action', '/elements/save/on/press/action'],
      ['missing_child', '/elements/demo'],
      [expect.any(String), '/elements/save/props/appearance'],
    ]))
  })
})
