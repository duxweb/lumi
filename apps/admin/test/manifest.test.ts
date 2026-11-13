import { adminCatalogDefinitions, validateAdminManifest } from '@duxweb/lumi-admin/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createAdminManifest } from '../src/manifest.js'

describe('react Admin manifest', () => {
  it('conforms to the final protocol', () => {
    const manifest = createAdminManifest()
    const components = Object.fromEntries(manifest.routes.flatMap(route => route.page?.spec ? Object.values(route.page.spec.elements).map(element => [element.type, { props: z.strictObject({}) }]) : []))
    const catalog = defineCatalog(schema, { ...adminCatalogDefinitions, components: { ...adminCatalogDefinitions.components, ...components } })
    expect(validateAdminManifest(manifest, catalog)).toEqual({ valid: true, issues: [] })
    expect(manifest.routes.some(route => route.name === 'orders')).toBe(true)
    expect(manifest.routes.some(route => route.name === 'order-detail')).toBe(true)
  })
})
