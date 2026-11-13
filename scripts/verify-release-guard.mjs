// Enforces the release shape: publishing happens only through the Changesets
// action calling `pnpm run release` (= `changeset publish`), in a job that
// `needs:` the single verification job running `pnpm verify:ci` and the full
// e2e suite (`pnpm e2e:full`). The publish job builds packages but never re-runs verification.
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const releaseCommand = 'changeset publish'
const directPublishPattern = /\b(?:(?:pnpm|yarn)\s+(?:exec\s+)?|(?:npx|bunx)\s+)?(?:changeset|@changesets\/cli)\s+publish\b|\b(?:npm|pnpm|yarn)\s+publish\b/u
const verificationPattern = /\bpnpm\s+(?:run\s+)?verify:(?:ci|release)\b/u
// The whole suite: `pnpm e2e` alone runs only the smoke tests.
const e2ePattern = /\bpnpm\s+(?:run\s+)?e2e:full\b/u
const workflowFilePattern = /\.ya?ml$/u
const jobsHeader = /^jobs:\s*$/u
const topLevelLine = /^\S/u
const jobHeader = /^ {2}([\w-]+):\s*$/u
const needsLine = /^ {4}needs:[ \t]*(\S.*)$/u
const listBrackets = /[[\]]/gu
const runLine = /^\s*(?:-\s+)?run:[ \t]*(\S.*)$/u
const publishLine = /^\s*publish:[ \t]*(\S.*)$/u
const releaseRun = /\bpnpm\s+(?:run\s+)?release\b/u
const verifyCiRun = /\bpnpm\s+(?:run\s+)?verify:ci\b/u
const publishKey = /^\s*publish:/u
const buildPackagesRun = /run:\s*pnpm\s+(?:run\s+)?build:packages\b/u
const releasePublishValue = /^\s*publish: pnpm run release$/mu

/** Splits a workflow into its top-level jobs (two-space indented keys under `jobs:`). */
function workflowJobs(source) {
  const lines = source.split('\n')
  const start = lines.findIndex(line => jobsHeader.test(line))
  const jobs = new Map()
  if (start < 0)
    return jobs
  let current
  for (const line of lines.slice(start + 1)) {
    if (topLevelLine.test(line))
      break
    const header = jobHeader.exec(line)
    if (header) {
      current = { name: header[1], lines: [] }
      jobs.set(current.name, current)
    }
    else if (current) {
      current.lines.push(line)
    }
  }
  for (const job of jobs.values()) {
    const needs = job.lines.map(line => needsLine.exec(line)?.[1]).find(Boolean) ?? ''
    job.needs = needs.replace(listBrackets, '').split(',').map(value => value.trim()).filter(Boolean)
    job.runs = job.lines.map(line => runLine.exec(line)?.[1]?.trim()).filter(Boolean)
    job.publish = job.lines.map(line => publishLine.exec(line)?.[1]?.trim()).filter(Boolean)
  }
  return jobs
}

