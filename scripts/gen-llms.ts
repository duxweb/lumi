#!/usr/bin/env tsx
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { docsCatalog, themeReference } from '../apps/site/src/docs/reference/catalog.js'
import { enUS, zhCN } from '../packages/lumi/src/index.js'
import { verifyGeneratedOutputInventory } from './generated-output-inventory.mjs'

const root = resolve(import.meta.dirname, '..')
const publicRoot = join(root, 'apps/site/public')
const check = process.argv.includes('--check')
// The live preview tag only renders on the site; readers of this file get the Markdown around it.
const SITE_ONLY_TAG_RE = /^<ComponentPreview [^>]*\/>\n\n/gmu
async function output(name: string, content: string): Promise<void> {
  const path = join(publicRoot, name)
  if (check) {
    if (await readFile(path, 'utf8') !== content)
      throw new Error(`Stale generated output: ${path}`)
  }
  else {
    await writeFile(path, content)
  }
}
async function documents(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name)).map(async entry => entry.isDirectory() ? documents(join(dir, entry.name)) : entry.name.endsWith('.mdx') ? [(await readFile(join(dir, entry.name), 'utf8')).replace(SITE_ONLY_TAG_RE, '')] : []))).flat()
}
const packages = JSON.parse(await readFile(join(publicRoot, 'api-reference.json'), 'utf8')) as Array<{ name: string, description: string, entrypoints: string[] }>
const intro = `# Lumi

Lumi uses native json-render Spec, Catalog, Registry, StateStore and handlers. Lumi is React-only: each package root is the React entry, and the framework-free /catalog subpaths hold definitions and Spec validation for Node tools without React.

${packages.map(pkg => `- ${pkg.name}: ${pkg.description}. Entrypoints: ${pkg.entrypoints.join(', ')}`).join('\n')}

Use original JSONUIProvider/Renderer with uiRegistry for plain UI. LumiProvider optionally adds data/auth/upload services. Admin composes Lumi and Lumi UI. UI never executes remote queries. Business validators and structured field errors are separate from Spec validation. The lumi-check CLI uses the same application Catalog as runtime. JSON only contains serializable values and registered actions. Editable values have one owner, the native StateStore. QueryClient owns remote cache. Await validation and saving inside one handler; action arrays are not transactions.

Components: ${docsCatalog.components.map(item => item.type).join(', ')}
Actions: ${docsCatalog.actions.join(', ')}
`
await output('catalog.json', `${JSON.stringify(docsCatalog, null, 2)}\n`)
await output('theme-reference.json', `${JSON.stringify(themeReference, null, 2)}\n`)
await output('locale-reference.json', `${JSON.stringify({ locales: [{ locale: 'zh-CN', messages: zhCN }, { locale: 'en-US', messages: enUS }] }, null, 2)}\n`)
await output('llms.txt', intro)
await output('llms-full.txt', `${intro}\n${(await documents(join(root, 'apps/site/src/content/docs'))).join('\n\n')}`)
if (check)
  await verifyGeneratedOutputInventory(root)
