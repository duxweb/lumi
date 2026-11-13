import type { Spec } from '@json-render/core'
import { GALLERY_PAGES } from '@duxweb/lumi-schema-gallery'
import { uiCatalog } from '@duxweb/lumi-ui'
import { validateDocument } from '@duxweb/lumi/catalog'
import { describe, expect, it } from 'vitest'
import { focusComponentDemo } from '../src/docs/focus'

describe('component documentation previews', () => {
  it('finds one valid focused example for every standard component', () => {
    for (const component of uiCatalog.componentNames) {
      const focused = Object.values(GALLERY_PAGES)
        .map(page => focusComponentDemo(page.spec, component))
        .find((schema): schema is Spec => Boolean(schema))

      expect(focused, `${component} needs a focused gallery example`).toBeDefined()
      expect(validateDocument(focused, uiCatalog), component).toEqual({ valid: true, issues: [] })
      // No state from the rest of the gallery page leaks into the example.
      const text = JSON.stringify(focused!.elements)
      for (const key of Object.keys(focused!.state ?? {}))
        expect(text, `${component} carries unused state ${key}`).toContain(`"/${key}`)
    }
  })
})
