import type { CatalogDefinitions } from '@duxweb/lumi/catalog'
import * as hooks from '@duxweb/lumi'
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { themeConfigSchema, uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

interface SchemaNode {
  type?: string | string[]
  const?: unknown
  enum?: unknown[]
  items?: SchemaNode
  anyOf?: SchemaNode[]
  oneOf?: SchemaNode[]
  $ref?: string
  properties?: Record<string, SchemaNode>
  required?: string[]
}

const wrap = (label: string): string => label.includes(' | ') ? `(${label})` : label

/** One level of fields for an object or an array of objects, e.g. a column definition. */
export function objectFields(input: unknown): { name: string, type: string, required: boolean }[] {
  const node = (input ?? {}) as SchemaNode
  const union = node.anyOf ?? node.oneOf
  const target = node.type === 'array' ? node.items : union ? union.find(item => item.properties || item.items?.properties) : node
  const object = target?.type === 'array' ? target.items : target
  return Object.entries(object?.properties ?? {}).map(([name, value]) => ({ name, type: typeLabel(value), required: object?.required?.includes(name) ?? false }))
}

/** Reads a JSON Schema node the way a TypeScript signature would. */
export function typeLabel(input: unknown): string {
  const node = (input ?? {}) as SchemaNode
  if (node.const !== undefined)
    return JSON.stringify(node.const)
  if (node.enum)
    return node.enum.map(item => JSON.stringify(item)).join(' | ')
  const union = node.anyOf ?? node.oneOf
  if (union)
    return [...new Set(union.map(typeLabel))].join(' | ')
  if (node.type === 'array')
    return node.items ? `${wrap(typeLabel(node.items))}[]` : 'unknown[]'
  if (Array.isArray(node.type))
    return node.type.join(' | ')
  // A recursive shape, such as a tree of options, is emitted as a reference.
  return node.type ?? (node.$ref ? 'object' : 'unknown')
}

export const nativeCatalog = defineCatalog(schema, adminCatalogDefinitions)
export const docsCatalog = {
  components: Object.entries(adminCatalogDefinitions.components as CatalogDefinitions['components']).map(([type, definition]) => {
    const jsonSchema = z.toJSONSchema(definition.props, { unrepresentable: 'any' })
    return { type, category: Object.hasOwn(uiComponentDefinitions, type) ? 'ui' : 'connected', description: definition.description ?? '', slots: definition.slots ?? [], events: definition.events ?? [], jsonSchema, props: Object.entries(jsonSchema.properties ?? {}).map(([name, value]) => ({ name, type: JSON.stringify(value), typeLabel: typeLabel(value), fields: objectFields(value), description: typeof value === 'object' ? value.description ?? '' : '', required: jsonSchema.required?.includes(name) ?? false })) }
  }),
  actions: Object.keys(adminCatalogDefinitions.actions),
  bindings: Object.keys(hooks).filter(name => name.startsWith('use')),
  providers: ['DataProvider', 'AuthProvider', 'AccessProvider', 'I18nProvider', 'RouterProvider', 'TenantProvider', 'LiveProvider', 'AuditLogProvider', 'ToastProvider', 'NotificationProvider', 'Validator'],
}

const themeSchema = z.toJSONSchema(themeConfigSchema)
export const themeReference = { fields: Object.fromEntries(Object.entries(themeSchema.properties ?? {}).map(([key, value]) => [key, { type: JSON.stringify(value), description: typeof value === 'object' ? value.description ?? '' : '', required: themeSchema.required?.includes(key) ?? false }])) }

/** Each action's params as JSON Schema, for the generated action pages. */
export const actionParamSchemas: Record<string, { properties?: Record<string, unknown>, required?: string[] }> = Object.fromEntries(
  Object.entries(adminCatalogDefinitions.actions as Record<string, { params: z.ZodType }>).map(([name, action]) => [name, z.toJSONSchema(action.params, { unrepresentable: 'any' }) as { properties?: Record<string, unknown>, required?: string[] }]),
)
