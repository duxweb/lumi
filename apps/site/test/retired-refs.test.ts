import type { Dirent } from 'node:fs'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')
const scannedRoots = ['apps', 'examples', 'packages', 'config', '.github']
const skippedDirs = new Set(['dist', 'node_modules', 'test', 'generated', '.astro', '.turbo', 'coverage'])
const sourceExtensions = /\.(?:astro|json|jsonc|md|mdx|mjs|ts|tsx|yaml|yml)$/u
const ignoredFiles = /^apps\/site\/public\/(?:api-reference\.json|llms[^/]*)$/u
// Packages removed by the native json-render cutover; none of them may be revived or referenced.
const retiredPackages = /@duxweb\/lumi-(?:core|schema|runtime|react|vue|ui-(?:hero|nuxt|recipes|vue|react)|admin-vue)(?![\w-])/u

function walk(dir: string, files: string[]): void {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name))
        walk(path, files)
    }
    else if (entry.isFile() && sourceExtensions.test(entry.name)) {
      const file = relative(root, path).split('\\').join('/')
      if (!ignoredFiles.test(file))
        files.push(file)
    }
  }
}

function activeFiles(): string[] {
  const files: string[] = []
  for (const dir of scannedRoots)
    walk(resolve(root, dir), files)
  return files
}

describe('active repository references', () => {
  it('contains no retired package names', () => {
    const violations = activeFiles().filter(file => retiredPackages.test(readFileSync(resolve(root, file), 'utf8')))
    expect(violations).toEqual([])
  })

  it('publishes every core and extension component page and navigation link', () => {
    const catalog = JSON.parse(readFileSync(resolve(root, 'apps/site/public/catalog.json'), 'utf8')) as {
      components: Array<{ type: string, category: string }>
    }
    expect(catalog.components.filter(component => component.category === 'ui')).toHaveLength(Object.keys(uiComponentDefinitions).length)
    expect(catalog.components.map(component => component.type)).toEqual(expect.arrayContaining(['Query', 'FormPage', 'ListPage', 'DashboardPage', 'SettingsPage', 'DetailPage']))

    const navigation = readFileSync(resolve(root, 'apps/site/src/docs/generated/navigation.mjs'), 'utf8')
    for (const component of catalog.components) {
      const slug = component.type.replace(/([a-z\d])([A-Z])/gu, '$1-$2').toLowerCase()
      const page = `apps/site/src/content/docs/components/${component.category}/${slug}.mdx`
      expect(existsSync(resolve(root, page)), page).toBe(true)
      expect(navigation, component.type).toContain(`"slug": "components/${component.category}/${slug}"`)
    }
  })
})
