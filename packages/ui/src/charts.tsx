import { defineCatalog } from '@json-render/core'
import { defineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { chartComponentDefinition } from './catalog/chart.js'
import { LumiChart } from './charts/chart.js'

export * from './charts/chart.js'
export const chartCatalog = defineCatalog(schema, { components: { Chart: chartComponentDefinition }, actions: {} })
export const { registry: chartRegistry } = defineRegistry(chartCatalog, { components: { Chart: ({ props }) => <LumiChart {...props} /> } })
