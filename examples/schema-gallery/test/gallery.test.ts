import { uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { validateDocument } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { describe, expect, it } from 'vitest'
import { GALLERY_PAGES } from '../src/index'

const uiCatalog = defineCatalog(schema, { components: uiComponentDefinitions, actions: {} })

describe('native Spec gallery', () => {
  it('uses the runtime Catalog and covers every UI registry component', () => {
    const types = new Set<string>()
    for (const page of Object.values(GALLERY_PAGES)) {
      expect(validateDocument(page.spec, uiCatalog), page.path).toEqual({ valid: true, issues: [] })
      Object.values(page.spec.elements).forEach(element => types.add(element.type))
    }
    expect(uiCatalog.componentNames.filter(name => !types.has(name))).toEqual([])
  })
})
