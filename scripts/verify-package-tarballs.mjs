import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'
import { readPackedTarballs } from './packed-tarballs.mjs'
import { UI_LICENSE_SHA256 } from './ui-license-policy.mjs'

const root = resolve(import.meta.dirname, '..')
const packageRoot = join(root, 'packages')
const expectedPackages = [['admin', '@duxweb/lumi-admin'], ['check', '@duxweb/lumi-check'], ['create', '@duxweb/create-lumi'], ['lumi', '@duxweb/lumi'], ['ui', '@duxweb/lumi-ui']]
const forbiddenPath = /(?:^|[._/-])(?:pro|site|sites|example|examples|storybook|stories|preview|previews|screenshot|screenshots|snapshot|snapshots|baseline|baselines|asset|assets|image|images)(?:[._/-]|$)/iu
const forbiddenImage = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/iu
const provenanceMarker = /reui\s*pro|reui-pro|@reui|keenthemes/iu
const provenancePaths = new Set([
  'package/LICENSES/reui-MIT.txt',
  'package/THIRD_PARTY_NOTICES.md',
  'package/UPSTREAM_SOURCES.md',
  'package/upstream-manifest.json',
])
const javascriptPath = /\.(?:cjs|js|mjs)$/u
const textPath = /\.(?:cjs|css|html|js|json|map|md|mjs|mts|ts|tsx|txt)$/u
const builtins = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)])

function packageName(specifier) {
  if (specifier.startsWith('@'))
    return specifier.split('/').slice(0, 2).join('/')
  return specifier.split('/')[0]
}

function archiveEntries(archive) {
  return execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
}

function archiveText(archive, path) {
  return execFileSync('tar', ['-xOzf', archive, path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function runtimeTargets(value) {
  if (typeof value === 'string')
    return [value]
  if (!value || typeof value !== 'object')
    return []
  return Object.values(value).flatMap(runtimeTargets)
}

function runtimeImports(source, path) {
  const imports = []
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS)
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
      imports.push(node.moduleSpecifier.text)
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        imports.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return imports
}

async function packageInventory() {
  const discovered = []
  for (const entry of await readdir(packageRoot, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue
    const path = join(packageRoot, entry.name, 'package.json')
    const manifest = JSON.parse(await readFile(path, 'utf8').catch(() => 'null'))
    if (manifest)
      discovered.push([entry.name, manifest.name, manifest.private === true])
  }
  discovered.sort((left, right) => left[0].localeCompare(right[0]))
  const actual = discovered.map(([directory, name]) => [directory, name])
  if (JSON.stringify(actual) !== JSON.stringify(expectedPackages))
    throw new Error(`Publishable package inventory mismatch: expected ${JSON.stringify(expectedPackages)}, received ${JSON.stringify(actual)}`)
  const privatePackage = discovered.find(([, , isPrivate]) => isPrivate)
  if (privatePackage)
    throw new Error(`Expected publishable package is private: ${privatePackage[1]} (${privatePackage[0]})`)
  return Promise.all(expectedPackages.map(async ([directoryName, name]) => {
    const directory = join(packageRoot, directoryName)
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    if (manifest.name !== name)
      throw new Error(`Package name mismatch in packages/${directoryName}`)
    return { directory, manifest }
  }))
}

const packages = await packageInventory()
// Audits the tarballs produced once by scripts/pack-packages.mjs.
const tarballs = readPackedTarballs()
for (const { manifest } of packages) {
  const archive = tarballs.get(manifest.name)
  const entries = archiveEntries(archive)
  const entrySet = new Set(entries)
  if (!entrySet.has('package/package.json') || !entrySet.has('package/LICENSE'))
    throw new Error(`${manifest.name} tarball is missing package.json or LICENSE`)
  const packedManifest = JSON.parse(archiveText(archive, 'package/package.json'))
  if (packedManifest.name !== manifest.name || packedManifest.private === true)
    throw new Error(`${manifest.name} packed manifest has an invalid name or private flag`)

  const automaticFiles = new Set(['package.json', 'README.md', 'LICENSE'])
  const declaredFiles = packedManifest.files ?? []
  for (const entry of entries) {
    const path = entry.replace(/^package\//u, '').replace(/\/$/u, '')
    if (!path)
      continue
    if (!automaticFiles.has(path) && !declaredFiles.some(declared => path === declared || path.startsWith(`${declared}/`)))
      throw new Error(`${manifest.name} contains an undeclared packed path: ${path}`)
    if (forbiddenPath.test(path) || forbiddenImage.test(path))
      throw new Error(`${manifest.name} contains a forbidden site/Pro/preview/baseline/image path: ${path}`)
    if (textPath.test(path) && provenanceMarker.test(archiveText(archive, entry)) && !(manifest.name === '@duxweb/lumi-ui' && provenancePaths.has(entry)))
      throw new Error(`${manifest.name} contains a third-party/Pro provenance marker outside the controlled ledger: ${path}`)
  }

  for (const target of [...runtimeTargets(packedManifest.exports), ...runtimeTargets(packedManifest.bin)]) {
    const packedPath = `package/${target.replace(/^\.\//u, '')}`
    if (!entrySet.has(packedPath))
      throw new Error(`${manifest.name} packed manifest target is missing: ${target}`)
  }

  if (manifest.name === '@duxweb/lumi-ui') {
    for (const required of [
      'package/THIRD_PARTY_NOTICES.md',
      'package/UPSTREAM_SOURCES.md',
      'package/upstream-manifest.json',
      'package/LICENSES/shadcn-ui-MIT.txt',
      'package/LICENSES/radix-primitives-MIT.txt',
      'package/LICENSES/reui-MIT.txt',
    ]) {
      if (!entrySet.has(required))
        throw new Error(`UI adapter tarball is missing ${required}`)
    }
    if (Object.keys(packedManifest.exports ?? {}).some(key => key.includes('internal')))
      throw new Error('UI adapter tarball exposes a raw internal entrypoint')
    for (const [path, expectedHash] of Object.entries(UI_LICENSE_SHA256)) {
      const packedPath = `package/${path}`
      const actualHash = createHash('sha256').update(archiveText(archive, packedPath)).digest('hex')
      if (actualHash !== expectedHash)
        throw new Error(`UI adapter tarball license SHA-256 mismatch for ${path}: expected ${expectedHash}, received ${actualHash}`)
    }
  }

  const declaredRuntime = new Set([
    ...Object.keys(packedManifest.dependencies ?? {}),
    ...Object.keys(packedManifest.peerDependencies ?? {}),
    ...Object.keys(packedManifest.optionalDependencies ?? {}),
  ])
  // A scaffold's template files are the generated app's sources, with that
  // app's own dependencies; they are not code this package runs.
  for (const entry of entries.filter(path => javascriptPath.test(path) && !path.startsWith('package/templates/'))) {
    const source = archiveText(archive, entry)
    const imports = runtimeImports(source, entry)
    for (const specifier of imports) {
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#') || builtins.has(specifier))
        continue
      const dependency = packageName(specifier)
      if (!declaredRuntime.has(dependency))
        throw new Error(`${manifest.name} imports undeclared runtime dependency ${dependency} in ${entry}`)
    }
  }
  process.stdout.write(`${manifest.name}: ${entries.length} packed files verified (${basename(archive)})\n`)
}
process.stdout.write(`Verified exact inventory of ${expectedPackages.length} publishable package tarballs.\n`)
