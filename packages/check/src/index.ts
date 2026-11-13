import type { CatalogDefinitions, DocumentValidation } from '@duxweb/lumi/catalog'
import type { Catalog, DirectiveDefinition } from '@json-render/core'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { adminBaseConfigSchema, adminCatalogDefinitions, validateAdminManifest } from '@duxweb/lumi-admin/catalog'
import { themeConfigSchema } from '@duxweb/lumi-ui/catalog'
import { validateConfig, validateDocument } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

export const defaultCatalog: Catalog = defineCatalog(
  schema,
  adminCatalogDefinitions,
)

export { validateDocument }
export type { DocumentIssue, DocumentValidation } from '@duxweb/lumi/catalog'

/** What a document is checked as: a page, an Admin manifest, a theme, or the prebuilt base's config.json. */
export type DocumentKind = 'spec' | 'manifest' | 'theme' | 'config'
export const DOCUMENT_KINDS: readonly DocumentKind[] = ['spec', 'manifest', 'theme', 'config']

/** Loads the Catalog, and any custom directives, a module exports as `catalog` or `default`; the default Catalog without a path. */
export async function loadCatalogConfig(
  path?: string,
): Promise<{ catalog: Catalog, directives?: DirectiveDefinition[] }> {
  if (!path)
    return { catalog: defaultCatalog }
  const module = await import(pathToFileURL(resolve(path)).href)
  const catalog = module.catalog ?? module.default
  if (
    !catalog
    || typeof catalog.zodSchema !== 'function'
    || typeof catalog.validate !== 'function'
    || !catalog.data?.components
  ) {
    throw new Error(
      'Catalog module must export a native catalog as "catalog" or "default".',
    )
  }
  return { catalog, directives: module.directives }
}

/** The Catalog of `loadCatalogConfig`. */
export async function loadCatalog(path?: string): Promise<Catalog> {
  return (await loadCatalogConfig(path)).catalog
}

/** The components and actions of a Catalog, optionally of one kind or one name, as `lumi-check catalog` prints them. An action asked for by name comes with its params as JSON Schema. */
export function getCatalog(
  catalog: Catalog = defaultCatalog,
  options: { kind?: 'components' | 'actions', name?: string } = {},
): {
  components: Array<{
    name: string
    description: string
    slots: readonly string[]
    events: readonly string[]
  }>
  actions: Array<{
    name: string
    description: string
    params?: z.core.JSONSchema.BaseSchema
  }>
  builtInActions: Catalog['schema']['builtInActions']
} {
  const definitions = catalog.data as CatalogDefinitions
  const matches = ([name]: [string, unknown]): boolean => !options.name || name === options.name
  const components = options.kind === 'actions'
    ? []
    : Object.entries(definitions.components).filter(matches).map(([name, definition]) => ({
        name,
        description: definition.description ?? '',
        slots: definition.slots ?? [],
        events: definition.events ?? [],
      }))
  const actions = options.kind === 'components'
    ? []
    : Object.entries(definitions.actions ?? {}).filter(matches).map(([name, definition]) => ({
        name,
        description: definition.description ?? '',
        // Params are worked out only for the one action asked for by name.
        ...(options.name ? { params: z.toJSONSchema(definition.params, { unrepresentable: 'any' }) } : undefined),
      }))
  return {
    components,
    actions,
    builtInActions: catalog.schema.builtInActions ?? [],
  }
}

/** One component's description, props as JSON Schema, slots and events, as `lumi-check describe` prints them. */
export function describeComponent(
  type: string,
  catalog: Catalog = defaultCatalog,
): {
  type: string
  description: string
  props: z.core.JSONSchema.BaseSchema
  slots: readonly string[]
  events: readonly string[]
} {
  const components = (catalog.data as CatalogDefinitions).components
  if (!Object.hasOwn(components, type))
    throw new Error(`Unknown component: ${type}`)
  const definition = components[type]!
  return {
    type,
    description: definition.description ?? '',
    props: z.toJSONSchema(definition.props, { unrepresentable: 'any' }),
    slots: definition.slots ?? [],
    events: definition.events ?? [],
  }
}

/** Checks a document of the given kind against the Catalog: a page Spec by default, or a manifest, a theme or a base `config.json`. */
export function checkDocument(
  document: unknown,
  catalog: Catalog = defaultCatalog,
  options: {
    kind?: DocumentKind
    directives?: readonly DirectiveDefinition[]
  } = {},
): DocumentValidation {
  if (options.kind === 'manifest')
    return validateAdminManifest(document, catalog, options)
  if (options.kind === 'theme')
    return validateConfig(document, themeConfigSchema)
  // The prebuilt base's config.json; an inline manifest's pages are checked with it.
  if (options.kind === 'config') {
    const result = validateConfig(document, adminBaseConfigSchema)
    if (!result.valid)
      return result
    const panels = (document as { panels: unknown }).panels
    for (const [index, panel] of (Array.isArray(panels) ? panels : [panels]).entries()) {
      const manifest = (panel as { manifest?: unknown }).manifest
      if (typeof manifest !== 'object' || manifest === null)
        continue
      const nested = validateAdminManifest(manifest, catalog, options)
      const base = Array.isArray(panels) ? `/panels/${index}/manifest` : '/panels/manifest'
      result.issues.push(...nested.issues.map(issue => ({ ...issue, path: `${base}${issue.path}` })))
    }
    result.valid = !result.issues.some(issue => issue.severity === 'error')
    return result
  }
  return validateDocument(document, catalog, options)
}
