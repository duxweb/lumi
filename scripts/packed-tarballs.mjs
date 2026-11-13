// Shared access to the tarballs produced once by scripts/pack-packages.mjs.
// Every tarball consumer (audit, entrypoint smoke, template smoke, publint, attw)
// reads the same .lumi-pack/ output so packages are packed exactly once per run.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const root = resolve(import.meta.dirname, '..')
export const packDirectory = join(root, '.lumi-pack')
export const packManifestPath = join(packDirectory, 'manifest.json')
/** Publishable package directories under packages/, in pack order. */
export const packedPackageDirectories = ['lumi', 'ui', 'admin', 'check', 'create']

function newestMtime(path) {
  if (!existsSync(path))
    return 0
  const stat = statSync(path)
  if (!stat.isDirectory())
    return stat.mtimeMs
  return Math.max(stat.mtimeMs, ...readdirSync(path).map(entry => newestMtime(join(path, entry))))
}

/**
 * Returns Map<packageName, absoluteTarballPath>. Fails when the pack step has
 * not run, a tarball is missing, or a package's dist changed after packing, so
 * no consumer can silently check stale artifacts.
 */
export function readPackedTarballs() {
  if (!existsSync(packManifestPath))
    throw new Error('Missing .lumi-pack/manifest.json. Run `pnpm build:packages && pnpm pack:packages` first.')
  const manifest = JSON.parse(readFileSync(packManifestPath, 'utf8'))
  const tarballs = new Map()
  for (const { name, directory, tarball } of manifest.packages) {
    const path = join(packDirectory, tarball)
    if (!existsSync(path))
      throw new Error(`Packed tarball is missing for ${name}: ${path}`)
    if (newestMtime(join(root, 'packages', directory, 'dist')) > statSync(path).mtimeMs)
      throw new Error(`${name} dist changed after packing. Re-run \`pnpm pack:packages\`.`)
    tarballs.set(name, path)
  }
  const expected = packedPackageDirectories.map(directory => JSON.parse(readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8')).name)
  const missing = expected.filter(name => !tarballs.has(name))
  if (missing.length > 0)
    throw new Error(`.lumi-pack is missing packages: ${missing.join(', ')}`)
  return tarballs
}
