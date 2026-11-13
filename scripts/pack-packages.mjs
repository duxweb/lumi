// Packs every publishable package once into .lumi-pack/ (gitignored) from the
// already-built dist output. It never builds: run `pnpm build:packages` first.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { packDirectory, packedPackageDirectories, packManifestPath, root } from './packed-tarballs.mjs'

rmSync(packDirectory, { recursive: true, force: true })
mkdirSync(packDirectory, { recursive: true })

const packages = []
for (const directory of packedPackageDirectories) {
  const cwd = join(root, 'packages', directory)
  const { name } = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  if (!existsSync(join(cwd, 'dist')))
    throw new Error(`${name} has no dist output. Run \`pnpm build:packages\` before packing.`)
  const before = new Set(readdirSync(packDirectory))
  execFileSync('pnpm', ['pack', '--pack-destination', packDirectory], { cwd, stdio: 'pipe' })
  const created = readdirSync(packDirectory).filter(file => file.endsWith('.tgz') && !before.has(file))
  if (created.length !== 1)
    throw new Error(`${name} produced ${created.length} tarballs`)
  packages.push({ name, directory, tarball: created[0] })
  process.stdout.write(`packed ${name} -> .lumi-pack/${created[0]}\n`)
}

writeFileSync(packManifestPath, `${JSON.stringify({ packages }, null, 2)}\n`)
process.stdout.write(`Packed ${packages.length} packages into .lumi-pack/.\n`)
