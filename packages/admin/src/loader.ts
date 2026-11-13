import type { CreateLumiLoaderOptions, DocumentValidation, DocumentValidationOptions, LumiJsonLoader } from '@duxweb/lumi/catalog'
import type { Catalog } from '@json-render/core'
import type { AdminManifest } from './config.js'
import { createJsonLoader, validateConfig, validateDocument } from '@duxweb/lumi/catalog'
import { adminManifestSchema } from './config.js'
import { flattenAdminRoutes } from './menu.js'

/** Checks a manifest's shape, that route names and paths are unique, and every inline page Spec against the Catalog. */
export function validateAdminManifest(value: unknown, catalog: Catalog, options?: DocumentValidationOptions): DocumentValidation {
  const result = validateConfig(value, adminManifestSchema)
  if (!result.valid)
    return result
  const manifest = value as AdminManifest
  const names = new Set<string>()
  const paths = new Set<string>()
  for (const { route, path } of flattenAdminRoutes(manifest.routes)) {
    if (paths.has(path) || (route.name && names.has(route.name)))
      result.issues.push({ code: 'duplicate_route', path: '/routes', message: `Duplicate route: ${route.name ?? path}`, hint: 'Use unique route names and paths.', severity: 'error' })
    paths.add(path)
    if (route.name)
      names.add(route.name)
    if (route.page?.spec) {
      const validation = validateDocument(route.page.spec, catalog, options)
      result.issues.push(...validation.issues.map(issue => ({ ...issue, path: `/routes/${route.name ?? path}/page/spec${issue.path}` })))
    }
  }
  result.valid = !result.issues.some(issue => issue.severity === 'error')
  return result
}
/** A loader of Admin manifests, validated against the Catalog. */
export function createManifestLoader(catalog: Catalog, options?: CreateLumiLoaderOptions & DocumentValidationOptions): LumiJsonLoader<AdminManifest> {
  return createJsonLoader(value => validateAdminManifest(value, catalog, options), options)
}