function verifyConfiguration(candidateManifest, workflows) {
  if (candidateManifest.scripts.release !== releaseCommand)
    throw new Error(`The release script must be exactly "${releaseCommand}"; verification belongs to the workflow job it needs`)

  for (const [name, command] of Object.entries(candidateManifest.scripts)) {
    if (name === 'release')
      continue
    if (name.toLowerCase().includes('publish') || directPublishPattern.test(command))
      throw new Error(`Direct publish primitive is forbidden outside the guarded release script: ${name}`)
  }

  const publishers = []
  for (const [path, source] of workflows) {
    if (directPublishPattern.test(source))
      throw new Error(`Workflow contains a direct publish primitive: ${path}`)
    const jobs = workflowJobs(source)
    for (const job of jobs.values()) {
      if (job.runs.some(run => releaseRun.test(run)))
        throw new Error(`Workflow runs the release script outside the Changesets action: ${path}#${job.name}`)
      for (const value of job.publish)
        publishers.push({ path, job, jobs, value })
    }
  }
  if (publishers.length !== 1 || publishers[0].value !== 'pnpm run release')
    throw new Error(`The only workflow publish value must be pnpm run release: ${JSON.stringify(publishers.map(({ path, job, value }) => [path, job.name, value]))}`)

  const [{ path, job, jobs }] = publishers
  const verifiers = job.needs.map(name => jobs.get(name)).filter(Boolean)
  const verifier = verifiers.find(candidate => candidate.runs.some(run => verifyCiRun.test(run)) && candidate.runs.some(run => e2ePattern.test(run)))
  if (!verifier)
    throw new Error(`${path}#${job.name} must need a job that runs pnpm verify:ci and pnpm e2e:full`)
  if (verifier.needs.length > 0 || verifier.publish.length > 0)
    throw new Error(`${path}#${verifier.name} must be a standalone verification job`)
  if (job.runs.some(run => verificationPattern.test(run) || e2ePattern.test(run)))
    throw new Error(`${path}#${job.name} must not repeat verification; it already needs ${verifier.name}`)
  const publishLine = job.lines.findIndex(line => publishKey.test(line))
  const buildLine = job.lines.findIndex(line => buildPackagesRun.test(line))
  if (buildLine < 0 || buildLine > publishLine)
    throw new Error(`${path}#${job.name} must run pnpm build:packages before publishing so tarballs contain dist`)
}

const workflowRoot = join(root, '.github/workflows')
const workflowPaths = (await readdir(workflowRoot)).filter(path => workflowFilePattern.test(path)).sort()
const workflows = await Promise.all(workflowPaths.map(async path => [path, await readFile(join(workflowRoot, path), 'utf8')]))

verifyConfiguration(manifest, workflows)

function expectConfigurationFailure(label, candidateManifest, candidateWorkflows) {
  try {
    verifyConfiguration(candidateManifest, candidateWorkflows)
  }
  catch {
    return
  }
  throw new Error(`Release guard accepted the ${label} bypass fixture`)
}

const releasePath = workflows.find(([, source]) => releasePublishValue.test(source))?.[0]
const replaceRelease = (from, to) => workflows.map(([path, source]) => [path, path === releasePath ? source.replace(from, to) : source])

expectConfigurationFailure('root script', {
  ...manifest,
  scripts: { ...manifest.scripts, 'unsafe-publish': 'changeset publish' },
}, workflows)
expectConfigurationFailure('verification inside release script', {
  ...manifest,
  scripts: { ...manifest.scripts, release: 'pnpm verify:release && changeset publish' },
}, workflows)
expectConfigurationFailure('workflow step', manifest, [
  ...workflows,
  ['unsafe.yml', 'jobs:\n  unsafe:\n    steps:\n      - run: pnpm exec changeset publish\n'],
])
expectConfigurationFailure('workflow release step', manifest, [
  ...workflows,
  ['unsafe.yml', 'jobs:\n  unsafe:\n    steps:\n      - run: pnpm run release\n'],
])
expectConfigurationFailure('missing needs', manifest, replaceRelease(/^ {4}needs:.*\n/mu, ''))
expectConfigurationFailure('verification without e2e', manifest, replaceRelease(/^.*run: CI=1 pnpm e2e:full\n/mu, ''))
expectConfigurationFailure('verification with the smoke tests only', manifest, replaceRelease(/pnpm e2e:full/u, 'pnpm e2e'))
expectConfigurationFailure('verification without verify:ci', manifest, replaceRelease(/run: pnpm verify:ci/u, 'run: pnpm lint'))
expectConfigurationFailure('publish without build', manifest, replaceRelease(/run: pnpm build:packages/u, 'run: pnpm lint'))
expectConfigurationFailure('repeated verification', manifest, replaceRelease(/run: pnpm build:packages/u, 'run: pnpm build:packages && pnpm verify:ci'))

process.stdout.write(`Verified release guard: ${releasePath} publishes only after its verification job (verify:ci + e2e:full), without repeating it.\n`)
