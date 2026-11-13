import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

export const extensionCatalog = defineCatalog(schema, {
  actions: {},
  components: {
    WorkflowDesigner: { props: z.strictObject({ title: z.string().optional(), workflowId: z.number() }), description: 'Compiled workflow editor.' },
  },
})

export const catalog = defineCatalog(schema, { ...adminCatalogDefinitions, components: { ...adminCatalogDefinitions.components, ...extensionCatalog.data.components } })
