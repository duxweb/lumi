import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const tagPrefix = /^refs\/tags\//u
const stableVersionTag = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/u
const tag = (process.argv[2] ?? process.env.GITHUB_REF ?? '').replace(tagPrefix, '')
const version = stableVersionTag.exec(tag)?.[1]
assert(version, 'Publishing requires a stable version tag such as v0.1.0; branches and prerelease tags cannot publish.')

const config = JSON.parse(await readFile(join(root, '.changeset/config.json'), 'utf8'))
const packages = []
for (const directory of await readdir(join(root, 'packages'), { withFileTypes: true })) {
  if (!directory.isDirectory())
    continue
  const manifest = JSON.parse(await readFile(join(root, 'packages', directory.name, 'package.json'), 'utf8'))
  if (!manifest.private)
    packages.push(manifest)
}
assert.deepEqual(packages.map(pkg => pkg.name).sort(), config.fixed.flat().sort(), 'The release must include exactly the configured fixed package group.')
for (const pkg of packages)
  assert.equal(pkg.version, version, `${pkg.name} must match ${tag}; run pnpm run version and commit the version changes first.`)

const pending = (await readdir(join(root, '.changeset'))).filter(file => file.endsWith('.md') && file !== 'README.md')
assert.equal(pending.length, 0, 'Pending changesets must be included in the version before publishing a stable tag.')
assert.equal(config.access, 'public', 'Lumi releases must use public registry access.')
process.stdout.write(`Verified ${tag}: ${packages.length} public packages at ${version}, with no pending changesets.\n`)
