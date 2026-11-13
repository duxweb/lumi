import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'

const mode = process.argv.includes('--diff') ? 'diff' : process.argv.includes('--dry-run') ? 'dry-run' : undefined
if (!mode)
  throw new Error('Use --dry-run or --diff')

const root = resolve(import.meta.dirname, '..')
const packageRoot = join(root, 'packages/ui')
const offlineVerification = spawnSync(process.execPath, [join(root, 'scripts/verify-ui-upstream.mjs')], { cwd: root, encoding: 'utf8' })
if (offlineVerification.stdout)
  process.stdout.write(offlineVerification.stdout)
if (offlineVerification.stderr)
  process.stderr.write(offlineVerification.stderr)
if (offlineVerification.status !== 0)
  throw new Error(`Offline upstream inventory verification failed with exit code ${offlineVerification.status}`)
const manifest = JSON.parse(await readFile(join(packageRoot, 'upstream-manifest.json'), 'utf8'))
if (manifest.formatVersion !== 2 || manifest.sources.length !== 32)
  throw new Error('Expected the fixed 32-source upstream manifest')

const temporary = await mkdtemp(join(tmpdir(), 'lumi-ui-upstream-'))
try {
  for (const source of manifest.sources) {
    const repositoryPath = new URL(source.repository).pathname.replace(/^\//u, '')
    const url = `https://raw.githubusercontent.com/${repositoryPath}/${source.revision}/${source.upstreamPath}`
    const response = await fetch(url, { redirect: 'error' })
    if (!response.ok)
      throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`)
    const contents = Buffer.from(await response.arrayBuffer())
    const upstreamHash = createHash('sha256').update(contents).digest('hex')
    if (upstreamHash !== source.upstreamSha256)
      throw new Error(`Immutable upstream hash mismatch for ${source.upstreamItem}: expected ${source.upstreamSha256}, received ${upstreamHash}`)
    const staged = join(temporary, `${source.upstreamItem}-${basename(source.upstreamPath)}`)
    await writeFile(staged, contents)
    process.stdout.write(`[upstream ${mode}] ${source.upstreamPath}@${source.revision} -> ${source.destination} (${contents.byteLength} bytes, sha256 ${upstreamHash})\n`)
    if (mode === 'diff') {
      const result = spawnSync('git', ['diff', '--no-index', '--', join(packageRoot, source.destination), staged], { cwd: root, encoding: 'utf8' })
      if (result.stdout)
        process.stdout.write(result.stdout)
      if (result.stderr)
        process.stderr.write(result.stderr)
      if (result.status !== 0 && result.status !== 1)
        throw new Error(`git diff failed for ${source.destination} with exit code ${result.status}`)
    }
  }
  process.stdout.write(`Upstream ${mode} verified all ${manifest.sources.length} immutable sources in a temporary directory; no owned source was written.\n`)
}
finally {
  await rm(temporary, { recursive: true, force: true })
}
