import { adminRegistry } from '@duxweb/lumi-admin'
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { uiRegistry } from '@duxweb/lumi-ui'
import { uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { describe, expect, it } from 'vitest'

describe('admin catalog and registry composition', () => {
  it('replaces only the declared Upload override with the service-connected variant', () => {
    expect(adminCatalogDefinitions.components.Upload).not.toBe(uiComponentDefinitions.Upload)
    expect(adminCatalogDefinitions.components.Upload.props.shape).toHaveProperty('upload')
    expect(adminCatalogDefinitions.components.Button).toBe(uiComponentDefinitions.Button)
    expect(adminRegistry.Upload).not.toBe(uiRegistry.Upload)
    expect(adminCatalogDefinitions.components.ImageGrid.props.shape).toHaveProperty('upload')
    expect(adminRegistry.ImageGrid).not.toBe(uiRegistry.ImageGrid)
    expect(adminRegistry.Button).toBe(uiRegistry.Button)
    expect(adminRegistry).toHaveProperty('Query')
    expect(adminRegistry).toHaveProperty('Chart')
    expect(adminRegistry).toHaveProperty('ListPage')
  })
})
