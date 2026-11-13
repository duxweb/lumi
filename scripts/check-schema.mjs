// Runs the built lumi-check CLI over every real JSON document the repository ships.
// Unit coverage of the checker lives in the root vitest run; this gate proves the
// published binary accepts the repository's actual Specs, manifests and themes and
// rejects an invalid document. The admin demo manifest is TS-authored with
// app-registered route components and stays covered by apps/admin/test.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const cli = join(root, 'packages/check/dist/cli.js')
// The CLI is the built artifact; workspace catalogs (including TS application
// catalogs passed through --catalog) are resolved from source so the gate does
// not depend on every product package having been built first.
const nodeArgs = ['--conditions=lumi:source', '--import', 'tsx']
const foundationCatalog = 'examples/foundation-admin/src/catalog.ts'
const jsonIn = directory => readdirSync(join(root, directory)).filter(name => name.endsWith('.json')).sort().map(name => `${directory}/${name}`)

execFileSync('pnpm', ['-F', '@duxweb/lumi-check', 'build'], { cwd: root, stdio: 'inherit' })

const temporary = mkdtempSync(join(tmpdir(), 'lumi-check-schema-'))
try {
  const invalid = join(temporary, 'invalid-spec.json')
  writeFileSync(invalid, JSON.stringify({ root: 'main', elements: { main: { type: 'LumiCheckUnknownComponent', props: {}, children: [] } } }))

  const documents = [
    ...jsonIn('examples/schema-gallery/src/specs').map(file => ({ file })),
    // json-broken.json is the validation page's deliberately invalid sample.
    ...jsonIn('apps/admin/mock/pages').map(file => ({ file })),
    ...jsonIn('apps/admin/public/pages').map(file => ({ file })),
    ...jsonIn('apps/admin/src/specs').filter(file => !file.endsWith('/json-broken.json')).map(file => ({ file })),
    ...jsonIn('examples/foundation-admin/public/pages').map(file => ({ file, catalog: foundationCatalog })),
    { file: 'examples/foundation-admin/public/manifest.json', kind: 'manifest', catalog: foundationCatalog },
    { file: 'examples/foundation-admin/public/theme.json', kind: 'theme' },
  ]

  const failures = []
  const check = ({ file, kind = 'spec', catalog }) => spawnSync(process.execPath, [
    ...nodeArgs,
    cli,
    resolve(root, file),
    '--kind',
    kind,
    ...(catalog ? ['--catalog', resolve(root, catalog)] : []),
  ], { cwd: root, encoding: 'utf8' })

  for (const document of documents) {
    const result = check(document)
    const label = relative(root, resolve(root, document.file))
    if (result.status !== 0)
      failures.push(`${label} (exit ${result.status}):\n${result.stdout}${result.stderr}`)
    else
      process.stdout.write(`${label}: ${result.stdout.trim()}\n`)
  }

  const rejected = check({ file: invalid })
  if (rejected.status !== 1 || !rejected.stdout.includes('unknown_component'))
    failures.push(`Invalid control document was not rejected (exit ${rejected.status}):\n${rejected.stdout}${rejected.stderr}`)

  if (failures.length > 0)
    throw new Error(`lumi-check rejected repository documents:\n${failures.join('\n')}`)
  process.stdout.write(`Checked ${documents.length} repository documents with the built lumi-check CLI; invalid control rejected.\n`)
}
finally {
  rmSync(temporary, { recursive: true, force: true })
}
