import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { readPackedTarballs } from './packed-tarballs.mjs'

const root = resolve(import.meta.dirname, '..')
const temporary = mkdtempSync(join(tmpdir(), 'lumi-entrypoints-'))
const directories = ['lumi', 'ui', 'admin', 'check', 'create']
const manifests = new Map(
  directories.map(dir => [
    dir,
    JSON.parse(
      readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8'),
    ),
  ]),
)
const tooling = createRequire(import.meta.url)
const typeDependencies = Object.fromEntries(['typescript', '@types/node'].map(name => [name, tooling(`${name}/package.json`).version]))
const archives = {}
function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}
function version(name, directory) {
  return JSON.parse(
    readFileSync(
      join(root, 'packages', directory, 'node_modules', name, 'package.json'),
      'utf8',
    ),
  ).version
}
// React is a required peer of the product roots. Installs that verify the
// framework-free /catalog subpaths skip automatic peer installation so React
// stays absent and any accidental React import fails.
function install(name, dependencies, { peers = true } = {}) {
  const directory = join(temporary, name)
  mkdirSync(directory)
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({
      name: `lumi-${name}-check`,
      private: true,
      type: 'module',
      dependencies,
    }),
  )
  run(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...(peers ? [] : ['--legacy-peer-deps'])],
    directory,
  )
  return directory
}
function checkTypes(directory, source) {
  writeFileSync(join(directory, 'verify.ts'), source)
  writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, module: 'NodeNext', target: 'ES2022', lib: ['ES2022', 'DOM'], types: ['node'], skipLibCheck: false },
    files: ['verify.ts'],
  }))
  run(process.execPath, [join(directory, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], directory)
}
function script(directory, source) {
  const file = join(directory, 'verify.mjs')
  writeFileSync(file, source)
  run(process.execPath, [file], directory)
}
try {
  // Installs the tarballs packed once by scripts/pack-packages.mjs.
  const packed = readPackedTarballs()
  for (const dir of directories)
    archives[manifests.get(dir).name] = `file:${packed.get(manifests.get(dir).name)}`
  const products = Object.fromEntries(
    ['lumi', 'ui', 'admin'].map(dir => [
      manifests.get(dir).name,
      archives[manifests.get(dir).name],
    ]),
  )
  const catalogOnly = install('catalog', {
    ...products,
    ...typeDependencies,
    '@json-render/core': version('@json-render/core', 'lumi'),
    'zod': version('zod', 'lumi'),
  }, { peers: false })
  assert(
    !existsSync(join(catalogOnly, 'node_modules/react')),
    'Catalog install pulled React',
  )
  assert(
    !existsSync(join(catalogOnly, 'node_modules/@json-render/react')),
    'Catalog install pulled a renderer',
  )
  script(
    catalogOnly,
    `
import assert from 'node:assert/strict'
import { composeDefinitions, createSpecLoader, lumiActionDefinitions, lumiComponentDefinitions, validateConfig, validateDocument } from '@duxweb/lumi/catalog'
import { themeConfigSchema, uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { adminCatalogDefinitions, adminManifestSchema, validateAdminManifest } from '@duxweb/lumi-admin/catalog'
assert(lumiComponentDefinitions.Query && lumiActionDefinitions.submitForm)
assert.equal(typeof composeDefinitions, 'function')
assert.equal(typeof createSpecLoader, 'function')
assert(validateConfig({}, themeConfigSchema).valid)
assert(uiComponentDefinitions.Button && uiComponentDefinitions.Table)
assert(adminCatalogDefinitions.components.Query)
assert(adminManifestSchema.safeParse({ app: { id: 'test', title: 'Test' }, routes: [] }).success)
assert.equal(typeof validateAdminManifest, 'function')
assert.equal(typeof validateDocument, 'function')
`,
  )
  checkTypes(catalogOnly, `
import { type DocumentValidation, lumiComponentDefinitions, validateDocument } from '@duxweb/lumi/catalog'
import { type ThemeConfig, themeConfigSchema, uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { type AdminManifest, adminCatalogDefinitions, adminManifestSchema } from '@duxweb/lumi-admin/catalog'
const manifest: AdminManifest = { app: { id: 'test', title: 'Test' }, routes: [] }
const theme: ThemeConfig = {}
const result: DocumentValidation = { valid: true, issues: [] }
void [manifest, theme, result, validateDocument, lumiComponentDefinitions, themeConfigSchema, uiComponentDefinitions, adminManifestSchema, adminCatalogDefinitions]
`)
  const standaloneUI = install('ui-alone', {
    '@duxweb/lumi-ui': archives['@duxweb/lumi-ui'],
    '@json-render/core': version('@json-render/core', 'lumi'),
    'zod': version('zod', 'lumi'),
  }, { peers: false })
  assert(!existsSync(join(standaloneUI, 'node_modules/@duxweb/lumi')), 'UI installed Lumi services')
  assert(!existsSync(join(standaloneUI, 'node_modules/react')), 'UI definitions installed React')
  script(standaloneUI, `import { uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'; if (!uiComponentDefinitions.Button) throw new Error('Missing definitions')`)
  // lumi-check imports only /catalog subpaths, so it runs without React.
  const author = install('author', {
    ...archives,
    '@json-render/core': version('@json-render/core', 'lumi'),
    'zod': version('zod', 'lumi'),
  }, { peers: false })
  assert(
    !existsSync(join(author, 'node_modules/react')),
    'Author tools installed React',
  )
  script(
    author,
    `
import assert from 'node:assert/strict'
import { checkDocument, describeComponent, getCatalog } from '@duxweb/lumi-check'
assert(checkDocument({ root: 'a', elements: { a: { type: 'Alert', props: { message: 'ok' } } } }).valid)
assert(getCatalog().components.length > 0)
assert.equal(describeComponent('Alert').type, 'Alert')
`,
  )
  const checked = execFileSync(join(author, 'node_modules/.bin/lumi-check'), ['-', '--json'], {
    cwd: author,
    encoding: 'utf8',
    input: JSON.stringify({ root: 'page', elements: { page: { type: 'Alert', props: { message: 'Packed CLI' } } } }),
  })
  assert.equal(JSON.parse(checked).valid, true)
  const dependencies = { ...products }
  for (const dir of ['lumi', 'ui', 'admin']) {
    for (const name of Object.keys(manifests.get(dir).peerDependencies ?? {})) {
      if (!name.startsWith('@duxweb/') && name !== '@visactor/vchart')
        dependencies[name] = version(name, dir)
    }
  }
  dependencies.jsdom = version('jsdom', 'ui')
  const react = install('react', dependencies)
  script(
    react,
    `
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost' })
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Event', 'MutationObserver']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createStateStore } = await import('@json-render/core')
const { JSONUIProvider, Renderer } = await import('@json-render/react')
const { uiRegistry } = await import('@duxweb/lumi-ui')
const { createLumi, LumiProvider } = await import('@duxweb/lumi')
const { chartRegistry } = await import('@duxweb/lumi-ui/charts')
const { adminRegistry, createAdmin } = await import('@duxweb/lumi-admin')
assert(chartRegistry.Chart && adminRegistry.ListPage)
assert.equal(typeof createAdmin, 'function')
const store = createStateStore({ name: 'Before' })
const spec = { root: 'input', elements: { input: { type: 'Input', props: { ariaLabel: 'Name', value: { $bindState: '/name' } } } } }
const root = createRoot(document.querySelector('#app'))
for (const provider of [JSONUIProvider, LumiProvider]) {
  await act(async () => root.render(h(provider, { registry: uiRegistry, store, ...(provider === LumiProvider ? { context: createLumi() } : {}) }, h(Renderer, { spec, registry: uiRegistry }))))
  const input = document.querySelector('input')
  assert(input)
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'After'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  assert.equal(store.get('/name'), 'After')
  await act(async () => root.render(null))
  store.set('/name', 'Before')
}
await act(async () => root.unmount())
`,
  )
  const css = readFileSync(
    join(react, 'node_modules/@duxweb/lumi-ui/dist/style.css'),
    'utf8',
  )
  assert(
    css.includes('data-slot=frame'),
    'Compiled UI CSS omitted Frame styles',
  )
  console.log(
    'Packed /catalog (without React), author tools and React root entrypoints passed',
  )
}
finally {
  rmSync(temporary, { recursive: true, force: true })
}
