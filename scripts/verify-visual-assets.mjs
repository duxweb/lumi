// Cheap structural check of the Lumi-owned visual baselines. Pixel comparison is
// Playwright's job; this gate only proves the committed files match the matrix
// the spec actually captures (e2e/react-admin-visual-matrix.ts):
// - every referenced baseline exists for each required platform, and any
//   platform that has baselines has the complete set;
// - each file is a real PNG whose size equals its viewport;
// - there are no orphan snapshots and no image assets anywhere else in the
//   repository (third-party/ReUI Pro screenshots, icons or templates must
//   never enter the tree), except the images `ownedImages` names one by one:
//   artwork the project owns or is licensed to ship, such as the homepage's.
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { visualSnapshotNames, visualViewports } from '../e2e/react-admin-visual-matrix.ts'

const root = resolve(import.meta.dirname, '..')
const config = JSON.parse(await readFile(resolve(root, 'config/lumi-visual-assets.json'), 'utf8'))
if (config.formatVersion !== 2)
  throw new Error('config/lumi-visual-assets.json must be formatVersion 2')

const directory = config.snapshotDirectory
const imagePath = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/iu
const errors = []

const repositoryImages = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(path => imagePath.test(path))
const owned = new Set(config.ownedImages ?? [])
const foreign = repositoryImages.filter(path => !owned.has(path) && (!path.startsWith(`${directory}/`) || !path.endsWith('.png')))
if (foreign.length > 0)
  errors.push(`Image assets outside the Lumi visual baselines are not allowed: ${foreign.join(', ')}`)
// An entry whose file is gone would quietly admit a later file of that name.
const absent = [...owned].filter(path => !repositoryImages.includes(path))
if (absent.length > 0)
  errors.push(`config/lumi-visual-assets.json lists owned images that do not exist: ${absent.join(', ')}`)

const names = visualSnapshotNames()
const files = (await readdir(resolve(root, directory))).filter(file => !file.startsWith('.'))
const platformPattern = new RegExp(`^(.+)-(${config.knownPlatforms.join('|')})\\.png$`, 'u')
const byPlatform = new Map()
for (const file of files) {
  const match = platformPattern.exec(file)
  if (!match || !names.includes(`${match[1]}.png`)) {
    errors.push(`Orphan or unrecognised baseline: ${directory}/${file}`)
    continue
  }
  if (!byPlatform.has(match[2]))
    byPlatform.set(match[2], new Set())
  byPlatform.get(match[2]).add(`${match[1]}.png`)
}

const platforms = new Set([...config.requiredPlatforms, ...byPlatform.keys()])
for (const platform of platforms) {
  const present = byPlatform.get(platform) ?? new Set()
  const missing = names.filter(name => !present.has(name))
  if (missing.length > 0)
    errors.push(`Missing ${platform} baselines (${missing.length}): ${missing.join(', ')}`)
}

for (const [platform, present] of byPlatform) {
  for (const name of present) {
    const path = `${directory}/${name.replace(/\.png$/u, `-${platform}.png`)}`
    const data = await readFile(resolve(root, path))
    const viewport = visualViewports.find(candidate => name.includes(`-${candidate.name}-`))
    if (data.length < 33 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.subarray(12, 16).toString('latin1') !== 'IHDR') {
      errors.push(`Not a valid PNG: ${path}`)
      continue
    }
    const [width, height] = [data.readUInt32BE(16), data.readUInt32BE(20)]
    if (!viewport || width !== viewport.width || height !== viewport.height)
      errors.push(`${path} is ${width}x${height}, expected the ${viewport?.name ?? 'unknown'} viewport ${viewport?.width}x${viewport?.height}`)
  }
}

if (errors.length > 0)
  throw new Error(`Visual baseline check failed:\n- ${errors.join('\n- ')}`)

const counts = Array.from(byPlatform, ([platform, present]) => `${platform} ${present.size}`).join(', ')
process.stdout.write(`Verified ${names.length} Lumi visual baselines per platform (${counts}); no orphan or foreign images.\n`)
