import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const budgetPath = join(root, 'config/lumi-size-budgets.json')
const budget = JSON.parse(await readFile(budgetPath, 'utf8'))
if (budget.formatVersion !== 1 || !Array.isArray(budget.assets) || !Array.isArray(budget.dynamicCapabilities))
  throw new Error('Unsupported size budget format')

async function resolveAsset(pattern) {
  if (!pattern.includes('*'))
    return [join(root, pattern)]
  const directory = join(root, dirname(pattern))
  const [prefix, suffix] = basename(pattern).split('*')
  return (await readdir(directory))
    .filter(name => name.startsWith(prefix) && name.endsWith(suffix))
    .map(name => join(directory, name))
}

const measured = new Set()
for (const asset of budget.assets) {
  const paths = await resolveAsset(asset.path)
  if (paths.length !== 1)
    throw new Error(`${asset.name} must resolve to exactly one built asset; received ${paths.length}`)
  const [path] = paths
  measured.add(resolve(path))
  const contents = await readFile(path)
  const sizes = { raw: contents.byteLength, gzip: gzipSync(contents, { level: 9 }).byteLength }
  for (const encoding of ['raw', 'gzip']) {
    if (!Number.isInteger(asset.baseline?.[encoding]) || !Number.isInteger(asset.maximum?.[encoding]))
      throw new Error(`${asset.name} is missing its ${encoding} baseline or maximum`)
    if (sizes[encoding] > asset.maximum[encoding])
      throw new Error(`${asset.name} ${encoding} size ${sizes[encoding]} exceeds ${asset.maximum[encoding]}`)
  }
  if (path.endsWith('.js') && /\bimport\(\s*['"]/u.test(contents.toString('utf8')) && !budget.dynamicCapabilities.includes(asset.name))
    throw new Error(`${asset.name} contains an unbudgeted static dynamic import`)
  process.stdout.write(`${asset.name}: ${sizes.raw} raw / ${sizes.gzip} gzip bytes (baseline ${asset.baseline.raw}/${asset.baseline.gzip})\n`)
}

const jsRoots = [
  join(root, 'packages/ui/dist'),
  join(root, 'apps/admin/dist/assets'),
]
for (const directory of jsRoots) {
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.js'))
      continue
    const path = resolve(directory, name)
    if (!measured.has(path))
      throw new Error(`Unmeasured JavaScript chunk requires a named budget: ${relative(root, path)}`)
  }
}

process.stdout.write(`Size verification passed with ${budget.dynamicCapabilities.length} dynamic capabilities.\n`)
